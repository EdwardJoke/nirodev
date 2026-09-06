import { env } from '../config/env'
import { logger } from '../config/logger'
import { removeElements, stripTags } from './html'

/**
 * Reads the source article behind a news item so the briefing can be distilled
 * from the real piece instead of the one-line feed summary.
 *
 * Deliberately dependency-free: news sites are messy and a robust-enough
 * heuristic keeps the generator installable with no extra packages.
 */

const USER_AGENT = 'DailyTechNews/1.0 (+https://daily-tech.news)'
/** Refuse absurdly large pages rather than pulling them into memory. */
const MAX_HTML_CHARS = 2_000_000
/** Chrome, cookie banners and navigation carry no article text. */
const DROP_TAGS = [
  'script',
  'style',
  'noscript',
  'svg',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'iframe',
  'button',
  'select',
  'template',
  'figure',
]
/** Shorter fragments are captions, bylines or promos rather than body copy. */
const MIN_BLOCK_CHARS = 40

export interface ArticleText {
  url: string
  text: string
  ok: boolean
  reason?: string
}

/** Pull the readable text out of an HTML document. */
export function extractArticleText(html: string, maxChars: number): string {
  const cleaned = removeElements(html.slice(0, MAX_HTML_CHARS), DROP_TAGS)

  const container =
    cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/i)?.[1] ??
    cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1] ??
    cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ??
    cleaned

  const blocks = [...container.matchAll(/<(p|h2|h3|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)]
    .map((match) => stripTags(match[2]))
    .filter((text) => text.length >= MIN_BLOCK_CHARS)

  const seen = new Set<string>()
  const paragraphs = blocks.filter((text) => {
    if (seen.has(text)) return false
    seen.add(text)
    return true
  })

  if (paragraphs.length) return truncate(paragraphs.join('\n\n'), maxChars)

  // Pages rendered in the browser may ship no body copy at all. The site's own
  // summary is still far better than nothing.
  const description = readMetaDescription(cleaned)
  if (description) return truncate(description, maxChars)

  return truncate(stripTags(container), maxChars)
}

/** Open Graph description, falling back to the plain meta description. */
function readMetaDescription(html: string): string {
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ]

  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1]
    if (value) {
      const text = stripTags(value)
      if (text.length >= MIN_BLOCK_CHARS) return text
    }
  }

  return ''
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const slice = text.slice(0, maxChars)
  const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '))
  return `${slice.slice(0, lastBreak > maxChars * 0.6 ? lastBreak : maxChars).trimEnd()}…`
}

/** Fetch one article and return its readable text. */
export async function fetchArticleText(
  url: string,
  timeoutMs = env.BRIEFING_TIMEOUT_MS
): Promise<ArticleText> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!response.ok) return { url, text: '', ok: false, reason: `HTTP ${response.status}` }

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType && !/html|text\/plain/i.test(contentType)) {
      return { url, text: '', ok: false, reason: `unsupported content-type ${contentType}` }
    }

    const html = await response.text()
    const text = extractArticleText(html, env.BRIEFING_MAX_CHARS)
    if (!text) return { url, text: '', ok: false, reason: 'no readable text found' }

    return { url, text, ok: true }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    logger.debug({ err: error, url }, 'article fetch failed')
    return { url, text: '', ok: false, reason }
  } finally {
    clearTimeout(timer)
  }
}

/** Read many articles with a small concurrency limit. */
export async function readArticles(urls: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  const queue = [...new Set(urls)]
  const workers = Array.from({ length: Math.max(1, env.BRIEFING_CONCURRENCY) }, async () => {
    while (queue.length) {
      const url = queue.shift()
      if (!url) return
      const article = await fetchArticleText(url)
      if (article.ok) results.set(url, article.text)
    }
  })

  await Promise.all(workers)
  return results
}
