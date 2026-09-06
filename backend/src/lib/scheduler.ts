import { env } from '../config/env'
import { logger } from '../config/logger'
import { generateDigest } from './digest-generator'
import { hasDigest, listDigests } from './digest-store'
import { shiftDay, toDateKey, timezone } from './time'

const TICK_MS = 30_000
/** Small delay past midnight so upstream feeds have settled. */
const RUN_WINDOW_MS = 5 * 60_000

let running = false
let lastRunDay: string | null = null
let lastResult: { date: string; at: string; ok: boolean; error?: string } | null = null
let timer: NodeJS.Timeout | null = null

async function run(dateKey: string): Promise<boolean> {
  if (running) return false
  running = true
  try {
    if (await hasDigest(dateKey)) {
      lastResult = { date: dateKey, at: new Date().toISOString(), ok: true }
      return true
    }
    const result = await generateDigest(dateKey)
    lastResult = { date: dateKey, at: new Date().toISOString(), ok: true }
    logger.info(
      { date: dateKey, source: result.source, items: result.itemsCollected },
      'daily digest ready'
    )
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    lastResult = { date: dateKey, at: new Date().toISOString(), ok: false, error: message }
    logger.error({ err: error, date: dateKey }, 'daily digest generation failed')
    return false
  } finally {
    running = false
  }
}

/** Fill in yesterday plus (on an empty archive) a few recent days. */
async function bootstrap(): Promise<void> {
  const today = toDateKey()

  if (!(await hasDigest(shiftDay(today, -1)))) {
    await run(shiftDay(today, -1))
  }

  const existing = await listDigests()
  if (existing.length >= Math.max(1, env.BACKFILL_DAYS)) return

  for (let offset = 2; offset <= env.BACKFILL_DAYS; offset += 1) {
    const dateKey = shiftDay(today, -offset)
    if (await hasDigest(dateKey)) continue
    await run(dateKey)
  }
}

export function startScheduler(): void {
  if (timer) return

  const tick = () => {
    const now = new Date()
    const today = toDateKey(now)

    // Only fire inside the first minutes of a new day, once per day.
    const midnight = new Date(now)
    midnight.setHours(0, 0, 0, 0)
    const elapsed = now.getTime() - midnight.getTime()

    if (elapsed >= 0 && elapsed <= RUN_WINDOW_MS && lastRunDay !== today) {
      lastRunDay = today
      void run(shiftDay(today, -1))
    }
  }

  timer = setInterval(tick, TICK_MS)
  tick()

  void bootstrap().catch((error) => {
    logger.error({ err: error }, 'digest bootstrap failed')
  })

  logger.info({ timezone, tickMs: TICK_MS }, 'daily digest scheduler started')
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer)
  timer = null
}

export const schedulerStatus = () => ({
  timezone,
  running,
  lastRunDay,
  lastResult,
  agnesConfigured: hasAgnesKeySafe(),
})

function hasAgnesKeySafe(): boolean {
  return Boolean(env.AGNES_API_KEY)
}

/** Exposed for tests and manual backfill scripts. */
export const runNow = run
