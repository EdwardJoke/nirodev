import { logger } from '../config/logger'
import { stripTags } from './html'
import type { NewsItem } from '../types/digest.types'

const RSS_SOURCES: { name: string; url: string }[] = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
]

const USER_AGENT = 'DailyTechNews/1.0 (+https://daily-tech.news)'
const PER_SOURCE_LIMIT = 8
const MAX_ITEMS = 28

async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    })
    if (!response.ok) return null
    return await response.text()
  } catch (error) {
    logger.debug({ err: error, url }, 'source fetch failed')
    return null
  } finally {
    clearTimeout(timer)
  }
}

function tagValue(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return match ? match[1] : ''
}

/** Minimal RSS/Atom reader — enough for the handful of feeds we poll. */
function parseFeed(xml: string, sourceName: string): NewsItem[] {
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? []
  const items: NewsItem[] = []

  for (const block of blocks) {
    const title = stripTags(tagValue(block, 'title'))
    if (!title) continue

    let url = stripTags(tagValue(block, 'link'))
    if (!url) {
      const href = block.match(/<link[^>]*href=["']([^"']+)["']/i)
      url = href ? href[1] : ''
    }
    if (!url) continue

    const rawDate =
      stripTags(tagValue(block, 'pubDate')) ||
      stripTags(tagValue(block, 'updated')) ||
      stripTags(tagValue(block, 'published'))
    const parsed = rawDate ? new Date(rawDate) : new Date()
    if (Number.isNaN(parsed.getTime())) continue

    const excerpt = stripTags(
      tagValue(block, 'description') || tagValue(block, 'summary') || tagValue(block, 'content')
    ).slice(0, 320)

    items.push({
      title,
      url,
      source: sourceName,
      publishedAt: parsed.toISOString(),
      excerpt,
    })
  }

  return items
}

async function collectRss(from: Date, to: Date): Promise<NewsItem[]> {
  const results = await Promise.all(
    RSS_SOURCES.map(async ({ name, url }) => {
      const xml = await fetchText(url)
      if (!xml) return []
      return parseFeed(xml, name)
        .filter((item) => {
          const at = new Date(item.publishedAt).getTime()
          return at >= from.getTime() && at <= to.getTime()
        })
        .slice(0, PER_SOURCE_LIMIT)
    })
  )
  return results.flat()
}

async function collectHackerNews(from: Date, to: Date): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    tags: 'story',
    hitsPerPage: '60',
    numericFilters: `created_at_i>=${Math.floor(from.getTime() / 1000)},created_at_i<=${Math.floor(
      to.getTime() / 1000
    )},points>=25`,
  })
  const xml = await fetchText(`https://hn.algolia.com/api/v1/search_by_date?${params}`)
  if (!xml) return []

  try {
    const payload = JSON.parse(xml) as {
      hits?: {
        title?: string | null
        story_title?: string | null
        url?: string | null
        objectID?: string
        created_at?: string
        points?: number
        num_comments?: number
      }[]
    }
    return (payload.hits ?? [])
      .map((hit) => {
        const title = (hit.title ?? hit.story_title ?? '').trim()
        if (!title) return null
        return {
          title,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          source: 'Hacker News',
          publishedAt: hit.created_at ?? new Date().toISOString(),
          points: hit.points ?? 0,
          comments: hit.num_comments ?? 0,
        } as NewsItem
      })
      .filter((item): item is NewsItem => item !== null)
  } catch (error) {
    logger.warn({ err: error }, 'failed to parse Hacker News payload')
    return []
  }
}

const normaliseTitle = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const byScore = (a: NewsItem, b: NewsItem) => {
  const scoreA = (a.points ?? 0) * 2 + (a.comments ?? 0)
  const scoreB = (b.points ?? 0) * 2 + (b.comments ?? 0)
  if (scoreA !== scoreB) return scoreB - scoreA
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
}

const byRecency = (a: NewsItem, b: NewsItem) =>
  new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()

/**
 * Gather every news item published inside the given UTC window.
 * Editorial feeds and Hacker News are merged in alternating slots so neither
 * crowd can completely push the other out of the issue.
 */
export async function collectNews(from: Date, to: Date): Promise<NewsItem[]> {
  const [editorial, hackerNews] = await Promise.all([collectRss(from, to), collectHackerNews(from, to)])

  const seen = new Set<string>()
  const dedupe = (items: NewsItem[]) =>
    items.filter((item) => {
      const key = normaliseTitle(item.title)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

  const half = Math.ceil(MAX_ITEMS / 2)
  const editorialPicks = dedupe([...editorial].sort(byRecency)).slice(0, half)
  const hnPicks = dedupe([...hackerNews].sort(byScore)).slice(0, half)

  const merged: NewsItem[] = []
  for (let i = 0; i < Math.max(editorialPicks.length, hnPicks.length); i += 1) {
    if (editorialPicks[i]) merged.push(editorialPicks[i])
    if (hnPicks[i]) merged.push(hnPicks[i])
  }

  // Top up with the strongest leftovers when one side came up short.
  const rest = dedupe([
    ...editorialPicks.slice(merged.length / 2),
    ...hnPicks.slice(merged.length / 2),
  ]).sort(byScore)
  for (const item of rest) {
    if (merged.length >= MAX_ITEMS) break
    merged.push(item)
  }

  return merged.slice(0, MAX_ITEMS)
}
