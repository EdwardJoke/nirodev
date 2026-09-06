import { longDate, timeOfDay } from '../lib/dates'
import { topicHref } from '../lib/topics'
import type { DigestMeta } from '../types/digest'
import { TagPill } from './TagPill'

interface IssueHeroProps {
  /** Meta is enough here — the hero renders before the body has loaded. */
  digest: DigestMeta
  eyebrow?: string
  /**
   * Marks the title as the `issue-title` View Transition tile, so a list
   * row can grow into it across the navigation. Only one element per page
   * may carry the name — detail pages set it, index pages never do.
   */
  tile?: boolean
}

/**
 * Left-origin editorial layout: the text runs down columns 1-5, the figures
 * hang in columns 7-8, and column 6 is deliberately left empty. Nothing is
 * centred — the asymmetry is what keeps the page from reading as a template.
 */
export function IssueHero({ digest, eyebrow, tile = false }: IssueHeroProps) {
  return (
    <section className="grid-editorial border-b border-border pt-12 pb-12 md:pt-20 md:pb-16">
      <p className="text-kicker col-span-4 text-muted-foreground md:col-span-8 md:col-start-1 md:row-start-1">
        {eyebrow ?? 'Latest issue'} · <span className="num">{`#${digest.issue}`}</span> ·{' '}
        {longDate(digest.date)}
      </p>

      <h1
        className="font-display col-span-4 mt-6 max-w-[22ch] text-[clamp(2.25rem,6.4vw,4.75rem)] leading-[1.02] tracking-[-0.035em] md:col-span-6 md:col-start-1 md:row-start-2 md:mt-10"
        style={tile ? { viewTransitionName: 'issue-title' } : undefined}
      >
        {digest.title}
      </h1>

      <div className="col-span-4 md:col-span-5 md:col-start-1 md:row-start-3 md:mt-10">
        {digest.subtitle ? (
          <p className="font-display max-w-[48ch] text-[clamp(1.05rem,2.2vw,1.45rem)] leading-snug text-muted-foreground">
            {digest.subtitle}
          </p>
        ) : null}

        <p className="mt-5 max-w-[62ch] text-[1.0625rem] leading-relaxed text-foreground">
          {digest.summary}
        </p>

        {digest.tags.length ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {digest.tags.map((tag) => (
              <TagPill key={tag} label={tag} to={topicHref(tag)} />
            ))}
          </div>
        ) : null}
      </div>

      <dl className="col-span-4 mt-8 flex flex-wrap gap-x-8 gap-y-3 md:col-span-2 md:col-start-7 md:row-start-3 md:mt-10 md:flex-col md:gap-5">
        <div className="md:border-t md:border-border md:pt-2">
          <dt className="font-mono text-[0.625rem] tracking-[0.16em] uppercase text-muted-foreground">
            Stories
          </dt>
          <dd className="num mt-1 text-sm">{String(digest.itemCount).padStart(2, '0')}</dd>
        </div>
        <div className="md:border-t md:border-border md:pt-2">
          <dt className="font-mono text-[0.625rem] tracking-[0.16em] uppercase text-muted-foreground">
            Written by
          </dt>
          <dd className="num mt-1 text-sm">
            {digest.source === 'agnes' ? 'AGNES' : 'LOCAL'}
          </dd>
        </div>
        <div className="md:border-t md:border-border md:pt-2">
          <dt className="font-mono text-[0.625rem] tracking-[0.16em] uppercase text-muted-foreground">
            Filed at
          </dt>
          <dd className="num mt-1 text-sm">{timeOfDay(digest.generatedAt)}</dd>
        </div>
      </dl>
    </section>
  )
}
