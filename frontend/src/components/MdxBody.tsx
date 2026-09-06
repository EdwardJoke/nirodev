import { lazy, Suspense } from 'react'
import { splitBriefingBlocks } from '@/lib/briefing-blocks'
import { useInView } from '@/hooks/useInView'
import { Briefing } from './Briefing'

// The markdown pipeline is heavy and only matters once prose is on screen,
// so it is fetched on demand rather than shipped with the landing route.
const MarkdownProse = lazy(() => import('./MarkdownProse'))

interface MdxBodyProps {
  content: string
  className?: string
  /**
   * 到手即渲染，不等视口。瓷砖转场的落点页用它：读者是专程点进来的，
   * 正文不该在形变中途还停留在骨架上。
   */
  eager?: boolean
}

/** Holds the prose rhythm for the moment the renderer chunk is in flight. */
function ProseFallback() {
  return (
    <div className="dtx-prose-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  )
}

/**
 * Waits until the reader is within a screen of the prose before pulling the
 * renderer chunk. Landing on the homepage no longer pays for a component the
 * fold may never reach; scrolling to it costs one extra request that resolves
 * well before the text arrives. `eager` skips the gate — the issue page pairs
 * it with hover preloading, so the chunk is local memory before the click.
 */
function DeferredProse({ text, eager = false }: { text: string; eager?: boolean }) {
  const [ref, near] = useInView<HTMLDivElement>({ rootMargin: '600px' })

  const prose = (
    <Suspense fallback={<ProseFallback />}>
      <MarkdownProse>{text}</MarkdownProse>
    </Suspense>
  )

  if (eager) {
    return <div>{prose}</div>
  }

  return <div ref={ref}>{near ? prose : <ProseFallback />}</div>
}

/**
 * Renders the stored MDX issue as typography-driven HTML.
 * The generated documents stay within the standard markdown + GFM subset,
 * so a markdown pipeline is enough and keeps the bundle light.
 *
 * `:::brief` blocks are lifted out first and rendered as disclosures.
 */
export function MdxBody({ content, className = '', eager = false }: MdxBodyProps) {
  const segments = splitBriefingBlocks(content)

  return (
    <div className={`dtx-body ${className}`}>
      {segments.map((segment, index) =>
        segment.type === 'briefing' ? (
          <Briefing key={index} summary={segment.summary} points={segment.points} />
        ) : (
          <DeferredProse key={index} text={segment.text} eager={eager} />
        )
      )}
    </div>
  )
}
