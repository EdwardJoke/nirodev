import { useEffect, useState, type MouseEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { flushSync } from 'react-dom'
import { Moon, Sun } from 'lucide-react'
import { Logo } from './Logo'
import { applyTheme, readTheme, type Theme } from '../lib/theme'
import { formatCountdown } from '../lib/dates'
import { preloadArchivePage, preloadTodayPage, preloadTrendsPage } from '../lib/routePreload'
import type { ViewTransitionHandle } from '../lib/viewTransition'
import type { DigestMeta } from '../types/digest'

const NAV_ITEMS = [
  { to: '/today', label: 'Today' },
  { to: '/archive', label: 'Archive' },
  { to: '/trends', label: 'Trends' },
]

/** 悬停导航项时把目标页代码块拉到手，转场新快照才拍得到完整页面。 */
const NAV_PRELOAD: Record<string, () => void> = {
  '/today': preloadTodayPage,
  '/archive': preloadArchivePage,
  '/trends': preloadTrendsPage,
}

/** Minutes remaining until the next 00:00 publication moment. */
function useMinutesToMidnight() {
  const [minutes, setMinutes] = useState(() => minutesToMidnight())

  useEffect(() => {
    const timer = window.setInterval(() => setMinutes(minutesToMidnight()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return minutes
}

function minutesToMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 60000))
}

type ViewTransitionCapableDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionHandle
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  /** New palette wipes in as a circle growing out of the button itself. */
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const doc = document as ViewTransitionCapableDocument

    if (
      typeof doc.startViewTransition !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setTheme(next)
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const root = document.documentElement
    root.classList.add('theme-vt')
    const transition = doc.startViewTransition(() => {
      flushSync(() => setTheme(next))
    })

    void transition.finished.finally(() => root.classList.remove('theme-vt'))
    void transition.ready.then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 460,
          easing: 'cubic-bezier(0.22, 0.9, 0.24, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      )
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[0.625rem] tracking-[0.18em] uppercase transition-colors duration-150 hover:border-foreground"
    >
      {theme === 'dark' ? <Sun className="size-3" /> : <Moon className="size-3" />}
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}

export function SiteHeader({ issueMeta }: { issueMeta?: DigestMeta | null }) {
  const minutes = useMinutesToMidnight()

  return (
    // 不透明底 + 单条发丝线。之前的毛玻璃在滚动时会让描边发虚。
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="container">
        <div className="hidden items-center gap-8 border-b border-border py-2 md:flex">
          <p className="text-kicker text-muted-foreground">
            Auto-published daily at 00:00 · Asia/Shanghai
          </p>
          <p className="text-kicker ml-auto text-muted-foreground">
            Next issue in{' '}
            <span className="num px-0.5 text-[0.75rem]">{formatCountdown(minutes)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 md:flex-nowrap md:gap-x-4 md:py-5">
          <NavLink
            to="/"
            viewTransition
            className="group order-1 mr-auto flex items-center gap-2.5 md:gap-3"
          >
            <Logo className="size-8 md:size-10" />
            <span className="flex items-baseline gap-2">
              <span className="font-display text-[1.5rem] leading-none tracking-tight md:text-4xl">
                Daily Tech News
              </span>
              {issueMeta ? (
                <span className="num pt-0.5 text-[0.625rem]">#{issueMeta.issue}</span>
              ) : null}
            </span>
          </NavLink>

          {/* 窄屏时导航换到第二行，而不是把整页挤得可以横向滚动。 */}
          <nav className="order-3 -mx-1 w-full overflow-x-auto px-1 md:order-2 md:mx-0 md:w-auto md:overflow-visible md:px-0">
            <div className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  viewTransition
                  onMouseEnter={() => NAV_PRELOAD[item.to]?.()}
                  // 去程随行的元数据在这里回传：从期页回到列表时，
                  // hero 的瓷砖要能认出落点行。
                  state={item.to === '/archive' && issueMeta ? { digest: issueMeta } : undefined}
                  className={({ isActive }) =>
                    [
                      'group relative block shrink-0 px-2.5 py-1.5 font-mono text-[0.6875rem] tracking-[0.16em] uppercase transition-colors duration-150',
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.label}
                      {/* 从左端展开的下划线，避免整块反白带来的跳动。 */}
                      <span
                        aria-hidden="true"
                        className={[
                          'absolute inset-x-0 bottom-0 h-px origin-left bg-foreground transition-transform duration-200 ease-out',
                          isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                        ].join(' ')}
                      />
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>

          <div className="order-2 md:order-3">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
