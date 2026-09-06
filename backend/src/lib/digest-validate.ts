import { BRIEF_CLOSE, BRIEF_OPEN } from './briefing-embed'
import { parseFrontmatter } from './mdx'

/**
 * Structural guard for generated issues.
 *
 * The model is free to write whatever prose it likes, but the page renders a
 * fixed shape: TL;DR, Signals, Sources. When that shape breaks the issue must
 * not be published — it should stop the pipeline instead.
 */

export interface DigestIssue {
  code: string
  message: string
}

export interface DigestValidation {
  ok: boolean
  date: string
  issues: DigestIssue[]
  stats: {
    tldrBullets: number
    signalCount: number
    sourceLinks: number
    /** Expandable briefings embedded in the document. */
    briefings: number
  }
}

export class DigestStructureError extends Error {
  readonly date: string
  readonly issues: DigestIssue[]

  constructor(date: string, issues: DigestIssue[]) {
    super(
      `Digest for ${date} failed structural validation: ` +
        issues.map((issue) => `[${issue.code}] ${issue.message}`).join('; ')
    )
    this.name = 'DigestStructureError'
    this.date = date
    this.issues = issues
  }
}

const REQUIRED_KEYS = [
  'date',
  'title',
  'subtitle',
  'summary',
  'tags',
  'itemCount',
  'source',
  'model',
  'generatedAt',
]

const REQUIRED_SECTIONS = ['TL;DR', 'Signals', 'Sources'] as const
const OPTIONAL_SECTIONS = ['By the Numbers'] as const

/** Minimal bar for a normal issue; the quiet-day template is exempt. */
const MIN_TLDR_BULLETS = 3
const MIN_SIGNALS = 3
const MIN_SOURCE_LINKS = 3

interface ParsedSections {
  /** Top-level `##` headings, in document order. */
  headings: string[]
  /** Heading name (lowercased) -> everything below it. */
  content: Map<string, string>
}

/**
 * Split the body on `## ` headings. Done line by line rather than with one
 * lookahead regex — JavaScript has no `\Z`, which makes the regex version
 * silently match nothing.
 */
function parseSections(body: string): ParsedSections {
  const headings: string[] = []
  const buckets = new Map<string, string[]>()
  let current: string | null = null

  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) {
      current = heading[1].trim()
      if (!headings.includes(current)) headings.push(current)
      if (!buckets.has(current)) buckets.set(current, [])
      continue
    }
    if (current) buckets.get(current)?.push(line)
  }

  const content = new Map<string, string>()
  for (const [name, lines] of buckets) content.set(name.toLowerCase(), lines.join('\n'))
  return { headings, content }
}

function countBullets(section: string | null | undefined): number {
  if (!section) return 0
  return (section.match(/^\s*[-*]\s+\S/gm) ?? []).length
}

function countLinks(section: string | null | undefined): number {
  if (!section) return 0
  return (section.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g) ?? []).length
}

