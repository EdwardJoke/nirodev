import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container">
        {/* A 404 is a page, not a modal: left origin, deliberate empty column 6. */}
        <section className="grid-editorial border-b border-border py-24 md:py-32">
          <p className="text-kicker col-span-4 text-muted-foreground md:col-span-8 md:row-start-1">
            Error <span className="num">404</span> · Page not found
          </p>

          <h1 className="font-display col-span-4 mt-6 text-[clamp(4rem,16vw,11rem)] leading-[0.82] tracking-[-0.05em] md:col-span-5 md:col-start-1 md:row-start-2 md:mt-8">
            404
          </h1>

          <p className="col-span-4 mt-8 max-w-[46ch] text-[1.0625rem] leading-relaxed text-muted-foreground md:col-span-4 md:col-start-1 md:row-start-3 md:mt-10">
            This page never made it into an issue. The story you are looking for might be in
            the archive.
          </p>

          <div className="col-span-4 mt-8 flex flex-wrap items-center gap-3 md:col-span-5 md:col-start-1 md:row-start-4 md:mt-10">
            <Link
              to="/"
              viewTransition
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-foreground bg-foreground px-5 py-2 font-mono text-[0.6875rem] tracking-[0.16em] uppercase text-background transition-opacity duration-150 hover:opacity-80"
            >
              Read today
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              to="/archive"
              viewTransition
              className="inline-block cursor-pointer rounded-full border border-border px-5 py-2 font-mono text-[0.6875rem] tracking-[0.16em] uppercase transition-colors duration-150 hover:border-foreground"
            >
              Open archive
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

export default NotFound
