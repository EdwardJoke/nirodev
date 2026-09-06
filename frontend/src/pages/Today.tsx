import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { FadeIn, Stagger } from '../components/MotionPrimitives'
import { IssueHero } from '../components/IssueHero'
import { IssueRow } from '../components/IssueRow'
import { MdxBody } from '../components/MdxBody'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useDigestList, useDigestStatus, useLatestDigest } from '../hooks/useDigests'

export default function Today() {
  const { data: latest, isLoading, isError } = useLatestDigest()
  const { data: all } = useDigestList()
  const { data: status } = useDigestStatus()

  const earlier = all?.filter((item) => item.date !== latest?.date).slice(0, 5) ?? []

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader issueMeta={latest} />

      <main className="container">
        {isLoading ? (
          <div className="grid-editorial pt-16">
            <div className="col-span-4 md:col-span-5">
              <div className="h-3 w-64 animate-pulse rounded-full bg-muted" />
              <div className="mt-8 h-16 w-full animate-pulse rounded-xl bg-muted" />
              <div className="mt-3 h-16 w-3/4 animate-pulse rounded-xl bg-muted" />
              <div className="mt-12 h-64 w-full animate-pulse rounded-xl bg-muted" />
            </div>
          </div>
        ) : isError || !latest ? (
          <div className="grid-editorial py-24">
            <div className="col-span-4 md:col-span-5">
              <p className="text-kicker text-muted-foreground">No issue yet</p>
              <h1 className="font-display mt-5 text-[clamp(2rem,6vw,4rem)] leading-none tracking-[-0.03em]">
                The first issue is being written
              </h1>
              <p className="mt-5 max-w-md text-muted-foreground">
                The archive fills itself every night at midnight. Come back at 00:00
                (Asia/Shanghai) for the first edition.
              </p>
            </div>
          </div>
        ) : (
          <>
            <FadeIn>
              <IssueHero digest={latest} eyebrow="Yesterday in tech" />
            </FadeIn>

            {/* 正文靠左五栏，右侧三栏留白——不做居中。 */}
            <article className="grid-editorial py-12 md:py-16">
              <div className="col-span-4 md:col-span-5 md:col-start-1">
                <MdxBody content={latest.content} />
              </div>
            </article>

            {earlier.length ? (
              // 章节之间留一整段空白，这是节奏，不是空隙。
              <section className="mt-[var(--void-lg)] border-t border-border pt-12">
                <div className="grid-editorial items-baseline">
                  <h2 className="font-display col-span-4 text-2xl tracking-[-0.02em] md:col-span-3 md:col-start-1">
                    Earlier issues
                  </h2>
                  <Link
                    to="/archive"
                    className="group col-span-4 mt-3 inline-flex items-center gap-1.5 font-mono text-[0.6875rem] tracking-[0.16em] uppercase text-muted-foreground transition-colors duration-150 hover:text-foreground md:col-span-2 md:col-start-7 md:mt-0 md:justify-self-end"
                  >
                    Full archive
                    <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                </div>

                <div className="mt-2">
                  <Stagger stagger={0.06}>
                    {earlier.map((digest, index) => (
                      <IssueRow key={digest.date} digest={digest} index={index} />
                    ))}
                  </Stagger>
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>

      <SiteFooter status={status} />
    </div>
  )
}
