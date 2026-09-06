import { env } from '../config/env'
import { logger } from '../config/logger'
import { hasAgnesKey, writeDigestMdx } from './agnes'
import { attachBriefings, extractDocUrls } from './briefing-embed'
import { buildBriefings } from './briefings'
import { DigestStructureError } from './digest-validate'
import { saveDigest } from './digest-store'
import { composeLocalMdx } from './local-writer'
import { collectNews } from './news-sources'
import type { DigestMeta } from '../types/digest.types'
import { endOfDay, isValidDateKey, nowIso, startOfDay, timezone } from './time'

export interface GenerateResult extends DigestMeta {
  itemsCollected: number
  regenerated: boolean
  /** How many stories got an expandable briefing. */
  briefingsAttached: number
}

/**
 * Build one issue: collect the day's real news, ask Agnes to write it up,
 * fall back to the local composer, then persist the MDX document.
 */
export async function generateDigest(dateKey: string): Promise<GenerateResult> {
  if (!isValidDateKey(dateKey)) {
    throw new Error(`Invalid date "${dateKey}", expected YYYY-MM-DD`)
  }

  const from = startOfDay(dateKey)
  const to = endOfDay(dateKey)
  const items = await collectNews(from, to)
  const generatedAt = nowIso()

  logger.info(
    { date: dateKey, items: items.length, window: { from: from.toISOString(), to: to.toISOString() }, timezone },
    'collected news for digest'
  )

  let mdx: string

  if (items.length === 0) {
    mdx = composeLocalMdx({ date: dateKey, items, generatedAt })
  } else if (hasAgnesKey()) {
    try {
      mdx = await writeDigestMdx({
        date: dateKey,
        items,
        model: env.AGNES_MODEL,
        generatedAt,
      })
    } catch (error) {
      // A malformed document is a quality problem, not an outage. Publishing the
      // local fallback would hide it, so the failure is surfaced instead.
      if (error instanceof DigestStructureError) {
        logger.error(
          { err: error, date: dateKey },
          'Agnes output rejected by structural validation — nothing was published'
        )
        throw error
      }
      logger.error({ err: error, date: dateKey }, 'Agnes generation failed, falling back to local writer')
      mdx = composeLocalMdx({ date: dateKey, items, generatedAt })
    }
  } else {
    mdx = composeLocalMdx({ date: dateKey, items, generatedAt })
  }

  // Read the source articles and distil them, so every story can be expanded
  // in place instead of sending the reader off to the original site.
  let briefingsAttached = 0
  try {
    const briefings = await buildBriefings(items, extractDocUrls(mdx))
    mdx = attachBriefings(mdx, briefings)
    briefingsAttached = briefings.length
  } catch (error) {
    // A briefing is an enhancement — never lose a whole issue over one.
    logger.error({ err: error, date: dateKey }, 'briefings could not be attached')
  }

  const meta = await saveDigest(dateKey, mdx)

  return { ...meta, itemsCollected: items.length, regenerated: true, briefingsAttached }
}
