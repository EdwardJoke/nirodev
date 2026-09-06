/**
 * Manual digest generator.
 *
 *   pnpm tsx scripts/generate-digest.ts 2026-08-27
 *   pnpm tsx scripts/generate-digest.ts 2026-08-27 --force
 *   pnpm tsx scripts/generate-digest.ts --backfill 5
 */
import { generateDigest } from '../src/lib/digest-generator'
import { hasDigest } from '../src/lib/digest-store'
import { shiftDay, toDateKey } from '../src/lib/time'

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const backfillIndex = args.indexOf('--backfill')
  const positional = args.filter((arg) => !arg.startsWith('--') && !/^\d+$/.test(arg))

  const targets: string[] = []

  if (backfillIndex !== -1) {
    const days = Number(args[backfillIndex + 1] ?? '3')
    for (let offset = 1; offset <= days; offset += 1) targets.push(shiftDay(toDateKey(), -offset))
  } else if (positional.length) {
    targets.push(...positional)
  } else {
    targets.push(shiftDay(toDateKey(), -1))
  }

  for (const date of targets) {
    if (!force && (await hasDigest(date))) {
      console.log(`skip ${date} — already published`)
      continue
    }
    const started = Date.now()
    const result = await generateDigest(date)
    console.log(
      `done ${date} — issue #${result.issue}, ${result.itemsCollected} sources, ${result.source}, ${Math.round((Date.now() - started) / 1000)}s`
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
