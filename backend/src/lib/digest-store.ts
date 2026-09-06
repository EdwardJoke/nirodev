import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env'
import { logger } from '../config/logger'
import type { Digest, DigestMeta } from '../types/digest.types'
import { countSections, parseFrontmatter, serializeFrontmatter, toDigestMeta } from './mdx'
import { assertDigestStructure } from './digest-validate'

export const contentDir = path.resolve(
  env.CONTENT_DIR || path.resolve(process.cwd(), '..', 'content')
)

const DATE_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.mdx$/

interface CacheEntry {
  mtimeMs: number
  meta: DigestMeta
}

const metaCache = new Map<string, CacheEntry>()

export async function ensureContentDir(): Promise<void> {
  await fs.mkdir(contentDir, { recursive: true })
}

export const digestPath = (dateKey: string) => path.join(contentDir, `${dateKey}.mdx`)

export async function hasDigest(dateKey: string): Promise<boolean> {
  try {
    await fs.access(digestPath(dateKey))
    return true
  } catch {
    return false
  }
}

async function readMeta(dateKey: string): Promise<DigestMeta | null> {
  const file = digestPath(dateKey)
  let stat
  try {
    stat = await fs.stat(file)
  } catch {
    metaCache.delete(dateKey)
    return null
  }

  const cached = metaCache.get(dateKey)
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.meta

  const raw = await fs.readFile(file, 'utf8')
  const { data, body } = parseFrontmatter(raw)
  const issue = issueNumber(dateKey)
  const meta = toDigestMeta(data, dateKey, issue)
  if (!meta.itemCount) meta.itemCount = countSections(body) || 1
  metaCache.set(dateKey, { mtimeMs: stat.mtimeMs, meta })
  return meta
}

/** Issue numbers count days since 2020-01-01, giving each issue a stable id. */
export function issueNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  const epoch = Date.UTC(2020, 0, 1)
  return Math.floor((Date.UTC(y, m - 1, d) - epoch) / 86400000) + 1
}

/** Every digest, newest first. */
export async function listDigests(): Promise<DigestMeta[]> {
  await ensureContentDir()
  const entries = await fs.readdir(contentDir)
  const dateKeys = entries
    .map((name) => name.match(DATE_FILE_RE)?.[1])
    .filter((value): value is string => Boolean(value))
    .sort()
    .reverse()

  const metas = await Promise.all(dateKeys.map((key) => readMeta(key)))
  return metas.filter((meta): meta is DigestMeta => meta !== null)
}

/** A digest with its MDX body, or `null` when the issue does not exist. */
export async function getDigest(dateKey: string): Promise<Digest | null> {
  try {
    const raw = await fs.readFile(digestPath(dateKey), 'utf8')
    const { data, body } = parseFrontmatter(raw)
    const meta = toDigestMeta(data, dateKey, issueNumber(dateKey))
    if (!meta.itemCount) meta.itemCount = countSections(body) || 1
    return { ...meta, content: body }
  } catch {
    return null
  }
}

export async function getLatestDigest(): Promise<Digest | null> {
  const metas = await listDigests()
  if (!metas.length) return null
  return getDigest(metas[0].date)
}

/** Persist an MDX document, making sure its frontmatter carries the canonical date. */
export async function saveDigest(dateKey: string, mdx: string): Promise<DigestMeta> {
  await ensureContentDir()

  // Last line of defence: whatever the writer produced, a malformed document
  // never reaches the archive. Throwing here aborts the run.
  assertDigestStructure(mdx, dateKey)

  const { data, body } = parseFrontmatter(mdx)
  data.date = dateKey
  if (!data.itemCount) data.itemCount = countSections(body)
  const document = serializeFrontmatter(data, body)
  await fs.writeFile(digestPath(dateKey), document, 'utf8')
  metaCache.delete(dateKey)

  const meta = toDigestMeta(data, dateKey, issueNumber(dateKey))
  if (!meta.itemCount) meta.itemCount = countSections(body) || 1
  metaCache.set(dateKey, { mtimeMs: Date.now(), meta })

  logger.info({ date: dateKey, source: meta.source, items: meta.itemCount }, 'digest saved')
  return meta
}

export async function getRawDigest(dateKey: string): Promise<string | null> {
  try {
    return await fs.readFile(digestPath(dateKey), 'utf8')
  } catch {
    return null
  }
}
