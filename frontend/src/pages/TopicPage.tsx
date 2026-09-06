import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArchiveMonth, RowSkeleton, groupByMonth } from '../components/ArchiveMonth'
import { EmptyState } from '../components/EmptyState'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { TagPill } from '../components/TagPill'
import { useDigestList, useDigestStatus } from '../hooks/useDigests'
import { collectTopics, findTopic, topicHref } from '../lib/topics'

export default function TopicPage() {
  const { tag } = useParams<{ tag: string }>()
  const { data: digests, isLoading } = useDigestList()
  const { data: status } = useDigestStatus()

  const issues = digests ?? []
  const topics = useMemo(() => collectTopics(issues), [issues])
  const topic = useMemo(() => findTopic(issues, tag), [issues, tag])

  const months = useMemo(
    () => (topic ? groupByMonth(topic.digests) : []),
    [topic]
  )

  let cursor = 0
  const monthBlocks = months.map((group) => {
    const startIndex = cursor
    cursor += group.items.length
    return { ...group, startIndex }
  })

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader issueMeta={issues[0] ?? null} />

      <main className="container">
        <section className="grid-editorial border-b border-border pt-12 pb-10 md:pt-16 md:pb-12">
          <p className="text-kicker col-span-4 text-muted-foreground md:col-span-8 md:row-start-1">
            {topic ? (
              <>
                Tagged in <span className="num">{topic.digests.length}</span> issue
                {topic.digests.length === 1 ? '' : 's'}
              </>
            ) : (
              'Topic'
            )}
          </p>

          <h1 className="font-display col-span-4 mt-5 text-[clamp(3rem,10vw,7rem)] leading-[0.9] tracking-[-0.04em] md:col-span-6 md:col-start-1 md:row-start-2 md:mt-8">
            {topic?.label ?? 'Unknown topic'}
          </h1>
        </section>

        {topics.length ? (
          <section className="grid-editorial border-b border-border py-8">
            <p className="text-kicker col-span-4 text-muted-foreground md:col-span-2">
              {topics.length} topics
            </p>
            <div className="col-span-4 mt-4 flex flex-wrap gap-1.5 md:col-span-6 md:col-start-3 md:mt-0">
              {topics.map((entry) => (
                <TagPill
                  key={entry.slug}
                  label={entry.label}
                  to={topicHref(entry.label)}
                  active={entry.slug === topic?.slug}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="pt-6">
          {isLoading ? (
            <div>
              {Array.from({ length: 4 }).map((_, index) => (
                <RowSkeleton key={index} />
              ))}
            </div>
          ) : !topic ? (
            <EmptyState
              kicker="Unknown topic"
              action={
                <Link
                  to="/archive"
                  viewTransition
                  className="font-mono inline-block rounded-full border border-border px-4 py-1.5 text-[0.6875rem] tracking-[0.16em] uppercase transition-colors duration-150 hover:border-foreground cursor-pointer"
                >
                  Back to the archive
                </Link>
              }
            >
              No issue carries that tag.
            </EmptyState>
          ) : (
            monthBlocks.map((group) => (
              <ArchiveMonth
                key={group.month}
                month={group.month}
                digests={group.items}
                startIndex={group.startIndex}
              />
            ))
          )}
        </section>
      </main>

      <SiteFooter status={status} />
    </div>
  )
}
