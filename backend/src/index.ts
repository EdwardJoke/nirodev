import { createApp } from './app'
import { env } from './config/env'
import { logger } from './config/logger'
import { startScheduler, stopScheduler } from './lib/scheduler'

const startServer = async () => {
  try {
    const app = createApp()

    app.listen(env.PORT, () => {
      // Only show minimal startup info in development
      if (env.NODE_ENV === 'development') {
        console.log(`Server running on http://localhost:${env.PORT}${env.API_PREFIX}`)
      }
    })

    // Publishes the previous day's issue every day at 00:00 (local timezone).
    startScheduler()
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server')
    process.exit(1)
  }
}

// Handle graceful shutdown silently
process.on('SIGTERM', async () => {
  stopScheduler()
  process.exit(0)
})

process.on('SIGINT', async () => {
  stopScheduler()
  process.exit(0)
})

startServer()
