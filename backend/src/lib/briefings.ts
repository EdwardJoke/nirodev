import { env } from '../config/env'
import { logger } from '../config/logger'
import { distillBriefings, hasAgnesKey } from './agnes'
import { readArticles } from './article-reader'
import type { Briefing, BriefingDraft, NewsItem, TextQuality } from '../types/digest.types'

/** How much of each article is shown to the model. */
const PROMPT_CHARS = 2500
/** Length of the extract used when no model is available. */
const EXTRACT_CHARS = 340
/** Shorter than this and a feed summary is not worth repeating. */
const MIN_BLOCK_CHARS = 40

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Strongest stories first — those are the ones worth reading in full. */
function rank(items: NewsItem[]): NewsItem[] {
  const score = (item: NewsItem) => (item.points ?? 0) * 2 + (item.comments ?? 0)
  return [...items].sort((a, b) => {
    const diff = score(b) - score(a)
    if (diff) return diff
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })
}

/** Below this, an extracted page is a stub rather than an article. */
const MIN_ARTICLE_CHARS = 120

/** Says plainly that the story could not be read, instead of padding it out. */
function describeItem(item: NewsItem): string {
  const meta = [item.source]
  if (typeof item.points === 'number' && item.points > 0) meta.push(`${item.points} points`)
  if (typeof item.comments === 'number' && item.comments > 0) meta.push(`${item.comments} comments`)

  return (
    `The full text of this story could not be read automatically. ` +
    `It was published by ${meta.join(', ')} on ${item.publishedAt.slice(0, 10)} — ` +
    `open the original below for the complete report.`
  )
}

/**
 * Best available text for a story: the article, else the feed summary, else an
 * honest note. Never empty, so an expanded briefing is never blank.
 */
export function sourceText(item: NewsItem, article?: string): { text: string; quality: TextQuality } {
  if (article && article.length >= MIN_ARTICLE_CHARS) {
    return { text: article, quality: 'article' }
  }
  if (item.excerpt && item.excerpt.length >= MIN_BLOCK_CHARS) {
    return { text: item.excerpt, quality: 'excerpt' }
  }
  return { text: describeItem(item), quality: 'metadata' }
}

/** Lead sentences of the article, used when no model is configured. */
export function extractiveSummary(text: string, maxChars = EXTRACT_CHARS): string {
  const sentences = oneLine(text)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)

  let summary = ''
  for (const sentence of sentences) {
    if (summary && summary.length + sentence.length > maxChars) break
    summary += summary ? ` ${sentence}` : sentence
    if (summary.length >= maxChars * 0.6) break
  }

  return summary || oneLine(text).slice(0, maxChars)
}

/**
 * Read the source article behind each story and distil it into a short
 * briefing. Falls back to the article's own opening when the model is not
 * configured, and to the feed summary when the page cannot be read.
 */
export async function buildBriefings(
  items: NewsItem[],
  /** Links found in the issue body — these stories take priority. */
  preferredUrls: string[] = []
): Promise<Briefing[]> {
  const limit = Math.max(1, env.BRIEFING_LIMIT)
  const withUrl = items.filter((item) => Boolean(item.url))

  // Follow the order the stories appear in the issue; anything not written up
  // is not worth a briefing, even if it scored highly.
  const preferred = preferredUrls
    .map((url) => withUrl.find((item) => item.url === url))
    .filter((item): item is NewsItem => Boolean(item))

  const selected = [...preferred, ...rank(withUrl).filter((item) => !preferred.includes(item))].slice(
    0,
    limit
  )
  if (!selected.length) return []

  const articles = await readArticles(selected.map((item) => item.url))

  const drafts: BriefingDraft[] = selected.map((item, index) => {
    const { text, quality } = sourceText(item, articles.get(item.url))
    return { index: index + 1, title: item.title, source: item.source, url: item.url, text, quality }
  })

  let distilled = new Map<string, { summary: string; points: string[] }>()
  let mode: 'agnes' | 'extract' = 'extract'

  if (hasAgnesKey()) {
    try {
      distilled = await distillBriefings(drafts, PROMPT_CHARS)
      mode = 'agnes'
    } catch (error) {
      logger.error(
        { err: error },
        'briefing distillation failed, falling back to article extracts'
      )
    }
  }

  const briefings = drafts
    .map<Briefing>((draft) => {
      const fromModel = distilled.get(draft.url)
      if (fromModel && oneLine(fromModel.summary)) {
        return {
          url: draft.url,
          title: draft.title,
          source: draft.source,
          mode: 'agnes',
          summary: oneLine(fromModel.summary),
          points: fromModel.points.map(oneLine).filter(Boolean).slice(0, 3),
        }
      }
      return {
        url: draft.url,
        title: draft.title,
        source: draft.source,
        mode: 'extract',
        // A metadata-only draft is already a finished sentence — summarising it
        // again would only paraphrase "we could not read this".
        summary:
          draft.quality === 'metadata' ? draft.text : extractiveSummary(draft.text),
        points: [],
      }
    })
    .filter((briefing) => briefing.summary.length > 20)

  logger.info(
    {
      stories: selected.length,
      fromArticle: drafts.filter((draft) => draft.quality === 'article').length,
      fromExcerpt: drafts.filter((draft) => draft.quality === 'excerpt').length,
      metadataOnly: drafts.filter((draft) => draft.quality === 'metadata').length,
      mode,
      briefings: briefings.length,
    },
    'briefings built'
  )

  return briefings
}
