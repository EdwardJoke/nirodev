import {
  DigestStructureError,
  assertDigestStructure,
  validateDigestMdx,
} from '../lib/digest-validate'

const FRONTMATTER_DEFAULTS: Record<string, string> = {
  date: '"2026-09-01"',
  title: '"Chips and courtrooms"',
  subtitle: '"A busy Monday"',
  summary: '"Two sentences about the day."',
  tags: '["AI", "Chips"]',
  itemCount: '3',
  source: '"agnes"',
  model: '"agnes-2.5-flash"',
  generatedAt: '"2026-09-02T00:00:10+08:00"',
}

const frontmatter = (overrides: Record<string, string> = {}) => {
  const merged = { ...FRONTMATTER_DEFAULTS, ...overrides }
  const lines = Object.entries(merged).map(([key, value]) => `${key}: ${value}`)
  return ['---', ...lines, '---', ''].join('\n')
}

const body = [
  '## TL;DR',
  '',
  '- First thing happened and it matters.',
  '- Second thing happened and it matters.',
  '- Third thing happened and it matters.',
  '',
  '## Signals',
  '',
  '### 1. First thing',
  '',
  'Detail. [Read more](https://example.com/a) — Example',
  '',
  '### 2. Second thing',
  '',
  'Detail. [Read more](https://example.com/b) — Example',
  '',
  '### 3. Third thing',
  '',
  'Detail. [Read more](https://example.com/c) — Example',
  '',
  '## Sources',
  '',
  '- [First](https://example.com/a) — Example',
  '- [Second](https://example.com/b) — Example',
  '- [Third](https://example.com/c) — Example',
  '',
].join('\n')

const quietBody = [
  '## TL;DR',
  '',
  '- No qualifying tech story surfaced on 2026-09-01.',
  '- Sources were polled at 00:00 and returned nothing.',
  '- Check back after the next publication cycle.',
  '',
  '## Signals',
  '',
  '### 1. A quiet day',
  '',
  'Nothing crossed the signal threshold.',
  '',
  '## Sources',
  '',
  '- Monitored: Hacker News, TechCrunch, The Verge.',
  '',
].join('\n')

const codes = (raw: string) => validateDigestMdx(raw).issues.map((issue) => issue.code)

describe('validateDigestMdx', () => {
  it('accepts a well-formed issue', () => {
    const result = validateDigestMdx(`${frontmatter()}\n${body}`)
    expect(result.ok).toBe(true)
    expect(result.stats).toEqual({
      tldrBullets: 3,
      signalCount: 3,
      sourceLinks: 3,
      briefings: 0,
    })
  })

  it('accepts the quiet-day template, which carries no links', () => {
    const result = validateDigestMdx(`${frontmatter({ itemCount: '1' })}\n${quietBody}`)
    expect(result.ok).toBe(true)
  })

  it('rejects a missing section', () => {
    expect(codes(`${frontmatter()}\n${body.slice(0, body.indexOf('## Sources'))}`)).toContain(
      'section-missing'
    )
  })

  it('rejects too few signals', () => {
    const trimmed = body.replace(/### 2\.[\s\S]*?(?=## Sources)/, '')
    expect(codes(`${frontmatter()}\n${trimmed}`)).toContain('signals-thin')
  })

  it('rejects links that are not absolute urls', () => {
    expect(codes(`${frontmatter()}\n${body.replace('https://example.com/a)', '/a)')}`)).toContain(
      'link-malformed'
    )
  })

  it('rejects a leftover code fence', () => {
    expect(codes(`${frontmatter()}\n\`\`\`mdx\n${body}\n\`\`\``)).toContain('code-fence')
  })

  it('rejects conversational filler before the first heading', () => {
    expect(codes(`${frontmatter()}\nHere's the issue:\n\n${body}`)).toContain('preamble')
  })

  it('rejects placeholder text', () => {
    expect(codes(`${frontmatter()}\n${body.replace('Detail.', 'TODO fill in.')}`)).toContain(
      'placeholder'
    )
  })

  it('rejects missing frontmatter keys', () => {
    const raw = `${frontmatter()}\n${body}`.replace(/^model: .*\n/m, '')
    expect(codes(raw)).toContain('frontmatter-key')
  })

  it('rejects an unexpected top-level section', () => {
    const raw = `${frontmatter()}\n${body.replace('## Sources', '## Final Thoughts\n\n- nope\n\n## Sources')}`
    expect(codes(raw)).toContain('section-unknown')
  })
})

describe('assertDigestStructure', () => {
  it('throws a DigestStructureError carrying every issue', () => {
    expect(() => assertDigestStructure(`${frontmatter()}\n${body.slice(0, body.indexOf('## Sources'))}`, '2026-09-01')).toThrow(
      DigestStructureError
    )
  })

  it('returns the stats for a valid document', () => {
    expect(assertDigestStructure(`${frontmatter()}\n${body}`, '2026-09-01').ok).toBe(true)
  })
})
