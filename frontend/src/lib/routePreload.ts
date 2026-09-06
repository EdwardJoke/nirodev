/**
 * 悬停即取目标页的代码块——转场开始时只剩一帧的活。
 * Vite 对相同模块的动态导入自动去重，重复调用没有额外开销；
 * 与 lazy() 的导入是同一个 URL，天然共享缓存。
 *
 * IssuePage 一并拉上 MarkdownProse：正文渲染块若在转场中途才到，
 * hero 下面会闪一排骨架条——那是逐帧审计里最刺眼的一种毛刺。
 */
export const preloadIssuePage = () => {
  void import('../pages/IssuePage')
  void import('../components/MarkdownProse')
}
export const preloadTodayPage = () => void import('../pages/Today')
export const preloadArchivePage = () => void import('../pages/Archive')
export const preloadTrendsPage = () => void import('../pages/TrendsPage')
export const preloadTopicPage = () => void import('../pages/TopicPage')
