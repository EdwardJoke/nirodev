/**
 * Compile the MDX archive into static JSON that the frontend can read without
 * a backend. This is what makes the site deployable to GitHub Pages.
 *
 *   pnpm --filter backend tsx scripts/build-static.ts
 *
 * Outputs into `frontend/public/data/`:
 *   index.json          — every digest's metadata, newest first
 *   status.json         — archive-level facts used by the footer
 *   search.json         — flattened per-issue fields for archive search
 *   trends.json         — aggregate series behind the trends page
 *   issue/<date>.json   — one full issue with its MDX body and neighbours
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { buildSearchEntry, buildTrends, type SearchEntry } from '../src/lib/digest-index'
import { contentDir, getDigest, getRawDigest, listDigests } from '../src/lib/digest-store'
import { toDateKey } from '../src/lib/time'
import type { DigestMeta } from '../src/types/digest.types'

const OUT_DIR = path.resolve(process.cwd(), '..', 'frontend', 'public', 'data')

async function writeJson(relativePath: string, payload: unknown): Promise<void> {
  const target = path.join(OUT_DIR, relativePath)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function main() {
  const digests = await listDigests()

  await fs.mkdir(path.join(OUT_DIR, 'issue'), { recursive: true })

  const writer = digests[0]?.source === 'agnes' ? digests[0].model : 'local-composer'

  await writeJson('index.json', {
    total: digests.length,
    digests,
    generatedAt: new Date().toISOString(),
  })

  await writeJson('status.json', {
    status: 'ok',
    timezone: 'Asia/Shanghai',
    total: digests.length,
    latest: digests[0]?.date ?? null,
    oldest: digests[digests.length - 1]?.date ?? null,
    agnesConfigured: digests[0]?.source === 'agnes',
    model: writer,
    today: toDateKey(),
    mode: 'static',
  })

  const searchEntries: SearchEntry[] = []

  for (let index = 0; index < digests.length; index += 1) {
    const meta: DigestMeta = digests[index]
    const digest = await getDigest(meta.date)
    if (!digest) continue
    const mdx = await getRawDigest(meta.date)
    await writeJson(`issue/${meta.date}.json`, {
      digest,
      previous: digests[index + 1] ?? null,
      next: index > 0 ? digests[index - 1] : null,
      mdx: mdx ?? '',
    })
    searchEntries.push(buildSearchEntry(meta, digest.content))
  }

  await writeJson('search.json', {
    total: searchEntries.length,
    generatedAt: new Date().toISOString(),
    entries: searchEntries,
  })

  await writeJson('trends.json', buildTrends(digests, searchEntries))

  console.log(`built ${digests.length} issues from ${contentDir} -> ${OUT_DIR}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
