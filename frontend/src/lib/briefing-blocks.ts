/**
 * Splits an issue body into ordinary markdown and `:::brief` blocks.
 *
 * The generator embeds briefings inside the MDX so the archive stays a single
 * file. Pulling them out here keeps the markdown renderer unaware of them and
 * lets the disclosure be a real component instead of injected HTML.
 */

export interface MarkdownSegment {
  type: 'markdown'
  text: string
}

export interface BriefingSegment {
  type: 'briefing'
  summary: string
  points: string[]
}

export type BodySegment = MarkdownSegment | BriefingSegment

const BLOCK_RE = /^:::brief[ \t]*\r?\n([\s\S]*?)^:::[ \t]*$/gm

function parseBlock(inner: string): BriefingSegment {
  const lines = inner.split(/\r?\n/)
  const points: string[] = []
  const prose: string[] = []

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/)
    if (bullet) {
      points.push(bullet[1].trim())
      continue
    }
    if (line.trim()) prose.push(line.trim())
  }

  return { type: 'briefing', summary: prose.join(' '), points }
}

/** Split the body, dropping the now-empty markdown gaps around each block. */
export function splitBriefingBlocks(content: string): BodySegment[] {
  const segments: BodySegment[] = []
  let cursor = 0

  for (const match of content.matchAll(BLOCK_RE)) {
    const start = match.index ?? 0
    const before = content.slice(cursor, start)
    if (before.trim()) segments.push({ type: 'markdown', text: before.trim() })
    segments.push(parseBlock(match[1]))
    cursor = start + match[0].length
  }

  const tail = content.slice(cursor)
  if (tail.trim()) segments.push({ type: 'markdown', text: tail.trim() })

  return segments.length ? segments : [{ type: 'markdown', text: content }]
}
