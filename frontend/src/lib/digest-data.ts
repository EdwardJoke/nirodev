import type { DigestListResponse, DigestStatus, IssueResponse } from '../types/digest'
import type { SearchIndex } from './search'
import type { Trends } from './trends'

/**
 * The site reads pre-built JSON instead of calling a backend, so the same
 * output runs locally, on GitHub Pages, or on any static host.
 *
 * `BASE_URL` is Vite's public base path — it becomes `/<repo>/` when the site
 * is served from a project subpath, which is what GitHub Pages does.
 */
const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`

async function load<T>(file: string): Promise<T> {
  const response = await fetch(dataUrl(file))
  if (!response.ok) {
    throw new Error(`Could not load ${file} (${response.status})`)
  }
  return (await response.json()) as T
}

export function fetchDigestList(): Promise<DigestListResponse> {
  return load<DigestListResponse>('index.json')
}

export function fetchDigestStatus(): Promise<DigestStatus> {
  return load<DigestStatus>('status.json')
}

export function fetchIssue(date: string): Promise<IssueResponse> {
  return load<IssueResponse>(`issue/${date}.json`)
}

export function fetchSearchIndex(): Promise<SearchIndex> {
  return load<SearchIndex>('search.json')
}

export function fetchTrends(): Promise<Trends> {
  return load<Trends>('trends.json')
}

/** The newest issue, derived from the archive index so it never 404s. */
export async function fetchLatest(): Promise<IssueResponse | null> {
  const { digests } = await fetchDigestList()
  if (!digests.length) return null
  return fetchIssue(digests[0].date)
}
