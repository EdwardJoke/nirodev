import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'

/**
 * Pathname-keyed shell: remounts the routed tree on every path change, which
 * re-triggers the CSS enter animation (`.page-enter`) on browsers without
 * View Transitions. Under the data router the routes arrive as children of a
 * pathless layout route, so the page itself renders through `<Outlet />`.
 *
 * `ScrollRestoration` belongs to the data router: push navigations land at
 * the top, back/forward restores where you were.
 */
export function AnimatedRoutes() {
  const location = useLocation()

  return (
    <>
      <ScrollRestoration />
      <div key={location.pathname}>
        <Outlet />
      </div>
    </>
  )
}
