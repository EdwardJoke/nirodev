import type { NewsItem } from '../types/digest.types'

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'on', 'in', 'at', 'to', 'of', 'is', 'are',
  'its', 'it', 'this', 'that', 'new', 'now', 'how', 'why', 'what', 'you', 'your', 'from', 'by',
  'as', 'be', 'will', 'can', 'has', 'have', 'not', 'says', 'said', 'get', 'gets', 'up', 'out',
  'about', 'after', 'over', 'into', 'more', 'than', 'they', 'them', 'their', 'his', 'her', 'our',
  'us', 'we', 'i', 'my', 'me', 'do', 'does', 'did', 'if', 'so', 'no', 'yes', 'just', 'also',
])

const KNOWN_TAGS: [RegExp, string][] = [
  [/\bai\b|llm|model|gpt|claude|gemini|openai|anthropic|copilot|agent/i, 'AI'],
  [/chip|gpu|nvidia|silicon|semiconductor|tsmc|intel|amd|arm|foundry|processor/i, 'Chips'],
  [/space|rocket|starship|nasa|satellite|orbit|moon|mars/i, 'Space'],
  [/lawsuit|court|regulat|antitrust|eu |gdpr|ftc|doj|policy|ban|fine|judge|ruling/i, 'Policy'],
  [/funding|raise[sd]?|series [a-e]|valuation|ipo|acquir|acquisition|merger|billion|investor/i, 'Business'],
  [/security|breach|hack|vulnerab|malware|ransom|exploit|cve|phishing|zero-day/i, 'Security'],
  [/crypto|bitcoin|ethereum|stablecoin|blockchain|web3|token/i, 'Crypto'],
  [/apple|google|microsoft|meta|amazon|tesla|netflix|samsung|bytedance|tiktok|xiaomi/i, 'Platforms'],
  [/open[- ]source|linux|kernel|rust|python|javascript|typescript|github|git /i, 'Open Source'],
  [/battery|ev |electric|solar|nuclear|climate|energy|grid/i, 'Energy'],
  [/quantum|biotech|crispr|research|study|scientists|lab/i, 'Science'],
]

function pickTags(items: NewsItem[]): string[] {
  const tags = new Set<string>()
  for (const item of items) {
    const text = `${item.title} ${item.excerpt ?? ''}`
    for (const [pattern, tag] of KNOWN_TAGS) {
      if (pattern.test(text)) tags.add(tag)
      if (tags.size >= 5) break
    }
    if (tags.size >= 5) break
  }
  return tags.size ? [...tags].slice(0, 5) : ['Technology']
}

function keywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
}

