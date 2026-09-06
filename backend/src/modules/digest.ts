import { Router, Request, Response } from 'express'
import { env } from '../config/env'
import { logger } from '../config/logger'
import { generateDigest } from '../lib/digest-generator'
import {
  contentDir,
  getDigest,
  getLatestDigest,
  getRawDigest,
  hasDigest,
  listDigests,
} from '../lib/digest-store'
import { hasAgnesKey } from '../lib/agnes'
import { schedulerStatus } from '../lib/scheduler'
import { isValidDateKey, shiftDay, timezone, toDateKey } from '../lib/time'

export const digestRouter: Router = Router()

function dateParam(req: Request): string {
  const value = req.params.date
  return Array.isArray(value) ? (value[0] ?? '') : value
}

function authorize(req: Request): boolean {
  if (!env.ADMIN_TOKEN) return true
  const header = req.header('x-admin-token') ?? ''
  const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  return header === env.ADMIN_TOKEN || bearer === env.ADMIN_TOKEN
}

/** GET /api/digests/status — scheduler and archive health. */
digestRouter.get('/status', async (_req: Request, res: Response) => {
  const digests = await listDigests()
  res.json({
    status: 'ok',
    timezone,
    contentDir,
    total: digests.length,
    latest: digests[0]?.date ?? null,
    oldest: digests[digests.length - 1]?.date ?? null,
    agnesConfigured: hasAgnesKey(),
    model: env.AGNES_MODEL,
    scheduler: schedulerStatus(),
    today: toDateKey(),
    yesterday: shiftDay(toDateKey(), -1),
    timestamp: new Date().toISOString(),
  })
})

/** GET /api/digests — metadata for every issue, newest first. */
digestRouter.get('/', async (_req: Request, res: Response) => {
  const digests = await listDigests()
  res.json({ total: digests.length, digests })
})

/** GET /api/digests/latest — newest issue with its full MDX body. */
digestRouter.get('/latest', async (_req: Request, res: Response) => {
  const digest = await getLatestDigest()
  if (!digest) {
    res.status(404).json({ message: 'No digest has been published yet' })
    return
  }
  res.json({ digest })
})

/** POST /api/digests/generate — create or refresh an issue. */
digestRouter.post('/generate', async (req: Request, res: Response) => {
  if (!authorize(req)) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const requested = typeof req.body?.date === 'string' ? req.body.date : shiftDay(toDateKey(), -1)
  if (!isValidDateKey(requested)) {
    res.status(400).json({ message: 'Body field "date" must use the YYYY-MM-DD format' })
    return
  }

  const force = req.body?.force === true
  if (!force && (await hasDigest(requested))) {
    res.status(409).json({ message: `Digest for ${requested} already exists`, date: requested })
    return
  }

  try {
    const result = await generateDigest(requested)
    logger.info({ date: requested }, 'digest generated on demand')
    res.status(201).json({ message: 'Digest generated', digest: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed'
    res.status(502).json({ message, date: requested })
  }
})

/** GET /api/digests/:date/raw — the stored MDX document verbatim. */
digestRouter.get('/:date/raw', async (req: Request, res: Response) => {
  const date = dateParam(req)
  if (!isValidDateKey(date)) {
    res.status(400).json({ message: 'Invalid date format, expected YYYY-MM-DD' })
    return
  }
  const mdx = await getRawDigest(date)
  if (mdx === null) {
    res.status(404).json({ message: `Digest for ${date} not found` })
    return
  }
  res.json({ date, mdx })
})

/** GET /api/digests/:date — one issue with its full MDX body plus neighbours. */
digestRouter.get('/:date', async (req: Request, res: Response) => {
  const date = dateParam(req)
  if (!isValidDateKey(date)) {
    res.status(400).json({ message: 'Invalid date format, expected YYYY-MM-DD' })
    return
  }

  const digest = await getDigest(date)
  if (!digest) {
    res.status(404).json({ message: `Digest for ${date} not found` })
    return
  }

  const all = await listDigests()
  const index = all.findIndex((item) => item.date === date)
  res.json({
    digest,
    previous: all[index + 1] ?? null,
    next: index > 0 ? all[index - 1] : null,
  })
})
