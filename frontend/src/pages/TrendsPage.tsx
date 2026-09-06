import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useDigestList, useDigestStatus, useTrends } from '../hooks/useDigests'
import { slugifyTag, topicHref } from '../lib/topics'
import {
  DEFAULT_TREND_RANGE,
  TREND_RANGES,
  aggregateTrends,
  type DayStat,
  type TagTrend,
  type TrendsView,
} from '../lib/trends'
import { withMorphicTransition } from '../lib/viewTransition'

interface BarRowProps {
  label: string
  value: number
  max: number
  /** Overrides the trailing number, e.g. "63%". */
  readout?: string
  to?: string
  title?: string
  /** 区间形变进行中：柱体以自己的名字在窗口之间迁移。 */
  morphic?: boolean
  tileId?: string
}

function BarRow({
  label,
  value,
  max,
  readout,
  to,
  title,
  morphic = false,
  tileId,
}: BarRowProps) {
  // Keep a sliver visible so a single occurrence still reads as a bar.
  const width = max > 0 ? Math.max((value / max) * 100, 1.5) : 0
  const morphicStyle =
    morphic && tileId ? { viewTransitionName: `bar-${tileId}` } : undefined

  return (
    <div
      className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-3 py-1.5 md:grid-cols-[11rem_minmax(0,1fr)_4rem] md:gap-4"
      style={morphicStyle}
    >      {to ? (
        <Link
          to={to}
          className="truncate font-mono text-[0.625rem] tracking-[0.14em] uppercase underline-offset-4 hover:underline"
        >
          {label}
        </Link>
      ) : (
        <span className="truncate font-mono text-[0.625rem] tracking-[0.14em] uppercase">
          {label}
        </span>
      )}

      <span className="block h-3 rounded-full bg-muted">
        <span
          className="block h-3 rounded-full bg-foreground transition-[width] duration-500 ease-out"
          style={{ width: `${width}%` }}
        />
      </span>

      <span className="num text-right text-[0.75rem]" title={title}>
        {readout ?? value}
      </span>
    </div>
  )
}

