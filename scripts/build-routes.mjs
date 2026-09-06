#!/usr/bin/env node
/**
 * Pre-render SPA entry points so GitHub Pages can serve deep links directly.
 *
 * GitHub Pages has no SPA rewrite: without this, opening
 * `/archive` or `/issue/2026-08-28` straight from a shared link 404s.
 * We copy the built index.html into each route's own folder, so Pages finds a
 * real file while React still takes over routing on the client.
 *
 * Run AFTER `vite build`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'frontend', 'dist')
const dataDir = path.join(root, 'frontend', 'public', 'data')

const indexPath = path.join(dist, 'index.html')
if (!fs.existsSync(indexPath)) {
  console.error(`Missing ${indexPath} — run "vite build" first.`)
  process.exit(1)
}

const indexHtml = fs.readFileSync(indexPath, 'utf8')
const manifestPath = path.join(dataDir, 'index.json')

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath} — run the static content build first.`)
  process.exit(1)
}

const { digests = [] } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

// Every tag gets its own entry point. Keep the slug rule identical to the
// frontend's src/lib/topics.ts or the pre-rendered folders won't match.
const slugifyTag = (tag) =>
  tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const topics = [...new Set(digests.flatMap((digest) => digest.tags ?? []))]
  .map(slugifyTag)
  .filter(Boolean)

const routes = [
  '/today',
  '/archive',
  '/trends',
  ...topics.map((tag) => `/topic/${tag}`),
  ...digests.map((digest) => `/issue/${digest.date}`),
]
const writeRoute = (route) => {
  const target = path.join(dist, route, 'index.html')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, indexHtml, 'utf8')
}

routes.forEach(writeRoute)

// Stop GitHub Pages from running the output through Jekyll.
fs.writeFileSync(path.join(dist, '.nojekyll'), '')

// A sitemap helps search engines find every issue.
const origin = process.env.SITE_ORIGIN ?? ''
if (origin) {
  const urls = ['/', ...routes]
    .map(
      (route) =>
        `  <url><loc>${origin.replace(/\/$/, '')}${route}</loc><changefreq>daily</changefreq></url>`
    )
    .join('\n')
  fs.writeFileSync(
    path.join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    'utf8'
  )
  console.log(`sitemap written for ${origin}`)
}

// An RSS feed lets people read the digest in whichever reader they already
// use. Items reuse the search index, which holds one bullet list per issue.
const searchPath = path.join(dataDir, 'search.json')

if (origin && fs.existsSync(searchPath)) {
  const { entries = [] } = JSON.parse(fs.readFileSync(searchPath, 'utf8'))
  const bulletsByDate = new Map(entries.map((entry) => [entry.date, entry.bullets ?? []]))
  const site = origin.replace(/\/$/, '')

  const escapeXml = (value) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const items = digests
    .map((digest) => {
      const bullets = bulletsByDate.get(digest.date) ?? []
      const list = bullets.length
        ? `<ul>${bullets.map((bullet) => `<li>${escapeXml(bullet)}</li>`).join('')}</ul>`
        : ''
      const body = `<p>${escapeXml(digest.summary)}</p>${list}`
      // Escaped a second time so readers render the body as HTML.
      const description = escapeXml(body)

      return [
        '  <item>',
        `    <title>${escapeXml(digest.title)}</title>`,
        `    <link>${site}/issue/${digest.date}</link>`,
        `    <guid isPermaLink="false">daily-tech-news-${digest.date}</guid>`,
        `    <pubDate>${new Date(digest.generatedAt).toUTCString()}</pubDate>`,
        `    <description>${description}</description>`,
        '  </item>',
      ].join('\n')
    })
    .join('\n')

  fs.writeFileSync(
    path.join(dist, 'feed.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Daily Tech News</title>
    <link>${site}</link>
    <description>A daily digest of what moved in technology yesterday.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`,
    'utf8'
  )
  console.log(`rss feed written with ${digests.length} item(s)`)
}

console.log(`pre-rendered ${routes.length + 1} routes into ${dist}`)
