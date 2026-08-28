import { chromium, type Browser, type Page } from 'playwright-core'

/**
 * The shared browser for the layout suite.
 *
 * ## Why this suite exists at all
 *
 * The codebase has ~2,500 unit tests and they are good ones. In a single
 * afternoon a real browser found three faults that not one of them could have
 * caught, because none of the three lives inside a module:
 *
 * 1. **Null Island.** The canvas drew a cluster labelled `10` in the Gulf of
 *    Guinea while the badge above it read `0 of 10 on the map` and the sentence
 *    below said there was nothing to plot. Three surfaces disagreeing; each
 *    correct on its own terms.
 * 2. **A live edge that could not be stale.** The strip printed a confident
 *    "just now" over a picture three hours old, because the figure it read was
 *    our own fetch clock.
 * 3. **A map squeezed to 530px** by a rail that measured fine in isolation and
 *    was a third column of chrome in context.
 *
 * Every one of those is a *relationship* — between the data and the drawing,
 * between two panels, between a component and the page it lands in. A unit test
 * cannot hold a relationship whose two halves it never sees at once.
 *
 * ## Why it is not in the default `vitest run`
 *
 * It needs a production build and a running server, which is thirty seconds
 * before the first assertion. Making the fast suite slow is how a fast suite
 * stops being run. `npm run test:ui` builds, serves and runs this; the file
 * skips with a clear message rather than failing when nothing is listening, so
 * a developer who runs it by accident is told what to do instead of being
 * shown a stack trace.
 */

/** Where the built app is expected to be serving. */
export const BASE = process.env.BASE ?? 'http://127.0.0.1:3111'

/**
 * Chromium is preinstalled here; `PLAYWRIGHT_BROWSERS_PATH` points at it.
 * Resolved at call time rather than baked in, so a different image works.
 */
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

/**
 * `--no-proxy-server` because this environment sets an outbound HTTP proxy for
 * everything and Chromium honours it even for 127.0.0.1. Without the flag the
 * proxy answers 400 for every `/_next/static/*` asset — no CSS, no JavaScript,
 * no hydration — and the suite measures a page that never ran, reporting the
 * harness as if it were the app. That is a worse failure than not running: it
 * produces green geometry over a blank document.
 */
const LAUNCH_ARGS = ['--no-sandbox', '--no-proxy-server']

/** Widths a real person uses. Named, because a failure should say "phone". */
export const VIEWPORTS = [
  { name: 'phone-small', width: 320, height: 640 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'desktop', width: 1920, height: 1080 },
] as const

export type Viewport = (typeof VIEWPORTS)[number]

