import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, FileCode2 } from 'lucide-react'
import { IssueHero } from '../components/IssueHero'
import { MdxBody } from '../components/MdxBody'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useDigestStatus, useIssue, usePrefetchIssue } from '../hooks/useDigests'
import { longDate } from '../lib/dates'
import { markTile } from '../lib/viewTransition'
import type { DigestMeta } from '../types/digest'

/** Rows hand their meta over as router state, so the hero never waits. */
function readStateDigest(state: unknown): DigestMeta | null {
  if (state && typeof state === 'object' && 'digest' in state) {
    return (state as { digest: DigestMeta }).digest ?? null
  }
  return null
}

function ProseSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
      <div className="h-4 w-11/12 animate-pulse rounded-full bg-muted" />
      <div className="h-4 w-4/5 animate-pulse rounded-full bg-muted" />
      <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
    </div>
  )
}

export default function IssuePage() {
  const { date } = useParams<{ date: string }>()
  const location = useLocation()
  const { data, isLoading, isError } = useIssue(date)
  const { data: status } = useDigestStatus()
  const prefetchIssue = usePrefetchIssue()
  const [showRaw, setShowRaw] = useState(false)

  const digest = data?.digest
  const initial = readStateDigest(location.state)
  // 局部常量让类型收窄在回调里依然成立
  const prev = data?.previous ?? null
  const next = data?.next ?? null

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader issueMeta={digest ?? initial} />

      <main className="container">
        {isLoading ? (
          initial ? (
            // 列表带来的元数据让 hero 在第一帧就完整存在——
            // 瓷砖形变因此有着落点，正文随后悄悄补齐。
            <>
              <IssueHero digest={initial} eyebrow="Issue" tile />
              <article className="grid-editorial py-12 md:py-16">
                <div className="col-span-4 md:col-span-5 md:col-start-1">
                  <ProseSkeleton />
                </div>
              </article>
            </>
          ) : (
            <div className="grid-editorial py-16">
              <div className="col-span-4 md:col-span-6">
                <div className="h-3 w-64 animate-pulse rounded-full bg-muted" />
                <div className="mt-8 h-16 w-full animate-pulse rounded-xl bg-muted" />
                <div className="mt-12 h-64 w-full animate-pulse rounded-xl bg-muted" />
              </div>
            </div>
          )
        ) : isError || !digest ? (
          <div className="grid-editorial py-24">
            <p className="text-kicker col-span-4 text-muted-foreground md:col-span-2">
              Not found
            </p>
            <div className="col-span-4 mt-4 md:col-span-5 md:col-start-3 md:mt-0">
              <h1 className="font-display text-[clamp(2rem,6vw,4rem)] leading-none tracking-[-0.03em]">
                No issue filed for {date}
              </h1>
              <Link
                to="/archive"
                viewTransition
                className="mt-8 inline-block cursor-pointer rounded-full border border-border px-4 py-2 font-mono text-[0.6875rem] tracking-[0.16em] uppercase transition-colors duration-150 hover:border-foreground"
              >
                Browse the archive
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Hero 一帧到位，不做渐显——它就是这次转场的落点。 */}
            <IssueHero digest={digest} eyebrow="Issue" tile />

            <article className="grid-editorial py-12 md:py-16">
              <div className="col-span-4 md:col-span-5 md:col-start-1">
                {/* 到手即渲染：转场落点页的正文不在形变中途停在骨架上。 */}
                <MdxBody content={digest.content} eager />
              </div>

              <div className="col-span-4 mt-12 md:col-span-5 md:col-start-1">
                <button
                  type="button"
                  onClick={() => setShowRaw((value) => !value)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-transparent px-3 py-1.5 font-mono text-[0.625rem] tracking-[0.16em] uppercase text-muted-foreground transition-colors duration-150 hover:border-border hover:text-foreground"
                >
                  <FileCode2 className="size-3.5" />
                  {showRaw ? 'Hide MDX source' : 'View MDX source'}
                </button>

                {showRaw ? (
                  <pre className="mt-4 max-h-[32rem] overflow-auto rounded-xl border border-border bg-muted p-4 font-mono text-xs leading-relaxed">
                    {data?.mdx ?? 'No source available'}
                  </pre>
                ) : null}
              </div>
            </article>

            {/* 上一期占 1-4，下一期占 5-8 —— 往前的路窄，往后的路宽。 */}
            <nav className="grid border-t border-border md:grid-cols-8">
              {prev ? (
                <Link
                  to={`/issue/${prev.date}`}
                  viewTransition
                  state={{ digest: prev }}
                  onClick={(event) => markTile(event.currentTarget)}
                  onMouseEnter={() => prefetchIssue(prev.date)}
                  className="group -mx-3 rounded-xl border-b border-border px-3 py-7 transition-colors duration-150 hover:bg-muted md:col-span-4 md:mx-0 md:rounded-r-none md:border-b-0 md:pr-6 md:pl-4"
                >
                  <span className="inline-flex items-center gap-2 font-mono text-[0.625rem] tracking-[0.16em] uppercase text-muted-foreground">
                    <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                    Previous issue
                  </span>
                  <p className="font-display mt-3 text-xl leading-tight">{prev.title}</p>
                  <p className="font-mono mt-1 text-[0.625rem] tracking-[0.14em] uppercase text-muted-foreground">
                    {longDate(prev.date)}
                  </p>
                </Link>
              ) : (
                <div className="border-b border-border py-7 md:col-span-4 md:border-b-0 md:pr-6 md:pl-4">
                  <span className="font-mono text-[0.625rem] tracking-[0.16em] uppercase text-muted-foreground">
                    Start of archive
                  </span>
                </div>
              )}

              {next ? (
                <Link
                  to={`/issue/${next.date}`}
                  viewTransition
                  state={{ digest: next }}
                  onClick={(event) => markTile(event.currentTarget)}
                  onMouseEnter={() => prefetchIssue(next.date)}
                  className="group -mx-3 rounded-xl px-3 py-7 transition-colors duration-150 hover:bg-muted md:col-span-4 md:mx-0 md:rounded-l-none md:border-l md:border-border md:pl-6 md:pr-4"
                >
                  <span className="inline-flex items-center gap-2 font-mono text-[0.625rem] tracking-[0.16em] uppercase text-muted-foreground">
                    Next issue
                    <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                  <p className="font-display mt-3 text-xl leading-tight">{next.title}</p>
                  <p className="font-mono mt-1 text-[0.625rem] tracking-[0.14em] uppercase text-muted-foreground">
                    {longDate(next.date)}
                  </p>
                </Link>
              ) : (
                <div className="py-7 md:col-span-4 md:border-l md:border-border md:pl-6 md:pr-4">
                  <span className="font-mono text-[0.625rem] tracking-[0.16em] uppercase text-muted-foreground">
                    Latest issue
                  </span>
                </div>
              )}
            </nav>
          </>
        )}
      </main>

      <SiteFooter status={status} />
    </div>
  )
}
