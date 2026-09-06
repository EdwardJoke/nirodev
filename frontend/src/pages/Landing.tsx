import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { FadeIn, Stagger } from '../components/MotionPrimitives'
import { ShaderHero } from '../components/ShaderHero'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useDigestList, useDigestStatus, useLatestDigest } from '../hooks/useDigests'

/** 三个入口卡片：日报、存档、趋势。 */
const ENTRY_CARDS = [
  {
    index: '01',
    to: '/today',
    title: 'The daily digest',
    copy: 'Every story that moved yesterday, briefed in five minutes — signals, numbers, sources.',
  },
  {
    index: '02',
    to: '/archive',
    title: 'The archive',
    copy: 'Every issue since day one, month by month. Search across headlines in one keystroke.',
  },
  {
    index: '03',
    to: '/trends',
    title: 'The trend desk',
    copy: 'What is rising across sources and topics — week and month windows, ranked.',
  },
] as const

export default function Landing() {
  const { data: latest } = useLatestDigest()
  const { data: all } = useDigestList()
  const { data: status } = useDigestStatus()

  const issueCount = all?.length ?? 0
  const topicCount = new Set((all ?? []).flatMap((item) => item.tags ?? [])).size

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader issueMeta={latest} />

      <main>
        {/* 主视觉：单色几何场（WebGPU shader，无则 CSS 兜底）。
            排版左压，右侧让位给几何圆盘。 */}
        <section className="relative flex min-h-[86svh] items-center overflow-hidden border-b border-border">
          {/* 层序：几何场最底 → 纸面纱护住排版 → 内容最上。
              三者同为定位元素，按 DOM 顺序天然成层，不引入负 z-index
              （负值会掉到页面不透明背景之后——首拍审计抓到的正是这个）。 */}
          <ShaderHero className="absolute inset-0 h-full w-full" />
          <div className="geo-veil" aria-hidden="true" />

          <div className="container w-full py-20 md:py-28">
            <div className="grid-editorial">
              <div className="col-span-4 md:col-span-5">
                <FadeIn>
                  <p className="text-kicker text-muted-foreground">
                    {latest
                      ? `Issue #${latest.issue} · ${latest.date} · published 00:00 CST`
                      : 'Auto-published daily at 00:00 · Asia/Shanghai'}
                  </p>
                </FadeIn>

                <FadeIn delay={80}>
                  <h1 className="font-display mt-6 text-[clamp(2.75rem,8vw,6.75rem)] leading-[0.95] tracking-[-0.035em]">
                    Yesterday in tech,
                    <br />
                    read in five minutes.
                  </h1>
                </FadeIn>

                <FadeIn delay={160}>
                  <p className="mt-7 max-w-md text-[1.0625rem] leading-relaxed text-muted-foreground">
                    One issue every midnight: the stories that moved, the numbers
                    behind them, and the signals worth watching. No feed, no noise.
                  </p>
                </FadeIn>

                <FadeIn delay={240}>
                  <div className="mt-10 flex flex-wrap items-center gap-3">
                    <Link
                      to="/today"
                      viewTransition
                      className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-background transition-transform duration-150 hover:-translate-y-0.5"
                    >
                      {latest ? `Read issue #${latest.issue}` : 'Read today'}
                      <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                      to="/archive"
                      viewTransition
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-6 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] transition-colors duration-150 hover:border-foreground"
                    >
                      Browse the archive
                    </Link>
                  </div>
                </FadeIn>

                <FadeIn delay={320}>
                  <dl className="mt-16 flex flex-wrap gap-x-10 gap-y-3 border-t border-border pt-6 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground md:mt-24">
                    <div className="flex items-baseline gap-2">
                      <dt>Issues</dt>
                      <dd className="num text-[0.8125rem] text-foreground">{issueCount}</dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <dt>Topics</dt>
                      <dd className="num text-[0.8125rem] text-foreground">{topicCount}</dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <dt>Cadence</dt>
                      <dd className="text-[0.8125rem] text-foreground">daily · 00:00 CST</dd>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <dt>Runtime</dt>
                      <dd className="text-[0.8125rem] text-foreground">webgpu · 60fps</dd>
                    </div>
                  </dl>
                </FadeIn>
              </div>
            </div>
          </div>
        </section>

        {/* 三个入口。 */}
        <section className="container py-16 md:py-24">
          <div className="grid-editorial items-baseline">
            <h2 className="font-display col-span-4 text-2xl tracking-[-0.02em] md:col-span-3 md:col-start-1">
              What&rsquo;s inside
            </h2>
            <p className="col-span-4 mt-2 text-sm text-muted-foreground md:col-span-2 md:col-start-7 md:mt-0 md:justify-self-end">
              Three ways in. All signal.
            </p>
          </div>

          <Stagger stagger={0.08} className="mt-8 grid gap-4 md:grid-cols-3">
            {ENTRY_CARDS.map((card) => (
              <Link
                key={card.to}
                to={card.to}
                viewTransition
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors duration-200 hover:border-foreground"
              >
                <span className="num text-[0.6875rem] tracking-[0.16em] text-muted-foreground">
                  {card.index}
                </span>
                <span className="font-display mt-6 text-xl tracking-[-0.02em]">
                  {card.title}
                </span>
                <span className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {card.copy}
                </span>
                <ArrowUpRight className="mt-8 size-4 self-end text-muted-foreground transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            ))}
          </Stagger>
        </section>

        {/* 最新一期横幅。 */}
        {latest ? (
          <section className="container pb-20 md:pb-28">
            <FadeIn>
              <Link
                to="/today"
                viewTransition
                className="group flex flex-col gap-5 rounded-2xl border border-border p-8 transition-colors duration-200 hover:border-foreground md:flex-row md:items-center md:justify-between md:p-10"
              >
                <div>
                  <p className="text-kicker text-muted-foreground">
                    Tonight at midnight, a new issue lands automatically
                  </p>
                  <p className="font-display mt-3 text-2xl tracking-[-0.02em] md:text-3xl">
                    {latest.title}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-border px-5 py-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] transition-colors duration-150 group-hover:border-foreground md:self-center">
                  Read issue #{latest.issue}
                  <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </FadeIn>
          </section>
        ) : null}
      </main>

      <SiteFooter status={status} />
    </div>
  )
}