/** Validate one raw MDX document and return every problem found. */
export function validateDigestMdx(raw: string, fallbackDate = 'unknown'): DigestValidation {
  const issues: DigestIssue[] = []
  const hasFrontmatter = raw.trimStart().startsWith('---')
  const { data, body } = parseFrontmatter(raw)
  const date = typeof data.date === 'string' && data.date ? data.date : fallbackDate

  if (!hasFrontmatter) {
    issues.push({ code: 'frontmatter-missing', message: 'document does not open with a --- block' })
  }

  for (const key of REQUIRED_KEYS) {
    const value = data[key]
    const empty = value === undefined || value === '' || (Array.isArray(value) && !value.length)
    if (empty) issues.push({ code: 'frontmatter-key', message: `"${key}" is missing or empty` })
  }

  if (typeof data.date === 'string' && data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    issues.push({ code: 'frontmatter-date', message: `"date" is not YYYY-MM-DD (got "${data.date}")` })
  }

  const { headings, content } = parseSections(body)
  const hasHeading = (name: string) => content.has(name.toLowerCase())

  for (const section of REQUIRED_SECTIONS) {
    if (!hasHeading(section)) {
      issues.push({ code: 'section-missing', message: `"## ${section}" heading is absent` })
    }
  }

  const tldr = content.get('tl;dr')
  const signals = content.get('signals')
  const sources = content.get('sources')

  const tldrBullets = countBullets(tldr)
  const signalCount = signals ? (signals.match(/^###\s+\S/gm) ?? []).length : 0
  const sourceLinks = countLinks(sources)
  const sourceBullets = countBullets(sources)

  for (const [section, text] of [
    ['TL;DR', tldr],
    ['Signals', signals],
    ['Sources', sources],
  ] as const) {
    if (text !== undefined && !text.trim()) {
      issues.push({ code: 'section-empty', message: `"## ${section}" has a heading but no content` })
    }
  }

  // A day with a single (or zero) story is the intentional quiet-day template —
  // it carries no links, so only require that the section says something.
  const declaredCount = typeof data.itemCount === 'number' ? data.itemCount : signalCount
  const quietDay = declaredCount <= 1

  if (quietDay) {
    if (sourceBullets < 1) {
      issues.push({ code: 'sources-empty', message: '"## Sources" lists nothing' })
    }
  } else {
    if (tldrBullets < MIN_TLDR_BULLETS) {
      issues.push({
        code: 'tldr-thin',
        message: `"## TL;DR" has ${tldrBullets} bullets, expected at least ${MIN_TLDR_BULLETS}`,
      })
    }
    if (signalCount < MIN_SIGNALS) {
      issues.push({
        code: 'signals-thin',
        message: `"## Signals" has ${signalCount} entries, expected at least ${MIN_SIGNALS}`,
      })
    }
    if (sourceLinks < MIN_SOURCE_LINKS) {
      issues.push({
        code: 'sources-thin',
        message: `"## Sources" has ${sourceLinks} links, expected at least ${MIN_SOURCE_LINKS}`,
      })
    }
  }

  const badLinks = [...body.matchAll(/\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim())
    .filter((href) => href && !/^https?:\/\/[^\s]+$/.test(href))

  if (badLinks.length) {
    issues.push({
      code: 'link-malformed',
      message: `${badLinks.length} link(s) are not absolute http(s) URLs, e.g. "${badLinks[0]}"`,
    })
  }

  if (body.includes('```')) {
    issues.push({ code: 'code-fence', message: 'body still contains a ``` code fence' })
  }

  if (/^\s*(Here(?:'s| is)|Sure[,!]|I can(?:not|'t))/im.test(body)) {
    issues.push({ code: 'preamble', message: 'body starts with conversational filler' })
  }

  if (/\b(lorem ipsum|TODO|TBD|placeholder)\b/i.test(body)) {
    issues.push({ code: 'placeholder', message: 'body contains placeholder text' })
  }

  const known = [...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS].map((name) => name.toLowerCase())
  const unknownSections = headings.filter((heading) => !known.includes(heading.toLowerCase()))

  if (unknownSections.length) {
    issues.push({
      code: 'section-unknown',
      message: `unexpected top-level section(s): ${unknownSections.join(', ')}`,
    })
  }

  // Briefings are an enhancement, so a missing one is never fatal — but a block
  // that opens and closes around nothing would render an empty disclosure.
  const briefPattern = new RegExp(`${BRIEF_OPEN}\\s*\\n([\\s\\S]*?)\\n${BRIEF_CLOSE}`, 'g')
  const briefings = [...body.matchAll(briefPattern)].map((match) => match[1].trim())
  for (const [index, content] of briefings.entries()) {
    if (!content) {
      issues.push({ code: 'brief-empty', message: `briefing #${index + 1} has no content` })
    }
  }

  return {
    ok: issues.length === 0,
    date,
    issues,
    stats: { tldrBullets, signalCount, sourceLinks, briefings: briefings.length },
  }
}

/** Throw when a generated document does not meet the required shape. */
export function assertDigestStructure(raw: string, date: string): DigestValidation {
  const result = validateDigestMdx(raw, date)
  if (!result.ok) throw new DigestStructureError(result.date, result.issues)
  return result
}
