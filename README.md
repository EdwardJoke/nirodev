# Daily Tech News — Yesterday in Tech, Every Morning

An AI-written daily tech digest. A new issue is generated every night at 00:00
(Asia/Shanghai) and published as a static site on GitHub Pages.

Live site: `https://edwardjoke.github.io/nirodev/`

## How publishing works

The site has no runtime backend. Articles are pre-built into JSON:

1. The generator writes one MDX file per day into `content/` (`YYYY-MM-DD.mdx`).
2. `backend/scripts/build-static.ts` compiles MDX into JSON under
   `frontend/public/data/` (`index.json`, `issue/<date>.json`, `search.json`,
   `status.json`, `trends.json`).
3. Vite builds `frontend/`; `scripts/build-routes.mjs` pre-renders one HTML
   file per route plus `404.html` so deep links (`/archive`, `/issue/<date>`)
   work on GitHub Pages.
4. `frontend/dist` is deployed via the `Deploy to GitHub Pages` workflow.

The browser only ever fetches `${BASE_URL}data/*.json`
(`frontend/src/lib/digest-data.ts`). A new MDX file is invisible on the live
site until the static JSON is rebuilt and deployed.

## Routes

| Route | Page |
| --- | --- |
| `/` | Landing |
| `/today` | Latest issue |
| `/archive` | Every issue, month by month |
| `/issue/:date` | One issue (`YYYY-MM-DD`) |
| `/topic/:tag` | Issues by tag |
| `/trends` | Rising topics/sources |

## Local development

```bash
cd backend && pnpm install && pnpm build:static  # content/*.mdx -> frontend/public/data/
cd frontend && pnpm install && pnpm dev           # http://localhost:5173
```

Production-equivalent build (includes route pre-rendering):

```bash
cd frontend && pnpm build:pages
```

## Automation

- `.github/workflows/daily-digest.yml` — nightly at 16:00 UTC (00:00 CST):
  generates the issue, commits `content/`, then explicitly requests a deploy
  (a `GITHUB_TOKEN` push does not trigger other workflows on its own).
- `.github/workflows/deploy.yml` — builds and deploys to GitHub Pages.
  Triggers on pushes to **`master`** touching `content/`, `frontend/`,
  `backend/scripts/`, `backend/src/`, `scripts/`, or itself; plus a nightly
  safety-net schedule and manual dispatch. Pages must be configured with
  **Source: GitHub Actions**.

## Debugging a missing issue

1. Check `https://edwardjoke.github.io/nirodev/data/index.json` — if the
   newest date is absent, the deploy didn't run or Pages served a cached copy.
2. If `index.json` has it but the UI is empty, open DevTools → Network and
   look for 404s on `/nirodev/data/index.json` or
   `/nirodev/data/issue/<date>.json` (wrong `VITE_BASE`/base path).
3. A direct visit to `/archive` or `/issue/<date>` 404ing means route
   pre-rendering (`scripts/build-routes.mjs`) didn't run or `404.html` is
   missing from the artifact.

## Layout

```
content/                 daily MDX issues (source of truth)
backend/scripts/         generator (generate-digest.ts), static builder (build-static.ts), verifier
backend/src/             digest store / index / trends
frontend/src/            React + React Router app (BrowserRouter, BASE_URL basename)
frontend/public/data/    generated JSON (gitignored, built at deploy time)
scripts/build-routes.mjs route pre-rendering for GitHub Pages SPA fallback
.github/workflows/      daily-digest.yml, deploy.yml
```
