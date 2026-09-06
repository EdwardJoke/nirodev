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

export interface Digest extends DigestMeta {
  content: string
}

export interface IssueResponse {
  digest: Digest
  previous: DigestMeta | null
  next: DigestMeta | null
  /** The stored MDX document, shown by the "View MDX source" toggle. */
  mdx: string
}

export interface DigestListResponse {
  total: number
  digests: DigestMeta[]
}

export interface LatestResponse {
  digest: Digest
}

export interface DigestStatus {
  status: string
  timezone: string
  total: number
  latest: string | null
  oldest: string | null
  agnesConfigured: boolean
  model: string
  today: string
  /** `static` when served from pre-built JSON, `api` when a backend is present. */
  mode: string
}