/** Is anything serving? Decides between running the suite and skipping it. */
export async function serverIsUp(): Promise<boolean> {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(4000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * The suite paces itself to the server's own rate limit.
 *
 * ## The evidence
 *
 * Adding `4xx` on `/api/*` to what a visit records turned a vague failure into
 * a precise one: **429 Too Many Requests**, on `/api/world`, `/api/preferences`,
 * `/api/monitors` and the rest. `GATEWAY_LIMIT` in `lib/rate-limit.ts` allows
 * 30 requests a minute per address, and the suite visits ten pages at five
 * widths — every one of them costing several gateway calls from one address.
 *
 * The limiter was right and the suite was the abusive client. Two earlier
 * guesses — a saturated server, an exhausted browser — were both wrong, and
 * both were guesses made because nothing was recording what the page received.
 *
 * ## Why pacing rather than an exemption
 *
 * A loopback bypass would be a real hole: platforms that terminate TLS in front
 * of the app routinely present the proxy's address to it, so "trust 127.0.0.1"
 * can mean "trust everyone" on exactly the deployment that most needs the
 * limit. The suite waits instead. It is slower and it tests the app as shipped.
 *
 * ## And what this caught in the suite itself
 *
 * Before the `4xx` reporting, the overflow tests **passed** on pages whose every
 * data call had been refused — green geometry over an empty document, which is
 * the same "healthy over blank" fault this codebase keeps finding one layer up.
 */
const GATEWAY_LIMIT = 30
const GATEWAY_WINDOW_MS = 60_000

/**
 * Gateway calls a single visit is assumed to cost.
 *
 * Measured from what a visit to `/` actually requests: two world sweeps (the
 * first-light pass and the full one) plus preferences, and the busier pages add
 * one or two more. Six is the observed worst case, and the budget is spent at
 * the worst case rather than the average — a pacer that is right on average is
 * a pacer that is wrong exactly when the page is heaviest.
 */
const CALLS_PER_VISIT = 6

const visitTimes: number[] = []

/**
 * Which API statuses mean the *page* is broken.
 *
 * Not "any 4xx or 5xx", which is where this started and which reported the app
 * as broken three times over for behaving exactly as designed:
 *
 * - **401 / 403** — the suite browses signed out, and `/api/monitors`,
 *   `/api/calibration` and `/api/suggestions` require an account. Refusing an
 *   anonymous reader is the access control working, and a harness that calls it
 *   a fault is asking the app to leak.
 * - **503** — `/api/investigations` and the Pi claim route answer this when no
 *   database is configured, which is true of this environment. Saying so is the
 *   honest answer; a test that demanded 200 would be demanding a fabrication.
 *
 * What remains genuinely is a fault: **429**, which means the suite is the
 * abusive client (it was, and the pacing above is the answer), and the 5xx
 * range that is not a declared unavailability — a route that actually threw.
 */
function isApiFault(status: number): boolean {
  if (status === 401 || status === 403) return false
  if (status === 503) return false
  return status === 429 || status >= 500 || status === 408
}

/** Wait, if needed, so this visit does not push us past the server's limit. */
async function payVisitBudget(): Promise<void> {
  for (;;) {
    const now = Date.now()
    while (visitTimes.length > 0 && now - visitTimes[0] > GATEWAY_WINDOW_MS) visitTimes.shift()
    const spent = visitTimes.length * CALLS_PER_VISIT
    if (spent + CALLS_PER_VISIT <= GATEWAY_LIMIT) {
      visitTimes.push(now)
      return
    }
    // Sleep until the oldest visit falls out of the window, plus a little.
    const wait = GATEWAY_WINDOW_MS - (now - visitTimes[0]) + 250
    await new Promise((r) => setTimeout(r, wait))
  }
}

let browser: Browser | null = null
let contextsOpened = 0

/**
 * How many contexts one browser process serves before it is replaced.
 *
 * ## Why this is here
 *
 * The overflow tests open ten pages at five widths, and after those fifty
 * contexts the *browser* — not the server — stopped loading pages: the next
 * visit waited sixty seconds for a report that a `curl` against the same server
 * returned in **8ms**. A long-lived Chromium accumulating fifty closed contexts
 * in a small container is a harness problem wearing a product problem's clothes,
 * and it cost two rounds of chasing a layout bug that did not exist.
 *
 * Twenty-five is under half the point where it was observed to degrade and high
 * enough that a relaunch costs the suite about a second in total.
 */
const CONTEXTS_PER_BROWSER = 25

export async function getBrowser(): Promise<Browser> {
  if (browser && contextsOpened >= CONTEXTS_PER_BROWSER) {
    await closeBrowser()
  }
  if (!browser) {
    browser = await chromium.launch({ executablePath: EXECUTABLE, args: LAUNCH_ARGS })
    contextsOpened = 0
  }
  return browser
}

export async function closeBrowser(): Promise<void> {
  await browser?.close()
  browser = null
  contextsOpened = 0
}

export interface Visit {
  page: Page
  /** Anything the page threw, and any `/_next/` asset that failed to load. */
  broke: string[]
  /**
   * Whether the `waitFor` selector actually appeared, when one was asked for.
   *
   * `null` when nothing was waited on. This exists because swallowing the
   * timeout silently — which the first version did — turns **too slow** into
   * **missing**, and those need different fixes. It produced exactly that:
   * a run right after a build reported "desktop: no KPI strip" when the strip
   * was fine and the server was still compiling the route.
   */
  ready: boolean | null
  close: () => Promise<void>
}

/**
 * Open a path at a viewport and wait for it to settle.
 *
 * A page that threw has no overflow either, and measures as perfectly laid out.
 * So every visit collects what broke, and the callers assert on it first —
 * anything that failed to render is the loudest finding here, not the quietest.
 */
export async function visit(
  path: string,
  vp: Viewport,
  /**
   * A selector to wait for before the visit is considered ready.
   *
   * A fixed wait is a guess, and it was wrong: 2.5s was enough on a desktop
   * context and not on an emulated phone, where the same page took nine
   * seconds to finish its sweep. A test that measures a half-loaded page
   * reports the elements it has not seen yet as *missing*, which is the most
   * misleading failure a suite can produce — it names a real element, at a real
   * viewport, and the fault is the clock.
   */
  opts: { waitFor?: string } = {},
): Promise<Visit> {
  await payVisitBudget()
  const b = await getBrowser()
  contextsOpened++
  const ctx = await b.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.width < 768,
    hasTouch: vp.width < 768,
  })
  const page = await ctx.newPage()
  const broke: string[] = []
  page.on('pageerror', (err) => broke.push(String(err.message).slice(0, 200)))
  page.on('requestfailed', (req) => {
    /**
     * A cancelled request is not a failed one.
     *
     * `lib/http/discard` cancels response bodies the app has decided not to
     * read — that is the fix that lets a page reach quiescence at all. Chromium
     * reports each of those as `net::ERR_ABORTED`, and this handler flagged
     * them as breakage, so the suite called the fix a fault. `ERR_ABORTED` also
     * covers a navigation that superseded an in-flight request, which is
     * likewise the browser working.
     *
     * What remains reportable is a request that genuinely could not complete:
     * DNS, TLS, connection refused, timeout.
     */
    const why = req.failure()?.errorText ?? ''
    if (req.url().includes('/api/') && !why.includes('ERR_ABORTED')) {
      broke.push(`request failed: ${new URL(req.url()).pathname} — ${why}`)
    }
  })
  page.on('response', (res) => {
    const path = new URL(res.url()).pathname
    const status = res.status()
    // A build asset that 404s means the page never really ran. Always a fault.
    if (status >= 400 && path.startsWith('/_next/')) broke.push(`${status} ${path}`)
    if (status >= 400 && path.startsWith('/api/') && isApiFault(status)) {
      broke.push(`${status} ${path}`)
    }
  })
  /**
   * `domcontentloaded`, not `networkidle`.
   *
   * `networkidle` waits for 500ms with no more than two open connections, and
   * several of our pages never reach it: the live rail and the price tape hold
   * a socket open on purpose, and a gateway page that is mid-sweep has requests
   * in flight for as long as the sweep takes. `/intelligence` timed out at
   * sixty seconds every time, which failed **five** overflow tests across five
   * viewports for one reason that had nothing to do with layout.
   *
   * A test harness that reports the app broken when the harness is wrong is
   * worse than no harness: it teaches the reader to disbelieve red.
   */
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  /**
   * Then wait for the thing we actually care about — hydration having run and
   * the first data having landed — rather than for the network to fall silent.
   * The body carrying rendered content is the signal; the fixed wait after it
   * covers the first canvas frame, which no event announces.
   */
  await page
    .waitForFunction(() => document.body.innerText.trim().length > 200, undefined, {
      timeout: 30_000,
    })
    .catch(() => undefined)
  let ready: boolean | null = null
  if (opts.waitFor) {
    // Not fatal on timeout — "this never appeared" is a finding the caller
    // should report in its own words — but recorded, so the caller can tell
    // a missing element from a slow one.
    /**
     * Sixty seconds, not thirty.
     *
     * Measured directly, the strip lands in 452ms at 320px and 2.0s at 390px.
     * Inside the suite it once took longer than thirty: the overflow tests visit
     * ten pages at five viewports first, and every visit to `/` starts two world
     * sweeps, so by the time the dashboard test runs the server has been asked
     * for the world a hundred times in a few minutes. That is this suite's own
     * load and not a property of the app, and a limit tight enough to catch it
     * would fail for a reason no reader of the failure could act on.
     */
    ready = await page
      .waitForSelector(opts.waitFor, { timeout: 60_000 })
      .then(() => true)
      .catch(() => false)
  }
  await page.waitForTimeout(2_500)
  return { page, broke, ready, close: () => ctx.close() }
}

/** Does the document scroll sideways? The one failure a reader cannot work around. */
export async function horizontalOverflow(
  page: Page,
): Promise<{ overflows: boolean; scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => {
    const el = document.documentElement
    return {
      // One pixel of slack: sub-pixel layout rounding is not a design fault.
      overflows: el.scrollWidth > el.clientWidth + 1,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }
  })
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** A rounded bounding box for one selector, or null when it is not on the page. */
export async function boxOf(page: Page, selector: string): Promise<Box | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }, selector)
}
