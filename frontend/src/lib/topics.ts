import type { DigestMeta } from '../types/digest'

/** URL-safe form of a tag: "Generative AI" -> "generative-ai". */
export function slugifyTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function topicHref(tag: string): string {
  return `/topic/${slugifyTag(tag)}`
}

export interface Topic {
  /** The tag exactly as it appears in the archive, not the slug. */
  label: string
  slug: string
  /** Newest first, matching the order of the archive index. */
  digests: DigestMeta[]
}

/**
 * Every tag used across the archive, ordered by how often it appears and then
 * alphabetically so the output stays stable between builds.
 */
export function collectTopics(digests: DigestMeta[]): Topic[] {
  const bySlug = new Map<string, Topic>()

  for (const digest of digests) {
    for (const tag of digest.tags) {
      const slug = slugifyTag(tag)
      if (!slug) continue
      const topic = bySlug.get(slug) ?? { label: tag, slug, digests: [] }
      topic.digests.push(digest)
      bySlug.set(slug, topic)
    }
  }

  return [...bySlug.values()].sort(
    (a, b) => b.digests.length - a.digests.length || a.label.localeCompare(b.label)
  )
}

/** Reverse lookup for a route param; returns null when the slug is unknown. */
export function findTopic(digests: DigestMeta[], slug: string | undefined): Topic | null {
  if (!slug) return null
  return collectTopics(digests).find((topic) => topic.slug === slug.toLowerCase()) ?? null
}
