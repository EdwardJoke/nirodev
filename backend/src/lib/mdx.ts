import type { DigestMeta } from '../types/digest.types'

type FrontmatterValue = string | number | string[]
type Frontmatter = Record<string, FrontmatterValue>

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseScalar(raw: string): FrontmatterValue {
  const value = raw.trim()
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((part) => unquote(part))
      .filter(Boolean)
  }
  const unquoted = unquote(value)
  if (/^-?\d+$/.test(unquoted)) return Number(unquoted)
  return unquoted
}

/** Split a raw MDX document into its frontmatter object and its body. */
export function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) return { data: {}, body: raw.trim() }

  const data: Frontmatter = {}
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf(':')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1)
    if (!key) continue
    data[key] = parseScalar(value)
  }

  return { data, body: raw.slice(match[0].length).trim() }
}

function serializeScalar(value: FrontmatterValue): string {
  if (Array.isArray(value)) return `[${value.map((v) => JSON.stringify(String(v))).join(', ')}]`
  if (typeof value === 'number') return String(value)
  return JSON.stringify(String(value))
}

/** Join a frontmatter object and an MDX body back into a full document. */
export function serializeFrontmatter(data: Frontmatter, body: string): string {
  const lines = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}: ${serializeScalar(value)}`)
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`
}

const toArray = (value: FrontmatterValue | undefined): string[] => {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value) return [value]
  return []
}

/** Normalise loosely-typed frontmatter into a strict `DigestMeta`. */
export function toDigestMeta(data: Frontmatter, fallbackDate: string, issue: number): DigestMeta {
  const title = typeof data.title === 'string' && data.title ? data.title : `Tech, ${fallbackDate}`
  return {
    date: typeof data.date === 'string' && data.date ? data.date : fallbackDate,
    title,
    subtitle: typeof data.subtitle === 'string' ? data.subtitle : '',
    summary: typeof data.summary === 'string' ? data.summary : '',
    tags: toArray(data.tags).slice(0, 8),
    itemCount: typeof data.itemCount === 'number' ? data.itemCount : 0,
    source: data.source === 'agnes' ? 'agnes' : 'local',
    model: typeof data.model === 'string' ? data.model : '',
    generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : '',
    issue,
  }
}

/** Count `### ` headings, used as a fallback item count. */
export function countSections(body: string): number {
  return (body.match(/^###\s+/gm) ?? []).length
}