/** One column per issue: a filled cell means the tag ran that day. */
function TopicTimeline({ view }: { view: TrendsView }) {
  const columns = `7rem repeat(${view.dates.length}, minmax(0, 1fr))`

  return (
    <div className="overflow-x-auto pb-1">
      <div style={{ minWidth: `${Math.max(34, 10 + view.dates.length * 2.2)}rem` }}>
        <div className="grid gap-1" style={{ gridTemplateColumns: columns }}>
          <span />
          {view.dates.map((date) => (
            <span
              key={date}
              className="text-center font-mono text-[0.5rem] tracking-[0.06em] uppercase text-muted-foreground"
            >
              {date.slice(5)}
            </span>
          ))}

          {view.tags.map((tag: TagTrend) => (
            <Fragment key={tag.slug}>
              <Link
                to={topicHref(tag.label)}
                className="truncate py-1 font-mono text-[0.625rem] tracking-[0.14em] uppercase underline-offset-4 hover:underline"
              >
                {tag.label}
              </Link>
              {tag.points.map((point) => (
                <span
                  key={point.date}
                  title={`${tag.label} — ${point.date}${point.count ? '' : ' (not tagged)'}`}
                  className={`h-6 rounded-[4px] transition-colors duration-500 ${
                    point.count ? 'bg-foreground' : 'border border-border'
                  }`}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Greyscale ramp, darkest for the outlet that supplied the most links. */
const MIX_SHADES = [
  'bg-foreground',
  'bg-foreground/[0.72]',
  'bg-foreground/[0.52]',
  'bg-foreground/[0.36]',
  'bg-foreground/[0.22]',
  'bg-foreground/[0.12]',
]

/** Stacked bars: which outlets fed each day's links. */
function DailyMix({ days }: { days: DayStat[] }) {
  const totals = days.map((day) =>
    Object.values(day.sources).reduce((sum, count) => sum + count, 0)
  )
  const max = Math.max(1, ...totals)

  const names = useMemo(() => {
    const counts = new Map<string, number>()
    for (const day of days) {
      for (const [name, count] of Object.entries(day.sources)) {
        counts.set(name, (counts.get(name) ?? 0) + count)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name)
      .slice(0, MIX_SHADES.length)
  }, [days])

  return (
    <div>
      <div className="flex h-32 items-end gap-1.5">
        {days.map((day, index) => {
          const total = totals[index]
          const breakdown = names
            .filter((name) => day.sources[name])
            .map((name) => `${name} ${day.sources[name]}`)
            .join(', ')

          return (
            <div
              key={day.date}
              className="group flex h-full flex-1 flex-col justify-end"
              title={`${day.date} — ${total} links${breakdown ? ` · ${breakdown}` : ''}`}
            >
              <span className="num text-center text-[0.625rem] opacity-0 transition-opacity group-hover:opacity-100">
                {total}
              </span>
              <span
                className="flex flex-col justify-end overflow-hidden rounded-t-[5px] transition-[height] duration-500 ease-out"
                style={{ height: `${(total / max) * 100}%` }}
              >
                {/* 反序渲染：供给最多的来源沉底，符合堆叠图惯例。 */}
                {[...names].reverse().map((name) =>
                  day.sources[name] ? (
                    <span
                      key={name}
                      className={`block transition-[height] duration-500 ease-out ${
                        MIX_SHADES[names.indexOf(name)]
                      }`}
                      style={{ height: `${(day.sources[name] / total) * 100}%` }}
                    />
                  ) : null
                )}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex gap-1.5">
        {days.map((day) => (
          <span
            key={day.date}
            className="flex-1 text-center font-mono text-[0.5rem] tracking-[0.06em] text-muted-foreground"
          >
            {day.date.slice(5)}
          </span>
        ))}
      </div>

      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        {names.map((name) => (
          <li
            key={name}
            className="flex items-center gap-2 font-mono text-[0.625rem] tracking-[0.12em] uppercase text-muted-foreground"
          >
            <span className={`size-2 rounded-full ${MIX_SHADES[names.indexOf(name)]}`} />
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "just now" / "4 min ago" — re-renders on a timer so the label stays honest. */
function useFreshness(stamp: number | undefined): string | null {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 20_000)
    return () => window.clearInterval(id)
  }, [])

  if (!stamp) return null

  const seconds = Math.max(0, Math.round((Date.now() - stamp) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** Underline-from-left range switch, matching the header navigation. */
function RangeSwitch({
  rangeId,
  onPick,
}: {
  rangeId: string
  onPick: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-4">
      {TREND_RANGES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item.id)}
          aria-pressed={item.id === rangeId}
          className={[
            'group relative cursor-pointer py-1 font-mono text-[0.625rem] tracking-[0.16em] uppercase transition-colors duration-150',
            item.id === rangeId
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {item.label}
          <span
            aria-hidden="true"
            className={[
              'absolute inset-x-0 bottom-0 h-px origin-left bg-foreground transition-transform duration-200 ease-out',
              item.id === rangeId ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
            ].join(' ')}
          />
        </button>
      ))}
    </div>
  )
}

/** One analysis block: numbered heading in the margin, chart across the page. */
function ChartSection({
  index,
  title,
  blurb,
  children,
  last = false,
}: {
  index: string
  title: string
  blurb: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <section className={`grid-editorial py-10 ${last ? '' : 'border-b border-border'}`}>
      <div className="col-span-4 md:col-span-3 md:col-start-1">
        <p className="text-kicker text-muted-foreground">
          <span className="num">{index}</span>
        </p>
        <h2 className="font-display mt-2 text-xl leading-tight tracking-[-0.02em] md:text-2xl">
          {title}
        </h2>
        <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
          {blurb}
        </p>
      </div>
      <div className="col-span-4 mt-6 md:col-span-5 md:col-start-4 md:mt-0">{children}</div>
    </section>
  )
}

export default function TrendsPage() {
  const { data: trends, isLoading, isFetching, dataUpdatedAt, refetch } = useTrends()
  const { data: digests } = useDigestList()
  const { data: status } = useDigestStatus()

  const [rangeId, setRangeId] = useState(DEFAULT_TREND_RANGE.id)
  // 区间形变进行中：柱体带着名字迁移，按钮对重复点击免疫。
  const [morphic, setMorphic] = useState(false)
  const range = TREND_RANGES.find((item) => item.id === rangeId) ?? DEFAULT_TREND_RANGE
  const freshness = useFreshness(dataUpdatedAt)

  const view = useMemo(() => aggregateTrends(trends, range), [trends, range])

  const maxTag = view.tags[0]?.total ?? 0
  const maxSource = view.sources[0]?.total ?? 0
  const topSources = useMemo(() => view.sources.slice(0, 8), [view])

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader issueMeta={digests?.[0] ?? null} />

      <main className="container">
        <section className="grid-editorial border-b border-border pt-12 pb-8 md:pt-16">
          <p className="text-kicker col-span-4 text-muted-foreground md:col-span-8 md:row-start-1">
            {trends ? (
              <>
                <span className="num">{view.totalIssues}</span> issues ·{' '}
                <span className="num">{view.totalStories}</span> stories · {range.blurb}
              </>
            ) : (
              'Trends'
            )}
          </p>

          <h1 className="font-display col-span-4 mt-5 text-[clamp(3rem,10vw,7rem)] leading-[0.9] tracking-[-0.04em] md:col-span-6 md:col-start-1 md:row-start-2 md:mt-8">
            Trends
          </h1>

          <p className="col-span-4 mt-6 max-w-[62ch] text-[1.0625rem] leading-relaxed text-muted-foreground md:col-span-5 md:col-start-1 md:row-start-3 md:mt-8">
            What the archive keeps coming back to. A topic that runs every day is a standing
            story; one that appears once was a single day's news.
          </p>

          {/* 控制条横贯整行，压在一条发丝线上。 */}
          <div className="col-span-4 mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-4 md:col-span-8 md:row-start-4">
            {/* 区间切换是一次完整的形变：柱体与行块带着名字在窗口之间迁移，
                而不是整页淡出再淡入。形变期间忽略再次点击。 */}
            <RangeSwitch
              rangeId={rangeId}
              onPick={(id) => {
                if (morphic) return
                withMorphicTransition(
                  () => setMorphic(true),
                  () => setRangeId(id),
                  () => setMorphic(false)
                )
              }}
            />

            <button
              type="button"
              onClick={() => void refetch()}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3.5 py-1.5 font-mono text-[0.625rem] tracking-[0.14em] uppercase text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={`size-3 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Refreshing' : 'Refresh'}
            </button>

            {freshness ? (
              <span className="flex items-center gap-2 font-mono text-[0.625rem] tracking-[0.14em] uppercase text-muted-foreground">
                <span
                  className={`size-1.5 rounded-full bg-foreground ${isFetching ? 'animate-pulse' : ''}`}
                />
                Updated {freshness}
              </span>
            ) : null}
          </div>
        </section>

        {isLoading ? (
          <div className="py-16">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-8 animate-pulse bg-muted" />
            ))}
          </div>
        ) : !trends ? (
          <EmptyState kicker="No data">Trends have not been built yet.</EmptyState>
        ) : view.totalIssues === 0 ? (
          <EmptyState kicker="No data">
            Nothing was published in {range.blurb}.
          </EmptyState>
        ) : (
          <>
            <section className="border-b border-border py-8">
              <dl className="grid-editorial">
                {[
                  { label: 'Issues', value: view.totalIssues },
                  { label: 'Stories', value: view.totalStories },
                  { label: 'Topics', value: view.tags.length },
                  { label: 'Outlets', value: view.sources.length },
                ].map((stat) => (
                  <div key={stat.label} className="col-span-2 border-t border-border pt-3">
                    <dt className="text-kicker text-muted-foreground">{stat.label}</dt>
                    <dd className="num-lg mt-2 text-[clamp(1.75rem,3.5vw,2.75rem)] leading-none">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <ChartSection
              index="01"
              title="Daily source mix"
              blurb="Which outlets fed each day's links, one column per issue."
            >
              <DailyMix days={view.days} />
            </ChartSection>

            <ChartSection
              index="02"
              title="Tag frequency"
              blurb={`How many of the last ${view.totalIssues} issue${
                view.totalIssues === 1 ? '' : 's'
              } carried each tag.`}
            >
              {view.tags.map((tag) => (
                <BarRow
                  key={tag.slug}
                  label={tag.label}
                  value={tag.total}
                  max={maxTag}
                  to={topicHref(tag.label)}
                  title={`${tag.total} of ${view.totalIssues} issues`}
                  morphic={morphic}
                  tileId={`tag-${tag.slug}`}
                />
              ))}
            </ChartSection>

            <ChartSection
              index="03"
              title="When each topic ran"
              blurb="One column per issue, oldest on the left."
            >
              <TopicTimeline view={view} />
            </ChartSection>

            <ChartSection
              index="04"
              title="Where stories come from"
              blurb={`Share of the ${view.totalLinks} links published in this window.`}
              last
            >
              {topSources.map((source) => (
                <BarRow
                  key={source.name}
                  label={source.name}
                  value={source.total}
                  max={maxSource}
                  readout={`${Math.round(source.share * 100)}%`}
                  title={`${source.total} links`}
                  morphic={morphic}
                  tileId={`src-${slugifyTag(source.name)}`}
                />
              ))}
            </ChartSection>
          </>
        )}
      </main>

      <SiteFooter status={status} />
    </div>
  )
}
