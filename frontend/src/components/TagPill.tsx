import { Link } from 'react-router-dom'
import { preloadTopicPage } from '../lib/routePreload'

interface TagPillProps {
  label: string
  /** When set the pill links through to that route instead of sitting inert. */
  to?: string
  /** Highlights the pill as the current selection. */
  active?: boolean
}

const BASE =
  'font-mono text-[0.625rem] tracking-[0.14em] uppercase border rounded-full px-2.5 py-1 transition-colors duration-150'

/**
 * Idle pills stay hollow: hover deepens the border and the ink instead of
 * flooding the box, so a row of tags never flashes.
 */
export function TagPill({ label, to, active = false }: TagPillProps) {
  const className = active
    ? `${BASE} border-foreground bg-foreground text-background`
    : `${BASE} border-border text-muted-foreground hover:border-foreground hover:text-foreground`

  if (!to) {
    return <span className={className}>{label}</span>
  }

  return (
    <Link
      to={to}
      // `relative z-10` keeps the pill clickable when it sits inside a row
      // whose title uses a stretched link to cover the whole card.
      className={`${className} relative z-10 cursor-pointer`}
      onMouseEnter={preloadTopicPage}
      onFocus={preloadTopicPage}
    >
      {label}
    </Link>
  )
}
