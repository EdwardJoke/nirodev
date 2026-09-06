import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

interface BriefingProps {
  summary: string
  points: string[]
}

/**
 * Expands in place so the reader never leaves the page. The original article
 * link stays below, untouched, for anyone who wants the full piece.
 *
 * The panel stays mounted so its height can animate; `grid-template-rows`
 * goes 0fr -> 1fr in CSS, and `inert` keeps the collapsed content out of
 * the tab order while it is hidden.
 */
export function Briefing({ summary, points }: BriefingProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="dtx-brief">
      <button
        type="button"
        className="dtx-brief-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="text-kicker">{open ? 'Hide the briefing' : 'Read the briefing'}</span>
        <ChevronDown
          className={`dtx-brief-chevron ${open ? 'is-open' : ''}`}
          size={14}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      <div
        id={panelId}
        className={`dtx-brief-panel ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="dtx-brief-inner">
          <p className="dtx-brief-summary">{summary}</p>

          {points.length ? (
            <ul className="dtx-brief-points">
              {points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
