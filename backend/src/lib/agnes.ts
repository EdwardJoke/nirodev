import { env } from '../config/env'
import { logger } from '../config/logger'
import { assertDigestStructure } from './digest-validate'
import type { BriefingDraft, NewsItem } from '../types/digest.types'

export const hasAgnesKey = () => Boolean(env.AGNES_API_KEY)

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatOptions {
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}

/**
 * Call the Agnes chat-completions endpoint (OpenAI compatible).
 * Throws when the gateway is unreachable or returns an error status.
 */
export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const { maxTokens = 4000, temperature = 0.4, timeoutMs = 120000 } = options

  if (!hasAgnesKey()) {
    throw new Error('AGNES_API_KEY is not configured')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${env.AGNES_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AGNES_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.AGNES_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Agnes API ${response.status}: ${detail.slice(0, 300)}`)
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('Agnes API returned an empty completion')
    return content
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Unwrap a fenced response. Only the fence is removed — the `---` delimiters
 * belong to the frontmatter and must survive, otherwise the title, summary and
 * tags are lost before the document is ever parsed.
 */
function stripCodeFence(text: string): string {
  const fence = text.match(/```(?:mdx|markdown|md)?\s*\n([\s\S]*?)```/i)
  return (fence ? fence[1] : text).trim()
}

export const DIGEST_SYSTEM_PROMPT = `You are the editor of "Daily Tech News", a black-and-white editorial tech digest.

You are given a list of real news items published on a single day. Write that day's issue as an MDX document.

Hard rules:
- Write in English. Confident, specific, editorial voice. No hype, no emoji, no marketing language.
- Never invent facts, numbers, companies or quotes that are not present in the provided items.
- Every claim must be traceable to one of the provided items.
- The document must start with a YAML frontmatter block delimited by --- lines, containing exactly these keys:
  date, title, subtitle, summary, tags, itemCount, source, model, generatedAt
- title: max 7 words, lowercase-ish editorial headline, no trailing period.
- subtitle: one clause expanding the title, max 14 words.
- summary: 2 sentences, max 45 words total, describing the day as a whole.
- tags: 2 to 5 short capitalised tags from the actual subject matter.
- itemCount: number of items covered under "Signals".
- source: the literal string "agnes".
- model: the model id provided by the caller.
- generatedAt: the timestamp provided by the caller.

Body structure, in this exact order:

## TL;DR
- 4 to 6 bullets, one line each, each naming a concrete event and why it matters.

## Signals
### 1. <Headline in sentence case>
One or two short paragraphs. Weave in the source name and, when relevant, the exact figure. End the paragraph with a markdown link "[Read more](url)" using the item URL.
Repeat for 6 to 12 items, numbered sequentially.

## By the Numbers
A markdown table with 3 to 5 rows of concrete figures pulled from the items (metric | value | source). Omit the section only if there are no figures at all.

## Sources
- A bullet list of "[Title](url) — Source" for every item you referenced.

Return only the MDX document. No commentary before or after it.`

export const BRIEFING_SYSTEM_PROMPT = `You distil news articles into briefings for "Daily Tech News".

You receive numbered articles, each with its title, source, body text and a "quality" field. Write one briefing per article.

Hard rules:
- Write in English, plain and factual. No hype, no emoji, no marketing language.
- Use only what the supplied text says. Never invent facts, figures, names or quotes.
- summary: 2 to 3 sentences, max 60 words, saying what the article actually reports.
- points: 2 to 3 short bullets carrying what a reader would otherwise miss — figures, dates, product names, who did what. Use an empty array when the text is too thin.
- "quality" tells you how much there is to work with: "article" is real body text, "excerpt" is only a feed summary, "metadata" means the page could not be read at all. For "metadata", write a summary that says the full text could not be read and name the source — never invent a summary from the headline alone.

Return only a JSON array, one object per article, in the same order:
[{"index":1,"summary":"...","points":["...","..."]}]

No commentary before or after the JSON.`

interface BriefingResult {
  summary: string
  points: string[]
}

interface BriefingEntry extends BriefingResult {
  index: number
}

/** Pull the JSON array out of a model reply, tolerating fences and chatter. */
function parseBriefingJson(raw: string): BriefingEntry[] {
  const text = stripCodeFence(raw)
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) {
    throw new Error('briefing response contained no JSON array')
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as unknown
  if (!Array.isArray(parsed)) throw new Error('briefing response was not an array')

  return parsed
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry, position) => ({
      index: Number(entry.index ?? position + 1),
      summary: typeof entry.summary === 'string' ? entry.summary : '',
      points: Array.isArray(entry.points) ? entry.points.map(String) : [],
    }))
    .filter((entry) => entry.summary.trim().length > 0)
}

/**
 * Distil every article in a single request, keyed by URL so the caller can
 * match briefings back to their story without trusting the model's ordering.
 */
export async function distillBriefings(
  drafts: BriefingDraft[],
  promptChars = 2500
): Promise<Map<string, BriefingResult>> {
  const payload = drafts.map((draft) => ({
    index: draft.index,
    title: draft.title,
    source: draft.source,
    url: draft.url,
    // Tells the model when it is looking at a stub rather than an article.
    quality: draft.quality,
    text: draft.text.slice(0, promptChars),
  }))

  const raw = await chat(
    [
      { role: 'system', content: BRIEFING_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    { maxTokens: 4000, temperature: 0.3 }
  )

  const results = new Map<string, BriefingResult>()
  for (const entry of parseBriefingJson(raw)) {
    const draft = drafts.find((candidate) => candidate.index === entry.index)
    if (draft) results.set(draft.url, { summary: entry.summary, points: entry.points })
  }

  if (!results.size) throw new Error('briefing response matched no article')
  return results
}

interface DigestPromptInput {
  date: string
  items: NewsItem[]
  model: string
  generatedAt: string
}

function buildUserPrompt({ date, items, model, generatedAt }: DigestPromptInput): string {
  const catalogue = items
    .map((item, index) => {
      const meta = [item.source]
      if (typeof item.points === 'number') meta.push(`${item.points} points`)
      if (typeof item.comments === 'number') meta.push(`${item.comments} comments`)
      const excerpt = item.excerpt ? `\n    Summary: ${item.excerpt}` : ''
      return `${index + 1}. [${item.source}] ${item.title}\n    URL: ${item.url}\n    Published: ${item.publishedAt} (${meta.join(', ')})${excerpt}`
    })
    .join('\n')

  return `Write the ${date} issue of Daily Tech News.

Context for the frontmatter:
- date: ${date}
- source: agnes
- model: ${model}
- generatedAt: ${generatedAt}
- itemCount: set it to the number of items you write under "Signals".

Here are the ${items.length} real news items published on ${date}:

${catalogue}`
}

/** Ask Agnes to write the MDX issue for a day. Returns the raw MDX document. */
export async function writeDigestMdx(input: DigestPromptInput): Promise<string> {
  const raw = await chat(
    [
      { role: 'system', content: DIGEST_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    { maxTokens: 4000 }
  )

  const cleaned = stripCodeFence(raw)

  // A malformed issue must stop the pipeline rather than reach the archive.
  const validation = assertDigestStructure(cleaned, input.date)
  logger.info(
    { date: input.date, stats: validation.stats },
    'Agnes output passed structural validation'
  )

  return cleaned
}
