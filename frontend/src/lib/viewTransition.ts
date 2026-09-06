import { flushSync } from 'react-dom'

/** The subset of the View Transition API this app relies on. */
export interface ViewTransitionHandle {
  ready: Promise<void>
  finished: Promise<void>
}

type ViewTransitionCapableDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionHandle
}

/** 浏览器支持形变、且用户没有要求减少动态效果。 */
export function vtReady(): boolean {
  const doc = document as ViewTransitionCapableDocument
  return (
    typeof doc.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Runs a state update inside a same-document View Transition when the
 * browser supports it, so DOM changes morph instead of snapping (sort
 * re-flowing rows, trend ranges resizing bars, theme crossfades).
 *
 * `flushSync` is what makes this work with React: the callback must paint
 * the new state synchronously before the browser captures the new snapshot.
 */
export function withViewTransition(update: () => void) {
  const doc = document as ViewTransitionCapableDocument

  if (!vtReady()) {
    update()
    return
  }

  doc.startViewTransition(() => {
    flushSync(update)
  })
}

/**
 * FLIP 式重排转场：先同步给元素盖名（旧快照带名），再在转场内更新状态
 * （新快照同名），动画结束后撤名。排序时行块滑向新位置、趋势区间切换时
 * 柱体在窗口之间迁移，都是这个模式——没有它，重排只是一次淡入淡出。
 */
export function withMorphicTransition(
  enable: () => void,
  update: () => void,
  disable: () => void
) {
  const doc = document as ViewTransitionCapableDocument

  if (!vtReady()) {
    update()
    return
  }

  flushSync(enable)
  const transition = doc.startViewTransition(() => {
    flushSync(update)
  })
  void transition.finished.finally(() => flushSync(disable))
}

/** Records whether the browser can morph at all, for CSS to key off. */
export function markViewTransitionSupport() {
  const doc = document as ViewTransitionCapableDocument
  if (typeof doc.startViewTransition === 'function') {
    document.documentElement.classList.add('vt')
  }
}

/** The shared `view-transition-name` that links a row title to its hero. */
export const TILE_NAME = 'issue-title'

let lastTile: HTMLElement | null = null
let lastLink: Element | null = null

/**
 * Stamps a row's title with the shared tile name at click time — synchronously,
 * before the router starts the navigation and the browser captures the old
 * snapshot. The hover underline is stripped too (it may live on the title or
 * on the link inside it): that gesture belongs to the list, not to the tile
 * in flight.
 */
export function markTile(link: Element) {
  if (lastTile) {
    lastTile.style.viewTransitionName = ''
    lastTile.style.textDecoration = ''
    lastTile = null
  }
  if (lastLink instanceof HTMLElement) {
    lastLink.style.textDecoration = ''
    lastLink = null
  }
  const title = link.closest('h3') ?? link.querySelector('h3')
  if (title instanceof HTMLElement) {
    title.style.viewTransitionName = TILE_NAME
    title.style.textDecoration = 'none'
    lastTile = title
  }
  if (link instanceof HTMLElement) {
    link.style.textDecoration = 'none'
    lastLink = link
  }
}

/**
 * 从 router state 里读回随行的期数日期。回到列表的转场靠它认出
 * 「你来时的那一行」，让 hero 的瓷砖落回原位，而不是凭空淡出。
 */
export function readStateDate(state: unknown): string | null {
  if (state && typeof state === 'object' && 'digest' in state) {
    const digest = (state as { digest: { date?: unknown } }).digest
    if (digest && typeof digest === 'object' && typeof digest.date === 'string') {
      return digest.date
    }
  }
  return null
}
