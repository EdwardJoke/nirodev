import { forwardRef, type CSSProperties, type ReactNode } from 'react'
import { useInView } from '@/hooks/useInView'

/** Merges the hook's ref with a ref forwarded by the caller. */
function assignRef<T>(target: React.Ref<T>, node: T | null) {
  if (typeof target === 'function') target(node)
  else if (target) (target as React.RefObject<T | null>).current = node
}

function joinClasses(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(' ')
}

interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
}

/** Fades and lifts its children the first time they enter the viewport. */
export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(
  ({ children, className, delay = 0 }, forwardedRef) => {
    const [ref, visible] = useInView<HTMLDivElement>()

    return (
      <div
        ref={(node) => {
          ref.current = node
          if (forwardedRef) assignRef(forwardedRef, node)
        }}
        className={joinClasses('reveal', visible && 'is-visible', className)}
        style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      >
        {children}
      </div>
    )
  }
)
FadeIn.displayName = 'FadeIn'

interface StaggerProps {
  children: ReactNode
  /** Seconds between each child's reveal. */
  stagger?: number
  className?: string
}

/** Reveals its direct children one after another. */
export const Stagger = forwardRef<HTMLDivElement, StaggerProps>(
  ({ children, stagger = 0.1, className }, forwardedRef) => {
    const [ref, visible] = useInView<HTMLDivElement>()

    return (
      <div
        ref={(node) => {
          ref.current = node
          if (forwardedRef) assignRef(forwardedRef, node)
        }}
        className={joinClasses('stagger', visible && 'is-visible', className)}
        style={{ '--stagger-step': `${stagger}s` } as CSSProperties}
      >
        {children}
      </div>
    )
  }
)
Stagger.displayName = 'Stagger'
