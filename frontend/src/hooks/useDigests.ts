import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchDigestList,
  fetchDigestStatus,
  fetchIssue,
  fetchLatest,
  fetchSearchIndex,
  fetchTrends,
} from '../lib/digest-data'
import type { DigestMeta, IssueResponse } from '../types/digest'

export const digestKeys = {
  all: ['digests'] as const,
  list: () => [...digestKeys.all, 'list'] as const,
  latest: () => [...digestKeys.all, 'latest'] as const,
  issue: (date: string) => [...digestKeys.all, 'issue', date] as const,
  status: () => [...digestKeys.all, 'status'] as const,
  search: () => [...digestKeys.all, 'search'] as const,
  trends: () => [...digestKeys.all, 'trends'] as const,
}

export function useDigestList() {
  return useQuery({
    queryKey: digestKeys.list(),
    queryFn: async () => {
      const { digests } = await fetchDigestList()
      return digests
    },
  })
}

export function useLatestDigest() {
  return useQuery({
    queryKey: digestKeys.latest(),
    queryFn: async () => {
      const issue = await fetchLatest()
      return issue?.digest ?? null
    },
  })
}

export function useIssue(date: string | undefined) {
  return useQuery<IssueResponse>({
    queryKey: digestKeys.issue(date ?? 'unknown'),
    enabled: Boolean(date),
    queryFn: () => fetchIssue(date as string),
  })
}

/**
 * Warms the issue cache on pointer/focus intent. The View Transition tile
 * needs the destination hero to exist in the first new frame — a prefetch
 * that starts on hover is usually finished by the time the click lands.
 */
export function usePrefetchIssue() {
  const client = useQueryClient()
  return (date: string) =>
    void client.prefetchQuery({
      queryKey: digestKeys.issue(date),
      queryFn: () => fetchIssue(date),
      staleTime: 60_000,
    })
}

export function useDigestStatus() {
  return useQuery({
    queryKey: digestKeys.status(),
    queryFn: fetchDigestStatus,
  })
}

export function useSearchIndex() {
  return useQuery({
    queryKey: digestKeys.search(),
    queryFn: fetchSearchIndex,
  })
}

/**
 * Trends poll on their own: the daily build drops a new `trends.json`, and
 * the page picks it up within a minute without a reload.
 */
const TRENDS_POLL_MS = 60_000

export function useTrends() {
  return useQuery({
    queryKey: digestKeys.trends(),
    queryFn: fetchTrends,
    refetchInterval: TRENDS_POLL_MS,
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  })
}

export type { DigestMeta }
