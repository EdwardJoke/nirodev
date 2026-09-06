import { slugifyTag } from './topics'

/** Mirrors the shape written by `backend/src/lib/digest-index.ts`. */

export interface DayStat {
  date: string
  stories: number
  tags: string[]
  sources: Record<string, number>
}

export interface Trends {
  /** One entry per issue, oldest first. */
  days: DayStat[]
  generatedAt: string
}

export interface TrendPoint {
  date: string
  /** 0 or 1 — a tag is either on an issue or it is not. */
  count: number
}

export interface TagTrend {
  label: string
  slug: string
  /** How many issues in the window carried this tag. */
  total: number
  /** Oldest first, one point per date in the window. */
  points: TrendPoint[]
}

export interface SourceCount {
  name: string
  total: number
  /** Share of every source link in the window, 0-1. */
  share: number
}

/** Everything the page draws, recomputed for one time window. */
export interface TrendsView {
  rangeId: string
  /** `null` means "everything in the archive". */
  rangeDays: number | null
  dates: string[]
  days: DayStat[]
  totalIssues: number
  totalStories: number
  totalLinks: number
  tags: TagTrend[]
  sources: SourceCount[]
}

export interface TrendRange {
  id: string
  label: string
  /** Sentence form, e.g. "all time" — used where "last 7 days" would read oddly. */
  blurb: string
  /** `0` means "no limit". */
  days: number
}

export const TREND_RANGES: TrendRange[] = [
  { id: '7d', label: '7 days', blurb: 'the last 7 days', days: 7 },
  { id: '30d', label: '30 days', blurb: 'the last 30 days', days: 30 },
  { id: 'all', label: 'All', blurb: 'all time', days: 0 },
]

export const DEFAULT_TREND_RANGE = TREND_RANGES[0]

/** Keeps the newest `days` entries; `0` keeps everything. */
export function sliceDays(trends: Trends | undefined, days: number): DayStat[] {
  const all = trends?.days ?? []
  if (!days || all.length <= days) return all
  return all.slice(all.length - days)
}

/** Folds a slice of the archive into the series the charts draw. */
export function aggregateTrends(
  trends: Trends | undefined,
  range: TrendRange = DEFAULT_TREND_RANGE
): TrendsView {
  const days = sliceDays(trends, range.days)
  const dates = days.map((day) => day.date)

  const tagsBySlug = new Map<string, TagTrend>()
  for (const day of days) {
    for (const tag of day.tags) {
      const slug = slugifyTag(tag)
      if (!slug) continue
      const entry = tagsBySlug.get(slug) ?? { label: tag, slug, total: 0, points: [] }
      entry.total += 1
      tagsBySlug.set(slug, entry)
    }
  }

  // Backfill so every tag has a point for every date in the window, gaps included.
  for (const day of days) {
    const present = new Set(day.tags.map(slugifyTag))
    for (const entry of tagsBySlug.values()) {
      entry.points.push({ date: day.date, count: present.has(entry.slug) ? 1 : 0 })
    }
  }

  const sourceCounts = new Map<string, number>()
  let totalLinks = 0
  for (const day of days) {
    for (const [name, count] of Object.entries(day.sources)) {
      sourceCounts.set(name, (sourceCounts.get(name) ?? 0) + count)
      totalLinks += count
    }
  }

  const sources: SourceCount[] = [...sourceCounts.entries()]
    .map(([name, total]) => ({ name, total, share: totalLinks ? total / totalLinks : 0 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  return {
    rangeId: range.id,
    rangeDays: range.days || null,
    dates,
    days,
    totalIssues: days.length,
    totalStories: days.reduce((sum, day) => sum + day.stories, 0),
    totalLinks,
    tags: [...tagsBySlug.values()].sort(
      (a, b) => b.total - a.total || a.label.localeCompare(b.label)
    ),
    sources,
  }
}
