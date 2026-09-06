/**
 * Client-side search over the archive.
 *
 * The whole index is a few hundred kilobytes at most, so it ships as one JSON
 * file and matching happens in the browser — no search service, no API route,
 * and it keeps working on a static host like GitHub Pages.
 */

export interface SearchSource {
  title: string
  url: string
  name: string
}

export interface SearchEntry {
  date: string
  issue: number
  title: string
  subtitle: string
  summary: string
  tags: string[]
  /** TL;DR lines. */
  bullets: string[]
  /** Story headings from the Signals section. */
  signals: string[]
  sources: SearchSource[]
}

export interface SearchIndex {
  total: number
  generatedAt: string
  entries: SearchEntry[]
}

export interface SearchExcerpt {
  /** Which part of the issue matched, e.g. "TL;DR". */
  field: string
  text: string
}

export interface SearchHit {
  entry: SearchEntry
  score: number
  excerpts: SearchExcerpt[]
}

/** Lowercase terms. Single characters are dropped as they match too much. */
export function parseTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Splits text into alternating unmatched / matched runs so the UI can wrap
 * the matched parts without dangerously setting HTML.
 */
export function highlightParts(
  text: string,
  terms: string[]
): { text: string; match: boolean }[] {
  if (!terms.length) return [{ text, match: false }]

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  const lowered = terms.map((term) => term.toLowerCase())

  return text
    .split(pattern)
    .filter((chunk) => chunk !== '')
    .map((chunk) => ({ text: chunk, match: lowered.includes(chunk.toLowerCase()) }))
}

/** Every term must appear; returns 0 when the field does not qualify. */
function scoreText(text: string, terms: string[], weight: number): number {
  const haystack = text.toLowerCase()
  if (!terms.every((term) => haystack.includes(term))) return 0

  const occurrences = terms.reduce(
    (sum, term) => sum + haystack.split(term).length - 1,
    0
  )
  // The first hit is worth the full weight; repeats add a small bonus only.
  return weight + Math.min(occurrences - terms.length, 3) * 0.1
}

function scoreEntry(entry: SearchEntry, terms: string[]): number {
  let score = 0

  score += scoreText(entry.title, terms, 10)
  score += scoreText(entry.tags.join(' '), terms, 6)
  score += scoreText(entry.signals.join(' '), terms, 5)
  score += scoreText(entry.subtitle, terms, 4)
  score += scoreText(entry.bullets.join(' '), terms, 4)
  score += scoreText(entry.sources.map((source) => source.name).join(' '), terms, 3)
  score += scoreText(entry.sources.map((source) => source.title).join(' '), terms, 3)
  // Lets a search for "lwn.net" or "engadget.com" find the issue too.
  score += scoreText(entry.sources.map((source) => source.url).join(' '), terms, 2)
  score += scoreText(entry.summary, terms, 2)

  return score
}

/** Up to three lines that show why an issue matched. */
function collectExcerpts(entry: SearchEntry, terms: string[]): SearchExcerpt[] {
  const excerpts: SearchExcerpt[] = []

  const consider = (field: string, texts: string[]) => {
    for (const text of texts) {
      if (excerpts.length >= 3) return
      const haystack = text.toLowerCase()
      if (terms.every((term) => haystack.includes(term))) {
        excerpts.push({ field, text })
      }
    }
  }

  consider('Signals', entry.signals)
  consider('TL;DR', entry.bullets)
  consider('Sources', entry.sources.map((source) => source.title))

  return excerpts
}

export function searchIssues(index: SearchIndex | null | undefined, query: string): SearchHit[] {
  if (!index) return []

  const terms = parseTerms(query)
  if (!terms.length) return []

  const hits: SearchHit[] = []

  for (const entry of index.entries) {
    const score = scoreEntry(entry, terms)
    if (score <= 0) continue
    hits.push({ entry, score, excerpts: collectExcerpts(entry, terms) })
  }

  // Best match first; ties fall back to the newer issue.
  return hits.sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date))
}
