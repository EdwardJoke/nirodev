import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom'
import { AnimatedRoutes } from '@/components/AnimatedRoutes'
import { PageTransition } from '@/components/PageTransition'
import { applyTheme, readTheme } from '@/lib/theme'
import Landing from './pages/Landing'

/**
 * 所有路由统一走路由级 lazy：代码块就位后导航（以及它的 View Transition）
 * 才开始，转场的新快照永远拍不到 Suspense 空壳——那是逐帧审计里
 * 最严重的一种毛刺：转场结束后的整页空白。
 */
async function archiveLazy() {
  const [{ default: Archive }] = await Promise.all([import('./pages/Archive')])
  return {
    element: (
      <PageTransition transition="slide-up">
        <Archive />
      </PageTransition>
    ),
  }
}

async function issueLazy() {
  const [{ default: IssuePage }] = await Promise.all([import('./pages/IssuePage')])
  return {
    element: (
      <PageTransition transition="slide-up">
        <IssuePage />
      </PageTransition>
    ),
  }
}

async function todayLazy() {
  const [{ default: Today }] = await Promise.all([import('./pages/Today')])
  return {
    element: (
      <PageTransition transition="slide-up">
        <Today />
      </PageTransition>
    ),
  }
}

async function topicLazy() {
  const [{ default: TopicPage }] = await Promise.all([import('./pages/TopicPage')])
  return {
    element: (
      <PageTransition transition="slide-up">
        <TopicPage />
      </PageTransition>
    ),
  }
}

async function trendsLazy() {
  const [{ default: TrendsPage }] = await Promise.all([import('./pages/TrendsPage')])
  return {
    element: (
      <PageTransition transition="slide-up">
        <TrendsPage />
      </PageTransition>
    ),
  }
}

async function notFoundLazy() {
  const [{ default: NotFound }] = await Promise.all([import('./pages/NotFound')])
  return {
    element: (
      <PageTransition transition="fade">
        <NotFound />
      </PageTransition>
    ),
  }
}

/** 平台侧的页面档案标记，随路由一起搬进数据路由器。 */
const genie = (key: string, title: string) => ({
  'data-genie-key': key,
  'data-genie-title': title,
})

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AnimatedRoutes />}>
      <Route
        path="/"
        {...genie('Landing', 'Daily Tech News — Yesterday in Tech')}
        element={
          <PageTransition transition="slide-up">
            <Landing />
          </PageTransition>
        }
      />
      <Route
        path="/today"
        {...genie('Today', 'Today — Daily Tech News')}
        lazy={todayLazy}
      />
      <Route
        path="/archive"
        {...genie('Archive', 'Archive — Daily Tech News')}
        lazy={archiveLazy}
      />
      <Route
        path="/issue/:date"
        {...genie('Issue', 'Issue — Daily Tech News')}
        lazy={issueLazy}
      />
      <Route
        path="/topic/:tag"
        {...genie('Topic', 'Topic — Daily Tech News')}
        lazy={topicLazy}
      />
      <Route
        path="/trends"
        {...genie('Trends', 'Trends — Daily Tech News')}
        lazy={trendsLazy}
      />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" {...genie('NotFound', 'Not Found — Daily Tech News')} lazy={notFoundLazy} />
    </Route>
  )
)

/**
 * Configure TanStack Query client with optimized defaults
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data considered fresh for 1 minute
      staleTime: 60 * 1000,
      // Cache data for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect by default
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
})

function App() {
  useEffect(() => {
    applyTheme(readTheme())
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {/* 数据路由器是 View Transitions 的前置条件：`<Link viewTransition>`
          只有在它之下才会真正调用 document.startViewTransition。 */}
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
