/**
 * Flattens a stored MDX issue into fields the frontend can search and chart.
 *
 * The documents follow the structure enforced by `digest-validate.ts`:
 *
 *   ## TL;DR            — bullet list of the day's headlines
 *   ## Signals          — one `### ` subsection per story
 *   ## By the Numbers   — metric lines
 *   ## Sources          — `- [title](url) — outlet`
 *
 * Everything here is forgiving: a section that is missing or shaped slightly
 * differently yields an empty list rather than throwing, because the archive
 * has to keep building even when one issue is unusual.
 */
import type { DigestMeta } from '../types/digest.types'

export interface SearchSource {
  title: string
  url: string
  /** Outlet name as written in the issue, e.g. "Hacker News". */
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

/** Returns the body of a `## <title>` section, heading line excluded. */
export function sectionBody(mdx: string, title: string): string {
  const wanted = title.trim().toLowerCase()
  const collected: string[] = []
  let current = ''

  for (const line of mdx.split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      current = heading[1].trim().toLowerCase()
      continue
    }
    if (current === wanted) {
      collected.push(line)
    }
  }

  return collected.join('\n').trim()
}

function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function extractBullets(section: string): string[] {
  return splitLines(section)
    .filter((line) => line.startsWith('-'))
    .map((line) => line.replace(/^-\s*/, '').trim())
    .filter(Boolean)
}

export function extractSignals(section: string): string[] {
  return splitLines(section)
    .filter((line) => line.startsWith('###'))
    .map((line) =>
      line
        .replace(/^###\s*/, '')
        .replace(/^\d+[.)]\s*/, '')
        .trim()
    )
    .filter(Boolean)
}

/** Matches `- [title](url) — outlet`, tolerating en dash and double hyphen. */
const SOURCE_LINE = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s*(?:—|–|-{1,2})\s*(.+?)\s*$/

export function extractSources(section: string): SearchSource[] {
  const sources: SearchSource[] = []

  for (const line of splitLines(section)) {
    const match = SOURCE_LINE.exec(line)
    if (!match) continue
    sources.push({ title: match[1].trim(), url: match[2].trim(), name: match[3].trim() })
  }

  return sources
}

export function buildSearchEntry(meta: DigestMeta, content: string): SearchEntry {
  return {
    date: meta.date,
    issue: meta.issue,
    title: meta.title,
    subtitle: meta.subtitle,
    summary: meta.summary,
    tags: meta.tags,
    bullets: extractBullets(sectionBody(content, 'TL;DR')),
    signals: extractSignals(sectionBody(content, 'Signals')),
    sources: extractSources(sectionBody(content, 'Sources')),
  }
}

/* -------------------------------------------------------------------------
   Trends
   ------------------------------------------------------------------------- */

/**
 * One issue, kept whole so the browser can re-aggregate any time window
 * (last 7 days, 30 days, everything) without another build.
 */
export interface DayStat {
  date: string
  /** Number of stories written up that day. */
  stories: number
  /** Tag labels carried by the issue. */
  tags: string[]
  /** Outlet name -> how many links it supplied that day. */
  sources: Record<string, number>
}

export interface Trends {
  /** One entry per issue, oldest first. */
  days: DayStat[]
  generatedAt: string
}

/** Packs the archive into per-issue buckets, oldest first. */
export function buildTrends(metas: DigestMeta[], entries: SearchEntry[]): Trends {
  const byDate = new Map(entries.map((entry) => [entry.date, entry]))

  const days: DayStat[] = [...metas]
    .reverse()
    .map((meta) => {
      const entry = byDate.get(meta.date)
      const sources: Record<string, number> = {}

      for (const source of entry?.sources ?? []) {
        const name = source.name || 'Unknown'
        sources[name] = (sources[name] ?? 0) + 1
      }

      return {
        date: meta.date,
        stories: entry?.signals.length ?? 0,
        tags: meta.tags,
        sources,
      }
    })

  return { days, generatedAt: new Date().toISOString() }
}
