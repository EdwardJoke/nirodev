import type { CSSProperties } from 'react'
import { Link, useLocation, useViewTransitionState } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { usePrefetchIssue } from '../hooks/useDigests'
import { longDate, weekdayLabel } from '../lib/dates'
import { preloadIssuePage } from '../lib/routePreload'
import { topicHref } from '../lib/topics'
import { TILE_NAME, markTile, readStateDate } from '../lib/viewTransition'
import type { DigestMeta } from '../types/digest'
import { TagPill } from './TagPill'

interface IssueRowProps {
  digest: DigestMeta
  index?: number
  /** 排序形变进行中：整行带着自己的名字滑向新位置。 */
  morphic?: boolean
}

/**
 * One row of the archive index, laid out on the same eight columns as the
 * hero: date in 1-2, story in 3-6, figures in 7-8.
 *
 * The hover state is a rounded chip that bleeds past the text columns, so
 * the grid stays readable while the touch target feels soft.
 *
 * The row takes part in two different transitions:
 * - forward: the link stamps the title with `issue-title` at click time and
 *   the title grows into the destination hero;
 * - reverse: arriving back at a list, the row whose date matches the router
 *   state borrows the same name for one frame, so the hero lands in it;
 * - reorder (morphic): every row wears `row-<date>` for the duration of a
 *   sort transition and the whole set glides to its new position.
 */
export function IssueRow({ digest, index, morphic = false }: IssueRowProps) {
  const href = `/issue/${digest.date}`
  const prefetchIssue = usePrefetchIssue()
  const location = useLocation()
  const transitioning = useViewTransitionState(location.pathname)
  const landing = transitioning && readStateDate(location.state) === digest.date

  const landingStyle: CSSProperties | undefined = landing
    ? { viewTransitionName: TILE_NAME }
    : undefined
  const morphicStyle: CSSProperties | undefined = morphic
    ? { viewTransitionName: `row-${digest.date}` }
    : undefined

  return (
    <div className="border-b border-border" style={morphicStyle}>
      <div className="group relative -mx-3 grid grid-cols-1 gap-4 rounded-xl px-3 py-7 transition-colors duration-200 hover:bg-muted md:-mx-4 md:grid-cols-8 md:gap-6 md:px-4">
        <div className="flex items-baseline gap-3 md:col-span-2 md:block">
          {typeof index === 'number' ? (
            <span className="num text-[0.625rem] md:hidden">
              {String(index + 1).padStart(2, '0')}
            </span>
          ) : null}
          <p className="font-mono text-[0.6875rem] tracking-[0.14em] uppercase text-muted-foreground">
            {weekdayLabel(digest.date)}
          </p>
          <p className="font-display text-xl leading-none md:mt-1">
            {longDate(digest.date).split(', ')[1]}
          </p>
        </div>

        <div className="md:col-span-4 md:col-start-3">
          <h3
            className="font-display text-[clamp(1.5rem,3vw,2.25rem)] leading-tight tracking-[-0.02em]"
            style={landingStyle}
          >
            {/* The ::after overlay makes the whole row the link target without
                nesting anchors, which keeps the tag pills independently clickable.
                Hover prefetches the issue (and its prose renderer) so the
                destination is on screen in the very first frame of the tile
                morph; the row's meta rides along as router state. */}
            <Link
              to={href}
              viewTransition
              state={{ digest }}
              onClick={(event) => markTile(event.currentTarget)}
              onMouseEnter={() => {
                prefetchIssue(digest.date)
                preloadIssuePage()
              }}
              onFocus={() => {
                prefetchIssue(digest.date)
                preloadIssuePage()
              }}
              className="cursor-pointer underline-offset-[6px] decoration-1 after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:underline"
            >
              {digest.title}
            </Link>
          </h3>
          {digest.summary ? (
            <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              {digest.summary}
            </p>
          ) : null}
          {digest.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {digest.tags.slice(0, 4).map((tag) => (
                <TagPill key={tag} label={tag} to={topicHref(tag)} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-4 md:col-span-2 md:col-start-7 md:flex-col md:items-end md:justify-between">
          <span className="font-mono text-[0.625rem] tracking-[0.14em] uppercase text-muted-foreground">
            <span className="num">#{digest.issue}</span>
            {' · '}
            <span className="num">{String(digest.itemCount).padStart(2, '0')}</span> stories
          </span>
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  )
}
