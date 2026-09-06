interface PageTransitionProps {
  children: React.ReactNode
  transition?: 'fade' | 'slide-up' | 'slide-fade' | 'scale'
}

/**
 * Runs a one-shot enter animation when the page mounts. `AnimatedRoutes`
 * keys the tree by pathname, so a remount — and therefore the animation —
 * happens on every navigation.
 *
 * Exit animations are deliberately gone: they cost a layout-animation engine
 * and were over in 200ms anyway.
 */
export function PageTransition({ children, transition = 'fade' }: PageTransitionProps) {
  return (
    <div className="page-enter" data-transition={transition}>
      {children}
    </div>
  )
}
