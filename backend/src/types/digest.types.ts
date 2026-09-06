/** A single raw news item collected from an upstream source. */
export interface NewsItem {
  title: string
  url: string
  source: string
  publishedAt: string
  /** Hacker News score, when available. */
  points?: number
  /** Hacker News comment count, when available. */
  comments?: number
  excerpt?: string
}

/** Metadata stored in the MDX frontmatter of every digest. */
export interface DigestMeta {
  date: string
  title: string
  subtitle: string
  summary: string
  tags: string[]
  itemCount: number
  source: 'agnes' | 'local'
  model: string
  generatedAt: string
  issue: number
}

/** A digest with its MDX body attached. */
export interface Digest extends DigestMeta {
  content: string
}

/** A short, readable briefing distilled from one source article. */
export interface Briefing {
  /** The article the briefing was distilled from — also the section's link. */
  url: string
  title: string
  source: string
  /** `agnes` when the model wrote it, `extract` when taken from the page. */
  mode: 'agnes' | 'extract'
  summary: string
  points: string[]
}

/** How much of the story the briefing could actually read. */
export type TextQuality = 'article' | 'excerpt' | 'metadata'

/** One story handed to the model for distillation. */
export interface BriefingDraft {
  index: number
  title: string
  source: string
  url: string
  /** Article body, or the best available substitute. */
  text: string
  /** Where `text` came from — the model treats a stub differently. */
  quality: TextQuality
}
