import { useEffect, useRef, useState } from 'react'

interface UseInViewOptions {
  /**
   * Extra reach around the viewport. A negative bottom margin reserves a
   * strip at the bottom of the screen, so an element reveals once 96px of
   * it (or all of it, if shorter) is actually on screen — regardless of
   * the element's height. A ratio threshold cannot do that: a tall block
   * near the page end may never reach, say, 20% visibility once the footer
   * occupies the viewport, and would stay invisible forever.
   */
  rootMargin?: string
}

/**
 * Flags the first time an element reaches the viewport and then stops
 * observing. Small enough to inline, which is the point: it replaces an
 * animation library for reveals and lets heavy components wait until they
 * are actually close to being seen.
 */
export function useInView<T extends HTMLElement>({
  rootMargin = '0px 0px -96px 0px',
}: UseInViewOptions = {}) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Browsers without IntersectionObserver get everything immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0, rootMargin }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin])

  return [ref, inView] as const
}
