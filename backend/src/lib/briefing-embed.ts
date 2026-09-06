import type { Briefing } from '../types/digest.types'

/**
 * Briefings travel inside the MDX document as fenced `:::brief` blocks.
 * Keeping them in the same file means the archive stays self-contained — no
 * second artefact to keep in sync.
 */
export const BRIEF_OPEN = ':::brief'
export const BRIEF_CLOSE = ':::'

/** Render one briefing as a block the reader can expand in place. */
export function renderBriefing(briefing: Briefing): string[] {
  const lines = [BRIEF_OPEN, '', briefing.summary]

  if (briefing.points.length) {
    lines.push('')
    for (const point of briefing.points) lines.push(`- ${point}`)
  }

  lines.push('', BRIEF_CLOSE, '')
  return lines
}

/**
 * Every article link in the document, in the order they appear.
 * Used to brief the stories the issue actually covers — the model picks a
 * subset of the collected items, and ranking by score would miss those.
 */
export function extractDocUrls(mdx: string): string[] {
  const urls: string[] = []
  for (const match of mdx.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    const url = match[1]
    if (!urls.includes(url)) urls.push(url)
  }
  return urls
}

/** Match a section to its briefing by the article link it contains. */
function findBriefing(sectionText: string, briefings: Briefing[]): Briefing | undefined {
  return briefings
    .filter((briefing) => sectionText.includes(briefing.url))
    .sort((a, b) => b.url.length - a.url.length)[0]
}

function lastContentIndex(lines: string[]): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim()) return index + 1
  }
  return lines.length
}

function withBriefing(lines: string[], briefings: Briefing[]): string[] {
  const text = lines.join('\n')
  // Never stack a second block if the document already carries one.
  if (text.includes(BRIEF_OPEN)) return lines

  const briefing = findBriefing(text, briefings)
  if (!briefing) return lines

  const block = renderBriefing(briefing)
  // Prefer sitting above the "Read more" line so the original link stays last.
  let insertAt = -1
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (/^\s*\[[^\]]+\]\(https?:\/\//.test(lines[index])) {
      insertAt = index
      break
    }
  }
  if (insertAt === -1) insertAt = lastContentIndex(lines)

  return [...lines.slice(0, insertAt), '', ...block, ...lines.slice(insertAt)]
}

/**
 * Drop each briefing into the `###` section that links to its article.
 * Sections without a matching briefing are left untouched.
 */
export function attachBriefings(mdx: string, briefings: Briefing[]): string {
  if (!briefings.length) return mdx

  const output: string[] = []
  let section: string[] = []
  // Only `###` sections are stories. TL;DR and Sources also link to the
  // articles, and a briefing there would land in completely the wrong place.
  let isStory = false

  const flush = () => {
    if (section.length) output.push(...(isStory ? withBriefing(section, briefings) : section))
    section = []
  }

  for (const line of mdx.split('\n')) {
    const heading = line.match(/^(#{2,3})\s+/)
    if (heading) {
      flush()
      output.push(line)
      isStory = heading[1].length === 3
      continue
    }
    section.push(line)
  }
  flush()

  return output.join('\n')
}
