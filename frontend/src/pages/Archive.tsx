import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation, useViewTransitionState } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { ArchiveMonth, RowSkeleton, groupByMonth } from '../components/ArchiveMonth'
import { EmptyState } from '../components/EmptyState'
import { IssueRow } from '../components/IssueRow'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useDigestList, useDigestStatus, usePrefetchIssue, useSearchIndex } from '../hooks/useDigests'
import { longDate } from '../lib/dates'
import { preloadIssuePage } from '../lib/routePreload'
import { highlightParts, parseTerms, searchIssues, type SearchHit } from '../lib/search'
import { TILE_NAME, markTile, readStateDate, withMorphicTransition } from '../lib/viewTransition'

type SortMode = 'newest' | 'oldest'

/** Wraps matched runs without ever injecting HTML. */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((part, index) =>
        part.match ? (
          <mark key={index} className="bg-foreground text-background">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  )
}

/** A hit uses the same row shape as the index: meta 1-2, story 3-8. */
function SearchResult({ hit, terms }: { hit: SearchHit; terms: string[] }) {
  const href = `/issue/${hit.entry.date}`
  const prefetchIssue = usePrefetchIssue()
  const location = useLocation()
  const transitioning = useViewTransitionState(location.pathname)
  const landing = transitioning && readStateDate(location.state) === hit.entry.date
  const landingStyle: CSSProperties | undefined = landing
    ? { viewTransitionName: TILE_NAME }
    : undefined

  return (
    <div className="border-b border-border">
      <Link
        to={href}
        viewTransition
        state={{ digest: hit.entry }}
        onClick={(event) => markTile(event.currentTarget)}
        onMouseEnter={() => {
          prefetchIssue(hit.entry.date)
          preloadIssuePage()
        }}
        onFocus={() => {
          prefetchIssue(hit.entry.date)
          preloadIssuePage()
        }}
        className="group relative -mx-3 grid grid-cols-1 gap-4 rounded-xl px-3 py-7 transition-colors duration-200 hover:bg-muted md:-mx-4 md:grid-cols-8 md:gap-6 md:px-4"
      >
        <div className="md:col-span-2">
          <p className="font-mono text-[0.6875rem] tracking-[0.14em] uppercase text-muted-foreground">
            <span className="num">#{hit.entry.issue}</span>
          </p>
          <p className="font-display mt-1 text-lg leading-none">
            {longDate(hit.entry.date).split(', ')[1]}
          </p>
        </div>

        <div className="md:col-span-6 md:col-start-3">
          <h3
            className="font-display text-[clamp(1.25rem,2.5vw,1.75rem)] leading-tight tracking-[-0.02em] decoration-1 underline-offset-[6px] group-hover:underline"
            style={landingStyle}
          >
            <Highlighted text={hit.entry.title} terms={terms} />
          </h3>

          {hit.excerpts.length ? (
            <ul className="mt-3 space-y-2">
              {hit.excerpts.map((excerpt, index) => (
                <li
                  key={index}
                  className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                >
                  <span className="font-mono shrink-0 pt-1 text-[0.625rem] tracking-[0.14em] uppercase">
                    {excerpt.field}
                  </span>
                  <span className="max-w-[68ch]">
                    <Highlighted text={excerpt.text} terms={terms} />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Link>
    </div>
  )
}

/** Underline-from-left ordering switch — the same gesture as the nav. */
function SortOrder({ sort, onSort }: { sort: SortMode; onSort: (mode: SortMode) => void }) {
  const modes: { id: SortMode; label: string }[] = [
    { id: 'newest', label: 'Newest' },
    { id: 'oldest', label: 'Oldest' },
  ]

  return (
    <div>
      <p className="text-kicker text-muted-foreground">Order</p>
      <div className="mt-1 flex gap-4">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onSort(mode.id)}
            className={[
              'group relative cursor-pointer py-1 font-mono text-[0.625rem] tracking-[0.16em] uppercase transition-colors duration-150',
              sort === mode.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {mode.label}
            <span
              aria-hidden="true"
              className={[
                'absolute inset-x-0 bottom-0 h-px origin-left bg-foreground transition-transform duration-200 ease-out',
                sort === mode.id ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
              ].join(' ')}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Archive() {
  const { data: digests, isLoading } = useDigestList()
  const { data: status } = useDigestStatus()
  const { data: searchIndex } = useSearchIndex()
  const [sort, setSort] = useState<SortMode>('newest')
  const [query, setQuery] = useState('')
  // 排序形变进行中：行块带着名字滑移，列表对点击免疫。
  const [sorting, setSorting] = useState(false)

  const terms = useMemo(() => parseTerms(query), [query])
  const hits = useMemo(() => searchIssues(searchIndex, query), [searchIndex, query])
  const searching = terms.length > 0

  const ordered = useMemo(() => {
    const list = [...(digests ?? [])]
    return sort === 'newest' ? list : list.reverse()
  }, [digests, sort])

  const months = useMemo(() => groupByMonth(ordered), [ordered])

  let cursor = 0
  const monthBlocks = months.map((group) => {
    const startIndex = cursor
    cursor += group.items.length
    return { ...group, startIndex }
  })

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader issueMeta={digests?.[0] ?? null} />

      <main className="container">
        <section className="grid-editorial border-b border-border pt-12 pb-10 md:pt-16 md:pb-12">
          <p className="text-kicker col-span-4 text-muted-foreground md:col-span-8 md:row-start-1">
            <span className="num">{digests?.length ?? 0}</span> issues in the archive
          </p>

          <h1 className="font-display col-span-4 mt-5 text-[clamp(3rem,10vw,7rem)] leading-[0.9] tracking-[-0.04em] md:col-span-6 md:col-start-1 md:row-start-2 md:mt-8">
            Archive
          </h1>

          <div className="col-span-4 mt-6 md:col-span-2 md:col-start-7 md:row-start-2 md:mt-1 md:justify-self-end">
            <SortOrder
              sort={sort}
              // 排序切换是一次完整的形变：行块与月份标题带着名字换位，
              // 而不是整页淡出再淡入。形变期间忽略再次点击。
              onSort={(mode) => {
                if (sorting) return
                withMorphicTransition(
                  () => setSorting(true),
                  () => setSort(mode),
                  () => setSorting(false)
                )
              }}
            />
          </div>

          <label className="relative col-span-4 mt-8 block md:col-span-5 md:col-start-1 md:row-start-3 md:mt-10">
            <span className="sr-only">Search the archive</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search headlines, tags and sources"
              className="w-full rounded-full border border-border bg-transparent py-2.5 pr-10 pl-10 font-mono text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-foreground focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-3.5 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </label>
        </section>

        <section className="pt-6">
          {searching ? (
            hits.length ? (
              <div>
                <div className="grid-editorial border-b border-border py-3">
                  <p className="text-kicker col-span-4 text-muted-foreground md:col-span-2">
                    Matches
                  </p>
                  <p className="col-span-4 mt-1 text-sm text-muted-foreground md:col-span-6 md:col-start-3 md:mt-0">
                    <span className="num">{hits.length}</span> issue
                    {hits.length === 1 ? '' : 's'} matched
                  </p>
                </div>
                {hits.map((hit) => (
                  <SearchResult key={hit.entry.date} hit={hit} terms={terms} />
                ))}
              </div>
            ) : (
              <EmptyState kicker="No match">
                Nothing in the archive mentions that yet.
              </EmptyState>
            )
          ) : isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, index) => (
                <RowSkeleton key={index} />
              ))}
            </div>
          ) : !ordered.length ? (
            <EmptyState kicker="Empty archive">Nothing has been filed yet.</EmptyState>
          ) : sort === 'newest' ? (
            <div className={sorting ? 'pointer-events-none' : undefined}>
              {monthBlocks.map((group) => (
                <ArchiveMonth
                  key={group.month}
                  month={group.month}
                  digests={group.items}
                  startIndex={group.startIndex}
                  morphic={sorting}
                />
              ))}
            </div>
          ) : (
            <div className={sorting ? 'pointer-events-none' : undefined}>
              {ordered.map((digest, index) => (
                <IssueRow key={digest.date} digest={digest} index={index} morphic={sorting} />
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter status={status} />
    </div>
  )
}
