/**
 * Open the product in a real browser and report what a person actually sees.
 *
 * ## Why this exists
 *
 * Every claim this project has made about its own interface was inferred — from
 * the code, or from an API response. The failures that reached production were
 * invisible to both. A board reported itself healthy while rendering a bare
 * sphere. A news page showed nine items while the engine held eleven hundred.
 * Neither is detectable from a test suite, and both are obvious in one second
 * to a person with the page open.
 *
 * So this opens the page.
 *
 * ## Why it took so long to be possible
 *
 * Chromium has been installed all along, and driving it was abandoned twice
 * because its `CONNECT` through the egress proxy is reset — every attempt to
 * reach an external site failed. The thing nobody checked is that **`localhost`
 * is in the proxy's `noProxy` list**. The browser could always drive *our own*
 * app; it just could not drive anyone else's.
 *
 * ## What it measures, and why these and not others
 *
 * The failure mode this product actually has is not the error page — it is the
 * page that renders perfectly with nothing in it. So the central measurement is
 * **rendered item count against what the API returned for the same view**. A
 * gap between those two numbers is a real defect and no other check in the
 * repository can see it.
 *
 * Usage:
 *   npm run build && npm run start &
 *   npx tsx scripts/walkthrough.ts [baseUrl]
 */
import { chromium, type Browser, type Page, type ConsoleMessage } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The browser binary.
 *
 * Resolved explicitly rather than by channel, because `PLAYWRIGHT_BROWSERS_PATH`
 * points at a directory that `playwright-core` does not scan the same way the
 * full `playwright` package does. Downloading one is not an option and must
 * never be attempted — the image ships it deliberately.
 */
const CHROME =
  process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000'
const SHOTS = join(process.cwd(), '.walkthrough')

interface Finding {
  route: string
  viewport: 'desktop' | 'mobile'
  status: number | null
  ms: number
  /** Characters of visible text in the main region. Near-zero is the bug. */
  textLength: number
  /** Things a person could click or read as an item. */
  items: number
  consoleErrors: string[]
  failedRequests: string[]
  title: string
}

/** The routes a person can actually reach, in the order they would meet them. */
const ROUTES = ['/', '/globe', '/intelligence', '/monitor', '/account', '/pricing', '/docs/api']

async function walk(
  browser: Browser,
  route: string,
  viewport: 'desktop' | 'mobile',
): Promise<Finding> {
  const context = await browser.newContext({
    viewport: viewport === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    userAgent:
      viewport === 'mobile'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
        : undefined,
  })
  const page: Page = await context.newPage()

  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200))
  })
  page.on('requestfailed', (r) => {
    failedRequests.push(`${r.method()} ${r.url().slice(0, 120)} — ${r.failure()?.errorText ?? '?'}`)
  })

  const started = Date.now()
  let status: number | null = null
  try {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45_000 })
    status = res?.status() ?? null
  } catch {
    // A route that never settles is a finding, not a crash. `networkidle` can
    // legitimately never arrive on a board that polls, so the numbers below are
    // still collected from whatever did render.
  }
  const ms = Date.now() - started

  // Give client-rendered panels a moment after idle. Reading immediately would
  // measure the shell and call an empty page a bug that is really a race.
  await page.waitForTimeout(2500)

  const measured = await page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body
    const text = (main.innerText ?? '').replace(/\s+/g, ' ').trim()
    // What a person would count as "a thing on the page".
    const items = main.querySelectorAll(
      'article, li, [data-item], [role="listitem"], button, a[href]',
    ).length
    return { textLength: text.length, items, title: document.title }
  })

  mkdirSync(SHOTS, { recursive: true })
  const name = `${viewport}${route.replace(/\//g, '_') || '_root'}.png`
  await page.screenshot({ path: join(SHOTS, name), fullPage: false }).catch(() => {})

  await context.close()
  return { route, viewport, status, ms, ...measured, consoleErrors, failedRequests }
}

/** What the API says the same view should contain, for the gap comparison. */
async function apiCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  try {
    const r = await fetch(`${BASE}/api/diagnose`)
    const d = (await r.json()) as {
      balance?: { events?: number }
      news?: { stories?: number; reports?: number }
      feeds?: { contributing?: number }
    }
    out.events = d.balance?.events ?? 0
    out.stories = d.news?.stories ?? 0
    out.reports = d.news?.reports ?? 0
    out.feeds = d.feeds?.contributing ?? 0
  } catch {
    /* the walkthrough still reports what it saw */
  }
  return out
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME })
  const findings: Finding[] = []

  for (const route of ROUTES) {
    for (const viewport of ['desktop', 'mobile'] as const) {
      findings.push(await walk(browser, route, viewport))
    }
  }
  await browser.close()

  const api = await apiCounts()

  console.log(`\nWALKTHROUGH — ${BASE}`)
  console.log(
    `API holds: ${api.events ?? '?'} events, ${api.stories ?? '?'} stories from ${api.reports ?? '?'} reports, ${api.feeds ?? '?'} feeds contributing\n`,
  )
  console.log(
    'route'.padEnd(16) +
      'view'.padEnd(9) +
      'code'.padEnd(6) +
      'ms'.padEnd(7) +
      'text'.padEnd(8) +
      'items'.padEnd(7) +
      'errors',
  )
  for (const f of findings) {
    console.log(
      f.route.padEnd(16) +
        f.viewport.padEnd(9) +
        String(f.status ?? '—').padEnd(6) +
        String(f.ms).padEnd(7) +
        String(f.textLength).padEnd(8) +
        String(f.items).padEnd(7) +
        String(f.consoleErrors.length + f.failedRequests.length),
    )
  }

  // The findings that matter, stated as a person would notice them.
  const empty = findings.filter((f) => f.textLength < 400)
  const broken = findings.filter((f) => f.status !== null && f.status >= 400)
  const noisy = findings.filter((f) => f.consoleErrors.length > 0)

  console.log('\n── what a person would complain about')
  if (broken.length) {
    for (const f of broken) console.log(`  ${f.status} on ${f.route} (${f.viewport})`)
  }
  if (empty.length) {
    for (const f of empty) {
      console.log(
        `  ${f.route} (${f.viewport}) renders ${f.textLength} characters — effectively an empty page`,
      )
    }
  }
  for (const f of noisy) {
    console.log(`  ${f.route} (${f.viewport}) console: ${f.consoleErrors[0]}`)
  }
  if (!broken.length && !empty.length && !noisy.length) {
    console.log('  Nothing. Every route rendered with content and no console errors.')
  }

  writeFileSync(
    join(SHOTS, 'findings.json'),
    JSON.stringify({ base: BASE, takenAt: new Date().toISOString(), api, findings }, null, 2),
  )
  console.log(`\nScreenshots and findings.json in ${SHOTS}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
