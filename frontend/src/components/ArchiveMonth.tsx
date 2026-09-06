import type { CSSProperties } from 'react'
import { monthKey, monthLabel } from '../lib/dates'
import type { DigestMeta } from '../types/digest'
import { IssueRow } from './IssueRow'

interface ArchiveMonthProps {
  month: string
  digests: DigestMeta[]
  startIndex: number
  /** 排序形变进行中：月份标题带着名字与行块一起换位。 */
  morphic?: boolean
}

/**
 * A month divider sits on the same eight columns as everything else:
 * the label takes 1-4, the count hangs in 7-8, and 5-6 stay empty.
 */
export function ArchiveMonth({ month, digests, startIndex, morphic = false }: ArchiveMonthProps) {
  const morphicStyle: CSSProperties | undefined = morphic
    ? { viewTransitionName: `month-${month}` }
    : undefined

  return (
    <section className="mt-[var(--void-md)] first:mt-0">
      <div className="grid-editorial items-baseline border-b border-border pb-2" style={morphicStyle}>
        <h2 className="font-display col-span-3 text-2xl tracking-[-0.02em] md:col-span-4">
          {monthLabel(`${month}-01`)}
        </h2>
        <p className="col-span-1 text-right text-kicker text-muted-foreground md:col-span-2 md:col-start-7">
          <span className="num">{String(digests.length).padStart(2, '0')}</span>{' '}
          {digests.length === 1 ? 'issue' : 'issues'}
        </p>
      </div>

      <div>
        {digests.map((digest, index) => (
          <IssueRow
            key={digest.date}
            digest={digest}
            index={startIndex + index}
            morphic={morphic}
          />
        ))}
      </div>
    </section>
  )
}

/** Loading rows shaped like the real thing, so the swap barely registers. */
export function RowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-4 border-b border-border py-7 md:grid-cols-8 md:gap-6"
    >
      <div className="md:col-span-2">
        <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
        <div className="mt-2 h-5 w-32 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="md:col-span-4 md:col-start-3">
        <div className="h-7 w-4/5 animate-pulse rounded-full bg-muted" />
        <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-muted" />
        <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="hidden md:col-span-2 md:col-start-7 md:block">
        <div className="ml-auto h-3 w-16 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  )
}

/** Group an ordered digest list into consecutive month buckets. */
export function groupByMonth(digests: DigestMeta[]): { month: string; items: DigestMeta[] }[] {
  const groups: { month: string; items: DigestMeta[] }[] = []
  for (const digest of digests) {
    const key = monthKey(digest.date)
    const last = groups[groups.length - 1]
    if (last && last.month === key) last.items.push(digest)
    else groups.push({ month: key, items: [digest] })
  }
  return groups
}
