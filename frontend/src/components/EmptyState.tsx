import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** The margin note — a two-column kicker at the left edge. */
  kicker: string
  children: ReactNode
  /** Optional call to action rendered under the message. */
  action?: ReactNode
}

/**
 * Blank states are laid out like margin notes, not dialogs: the label sits in
 * columns 1-2, the message runs through 3-7, and nothing is ever centred.
 */
export function EmptyState({ kicker, children, action }: EmptyStateProps) {
  return (
    <div className="grid-editorial py-24">
      <p className="text-kicker col-span-4 text-muted-foreground md:col-span-2">{kicker}</p>
      <div className="col-span-4 mt-4 md:col-span-5 md:col-start-3 md:mt-0">
        <p className="font-display max-w-[38ch] text-[clamp(1.5rem,3.5vw,2.25rem)] leading-tight tracking-[-0.02em]">
          {children}
        </p>
        {action ? <div className="mt-8">{action}</div> : null}
      </div>
    </div>
  )
}