/** Pick the item whose title shares the most keywords with the rest of the set. */
function leadItem(items: NewsItem[]): NewsItem {
  let best = items[0]
  let bestScore = -1
  for (const candidate of items.slice(0, 12)) {
    const words = new Set(keywords(candidate.title))
    let score = candidate.points ?? 0
    for (const other of items) {
      if (other === candidate) continue
      const overlap = keywords(other.title).filter((word) => words.has(word)).length
      score += overlap * 6
    }
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

function shortTitle(text: string, maxWords = 7): string {
  const words = text.split(/\s+/).slice(0, maxWords).join(' ')
  return words.replace(/[,:;]$/, '')
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|')
}

export interface LocalIssueInput {
  date: string
  items: NewsItem[]
  generatedAt: string
}

/**
 * Deterministic fallback writer used when no Agnes key is configured.
 * Produces the same MDX shape as the model, sourced from the same real items.
 */
export function composeLocalMdx({ date, items, generatedAt }: LocalIssueInput): string {
  if (!items.length) {
    const body = [
      '## TL;DR',
      '',
      `- No qualifying tech story surfaced on ${date}.`,
      '- Sources were polled at 00:00 and returned nothing above the relevance threshold.',
      '- Check back after the next publication cycle.',
      '',
      '## Signals',
      '',
      '### 1. A quiet day',
      '',
      'Nothing in the monitored feeds crossed the signal threshold for this date. The archive below stays empty on purpose — no filler.',
      '',
      '## Sources',
      '',
      '- Monitored: Hacker News, TechCrunch, The Verge, Ars Technica, Wired, Engadget.',
    ].join('\n')

    return [
      '---',
      `date: "${date}"`,
      'title: "A Quiet Day in Tech"',
      'subtitle: "Nothing crossed the signal threshold"',
      `summary: "No qualifying tech story surfaced on ${date}. Monitored feeds returned nothing above threshold."`,
      'tags: ["Technology"]',
      'itemCount: 1',
      'source: local',
      'model: local-composer',
      `generatedAt: "${generatedAt}"`,
      '---',
      '',
      body,
      '',
    ].join('\n')
  }

  const lead = leadItem(items)
  const title = shortTitle(lead.title)
  const ordered = [lead, ...items.filter((item) => item !== lead)]
  const covered = ordered.slice(0, 10)

  const bullets = covered.slice(0, 6).map((item) => {
    const metric =
      typeof item.points === 'number' && item.points > 0
        ? ` — ${item.points} points on Hacker News`
        : ''
    return `- ${item.title} (${item.source})${metric}.`
  })

  const signals = covered.map((item, index) => {
    const lines = [`### ${index + 1}. ${item.title}`, '']
    const excerpt = item.excerpt?.trim()
    if (excerpt && excerpt.length > 40) {
      const sentences = excerpt.split(/(?<=\.)\s+/).filter(Boolean)
      let paragraph = ''
      for (const sentence of sentences) {
        if (paragraph && paragraph.length + sentence.length > 420) break
        paragraph += paragraph ? ` ${sentence}` : sentence
      }
      lines.push(paragraph || excerpt.slice(0, 420))
    } else {
      lines.push(
        `${item.source} carried this on ${date}. ${item.excerpt ? item.excerpt.slice(0, 260) : ''}`.trim()
      )
    }
    lines.push('', `[Read more](${item.url}) — ${item.source}${metricSuffix(item)}`, '')
    return lines.join('\n')
  })

  const withPoints = items.filter((item) => typeof item.points === 'number' && item.points > 0).slice(0, 5)

  const bodyParts: string[] = [
    '## TL;DR',
    '',
    ...bullets,
    '',
    '## Signals',
    '',
    signals.join('\n'),
  ]

  if (withPoints.length >= 2) {
    bodyParts.push(
      '## By the Numbers',
      '',
      '| Story | Metric | Source |',
      '| --- | --- | --- |',
      ...withPoints.map(
        (item) => `| ${escapeCell(shortTitle(item.title, 9))} | ${item.points} points, ${item.comments ?? 0} comments | ${item.source} |`
      ),
      ''
    )
  }

  bodyParts.push(
    '## Sources',
    '',
    ...covered.map((item) => `- [${item.title.replace(/\[|\]/g, '')}](${item.url}) — ${item.source}`),
    ''
  )

  const tags = pickTags(items)
  const summary =
    `${covered.length} stories moved on ${date}, led by ${itemSourcePhrase(lead)}. ` +
    `The rest of the day clustered around ${tags.slice(0, 3).join(', ')}.`

  return [
    '---',
    `date: "${date}"`,
    `title: ${JSON.stringify(title)}`,
    `subtitle: ${JSON.stringify(`${covered.length} stories, ${tags.slice(0, 2).join(' and ')}`)}`,
    `summary: ${JSON.stringify(summary)}`,
    `tags: ${JSON.stringify(tags)}`,
    `itemCount: ${covered.length}`,
    'source: local',
    'model: local-composer',
    `generatedAt: "${generatedAt}"`,
    '---',
    '',
    bodyParts.join('\n'),
  ].join('\n')
}

function metricSuffix(item: NewsItem): string {
  if (typeof item.points !== 'number' || item.points <= 0) return ''
  return `, ${item.points} points`
}

function itemSourcePhrase(item: NewsItem): string {
  return `${item.source}'s report on “${shortTitle(item.title, 6)}”`
}
