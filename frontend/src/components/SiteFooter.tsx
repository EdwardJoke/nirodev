import { Rss } from 'lucide-react'

interface SiteFooterProps {
  status?: {
    total: number
    oldest: string | null
    latest: string | null
    timezone: string
    agnesConfigured: boolean
    model: string
  }
}

export function SiteFooter({ status }: SiteFooterProps) {
  return (
    <footer className="mt-[var(--void-lg)] border-t border-border">
      <div className="container py-12">
        <div className="grid-editorial">
          <div className="col-span-4 md:col-span-4 md:col-start-1">
            <p className="font-display text-2xl leading-none">Daily Tech News</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              A daily digest of what moved in technology yesterday. Written every night at
              midnight, archived forever.
            </p>
            {/* BASE_URL keeps this correct when the site lives under /<repo>/. */}
            <a
              href={`${import.meta.env.BASE_URL}feed.xml`}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 font-mono text-[0.625rem] tracking-[0.16em] uppercase transition-colors duration-150 hover:border-foreground"
            >
              <Rss className="size-3" />
              Subscribe by RSS
            </a>
          </div>

          {status ? (
            <dl className="col-span-4 mt-8 grid grid-cols-2 gap-x-8 gap-y-3 font-mono text-[0.6875rem] tracking-[0.1em] uppercase md:col-span-3 md:col-start-6 md:mt-0 md:grid-cols-1">
              <div className="md:border-t md:border-border md:pt-2">
                <dt className="text-muted-foreground">Issues</dt>
                <dd className="num mt-1">{status.total}</dd>
              </div>
              <div className="md:border-t md:border-border md:pt-2">
                <dt className="text-muted-foreground">Archive</dt>
                <dd className="mt-1 font-pixel text-[0.6875rem]">
                  {status.oldest ? `${status.oldest} → ${status.latest}` : '—'}
                </dd>
              </div>
              <div className="md:border-t md:border-border md:pt-2">
                <dt className="text-muted-foreground">Writer</dt>
                <dd className="mt-1">{status.agnesConfigured ? status.model : 'local composer'}</dd>
              </div>
              <div className="md:border-t md:border-border md:pt-2">
                <dt className="text-muted-foreground">Timezone</dt>
                <dd className="mt-1">{status.timezone}</dd>
              </div>
            </dl>
          ) : null}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 font-mono text-[0.625rem] tracking-[0.16em] uppercase text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Set in Recursive, Golos UI &amp; Geist Pixel Square</p>
          <p>Sources: Hacker News · TechCrunch · The Verge · Ars Technica · Wired · Engadget</p>
        </div>
      </div>
    </footer>
  )
}
