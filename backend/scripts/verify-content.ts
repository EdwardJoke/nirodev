/**
 * Structural check for every issue in the content archive.
 *
 *   pnpm verify
 *
 * Exits non-zero when any document is malformed, so a build can refuse to
 * publish a broken issue.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { contentDir } from '../src/lib/digest-store'
import { validateDigestMdx } from '../src/lib/digest-validate'

const DATE_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.mdx$/

async function main() {
  let entries: string[]
  try {
    entries = await fs.readdir(contentDir)
  } catch {
    console.error(`content directory not found: ${contentDir}`)
    process.exit(1)
  }

  const files = entries
    .map((name) => name.match(DATE_FILE_RE)?.[1])
    .filter((value): value is string => Boolean(value))
    .sort()

  if (!files.length) {
    console.error(`no issues found in ${contentDir}`)
    process.exit(1)
  }

  let failed = 0

  for (const date of files) {
    const raw = await fs.readFile(path.join(contentDir, `${date}.mdx`), 'utf8')
    const result = validateDigestMdx(raw, date)
    const { tldrBullets, signalCount, sourceLinks, briefings } = result.stats
    const shape =
      `${tldrBullets} bullets · ${signalCount} signals · ${sourceLinks} links · ` +
      `${briefings}/${signalCount} briefings`

    if (result.ok) {
      console.log(`ok    ${date}  ${shape}`)
      continue
    }

    failed += 1
    console.error(`FAIL  ${date}  ${shape}`)
    for (const issue of result.issues) {
      console.error(`        [${issue.code}] ${issue.message}`)
    }
  }

  if (failed) {
    console.error(`\n${failed} of ${files.length} issue(s) failed structural validation`)
    process.exit(1)
  }

  console.log(`\nall ${files.length} issue(s) passed structural validation`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
