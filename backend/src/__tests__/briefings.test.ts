import { extractArticleText } from '../lib/article-reader'
import { attachBriefings, renderBriefing } from '../lib/briefing-embed'
import { extractiveSummary, sourceText } from '../lib/briefings'
import type { Briefing, NewsItem } from '../types/digest.types'

const longBody = 'Real article body about a chip launch. '.repeat(6)

const html = `<html>
  <head><script>var tracking = "<p>not body copy</p>";</script></head>
  <body>
    <nav>Navigation links and menu items that should never appear</nav>
    <article>
      <p>${longBody}</p>
      <p>Short.</p>
      <p>Another substantial paragraph with more detail about the launch.</p>
    </article>
    <footer>Footer text</footer>
  </body>
</html>`

const item = (overrides: Partial<NewsItem> = {}): NewsItem => ({
  title: 'A story',
  url: 'https://example.com/a',
  source: 'Example',
  publishedAt: '2026-09-01T09:00:00.000Z',
  ...overrides,
})

const briefing = (overrides: Partial<Briefing> = {}): Briefing => ({
  url: 'https://example.com/b',
  title: 'Story two',
  source: 'Example',
  mode: 'extract',
  summary: 'The second story in full.',
  points: ['A concrete detail.'],
  ...overrides,
})

describe('extractArticleText', () => {
  it('keeps the body copy and drops chrome', () => {
    const text = extractArticleText(html, 4000)
    expect(text).toContain('Real article body about a chip launch.')
    expect(text).toContain('Another substantial paragraph')
    expect(text).not.toContain('tracking')
    expect(text).not.toContain('Navigation links')
  })

  it('drops fragments too short to be body copy', () => {
    expect(extractArticleText(html, 4000)).not.toContain('Short.')
  })

  it('truncates on a word boundary', () => {
    const text = extractArticleText(html, 60)
    expect(text.length).toBeLessThanOrEqual(61)
    expect(text.endsWith('…')).toBe(true)
  })

  it('falls back to the whole document when no paragraphs exist', () => {
    expect(extractArticleText('<div>A bare page with only loose text.</div>', 500)).toContain(
      'A bare page with only loose text.'
    )
  })
})

describe('attachBriefings', () => {
  const mdx = [
    '## Signals',
    '',
    '### 1. Story one',
    '',
    'Prose about the first story.',
    '',
    '[Read more](https://example.com/a) — Example',
    '',
    '### 2. Story two',
    '',
    'Prose about the second story.',
    '',
    '[Read more](https://example.com/b) — Example',
    '',
  ].join('\n')

  it('places the block above the original link', () => {
    const output = attachBriefings(mdx, [briefing()])
    const blockAt = output.indexOf(':::brief')
    const linkAt = output.indexOf('[Read more](https://example.com/b)')
    expect(blockAt).toBeGreaterThan(-1)
    expect(blockAt).toBeLessThan(linkAt)
  })

  it('only touches the section that links to the article', () => {
    const output = attachBriefings(mdx, [briefing()])
    const firstSection = output.slice(output.indexOf('### 1.'), output.indexOf('### 2.'))
    expect(firstSection).not.toContain(':::brief')
  })

  it('leaves the document alone when nothing matches', () => {
    expect(attachBriefings(mdx, [briefing({ url: 'https://example.com/zzz' })])).toBe(mdx)
  })

  it('never stacks a second block on the same section', () => {
    const once = attachBriefings(mdx, [briefing()])
    expect(attachBriefings(once, [briefing()])).toBe(once)
  })

  it('never drops a briefing into TL;DR or Sources, which link the same articles', () => {
    const full = [
      '## TL;DR',
      '',
      '- The [story](https://example.com/b) matters.',
      '',
      '## Signals',
      '',
      '### 1. Story two',
      '',
      'Prose about the second story.',
      '',
      '[Read more](https://example.com/b) — Example',
      '',
      '## Sources',
      '',
      '- [Story two](https://example.com/b) — Example',
      '',
    ].join('\n')

    const output = attachBriefings(full, [briefing()])
    expect(output.match(/:::brief/g)).toHaveLength(1)
    expect(output.indexOf(':::brief')).toBeGreaterThan(output.indexOf('### 1.'))
    expect(output.indexOf(':::brief')).toBeLessThan(output.indexOf('## Sources'))
  })

  it('leaves sections that never mention the article alone', () => {
    const bare = '### 1. Story one\n\nProse that mentions no article at all.\n'
    expect(attachBriefings(bare, [briefing()])).toBe(bare)
  })

  it('appends after the last line when the link sits inside a sentence', () => {
    const bare = '### 1. Story one\n\nSee https://example.com/b for the detail.\n'
    const output = attachBriefings(bare, [briefing()])
    expect(output).toContain(':::brief')
    expect(output.indexOf(':::brief')).toBeGreaterThan(output.indexOf('See https://example.com/b'))
  })
})

describe('renderBriefing', () => {
  it('writes the summary followed by bullets', () => {
    const lines = renderBriefing(briefing({ points: ['One.', 'Two.'] }))
    expect(lines[0]).toBe(':::brief')
    expect(lines).toContain('The second story in full.')
    expect(lines).toContain('- One.')
    expect(lines[lines.length - 2]).toBe(':::')
  })

  it('omits the bullet list when there are no points', () => {
    expect(renderBriefing(briefing({ points: [] })).some((line) => line.startsWith('- '))).toBe(
      false
    )
  })
})

describe('sourceText', () => {
  it('prefers real article body over anything else', () => {
    const { quality, text } = sourceText(item({ excerpt: 'Feed summary.' }), longBody)
    expect(quality).toBe('article')
    expect(text).toBe(longBody)
  })

  it('falls back to the feed summary when the page yields nothing', () => {
    const excerpt = 'A feed summary long enough to stand on its own as a briefing.'
    const { quality, text } = sourceText(item({ excerpt }), '')
    expect(quality).toBe('excerpt')
    expect(text).toBe(excerpt)
  })

  it('ignores a feed summary too short to be worth repeating', () => {
    expect(sourceText(item({ excerpt: 'Too brief.' }), '').quality).toBe('metadata')
  })

  it('says plainly when nothing could be read', () => {
    const { quality, text } = sourceText(item({ points: 120, comments: 34 }))
    expect(quality).toBe('metadata')
    expect(text).toContain('could not be read automatically')
    expect(text).toContain('Example')
    expect(text).toContain('120 points')
    expect(text).toContain('2026-09-01')
  })

  it('treats a stumpy page as unread rather than an article', () => {
    expect(sourceText(item(), 'Too short.').quality).toBe('metadata')
  })

  it('builds a summary from whole sentences', () => {
    const text = 'First sentence here. Second sentence here. Third sentence here.'
    expect(extractiveSummary(text, 40)).toContain('First sentence here.')
    expect(extractiveSummary(text, 40)).not.toContain('Third')
  })
})
