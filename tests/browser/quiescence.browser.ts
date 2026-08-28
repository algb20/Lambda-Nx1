import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, closeBrowser, getBrowser, serverIsUp, VIEWPORTS } from './harness'

/**
 * The page goes quiet.
 *
 * ## What this locks in, and the claim it corrects
 *
 * Ten fetch sites decided from `res.status` and returned without touching the
 * response body. The browser holds that stream until it is read or cancelled,
 * so three routes never reached network quiescence at all. `lib/http/discard`
 * fixes it; this test is what stops it coming back, because the fault is
 * invisible everywhere else — the panel renders correctly, the status is right,
 * and the network panel shows a completed request.
 *
 * It also pins the honest version of the claim. The change was first defended
 * as making the **`load` event** fire. It does not: `load` covers the document
 * and its declared subresources, and a `fetch` a script starts is not part of
 * that accounting. Measured on a build without the fix, `load` fired at
 * 150/153/141ms on the three "never idle" routes — before any of this.
 *
 * So both facts are asserted here, and the second is why the first is
 * believable: `load` was always fast, quiescence was always broken, and only
 * one of those changed.
 *
 * | route | networkidle before | after |
 * |---|---|---|
 * | `/monitor` | never (20s) | 754ms |
 * | `/intelligence` | never (20s) | 716ms |
 * | `/account` | never (20s) | 714ms |
 *
 * ## Why `/` is not in the list
 *
 * The globe holds a live stream open on purpose — that is the product working,
 * not a leak. It reached idle in 7.1s here and it is not required to; a test
 * demanding quiescence from a page designed to stream would be a test demanding
 * the feature be removed.
 */

/**
 * Routes that must go quiet, and the budget.
 *
 * Measured at ~715–755ms on this machine. Four seconds is generous enough to
 * survive a slower machine or a cold route and far short of the failure it
 * guards, which was **never** — the distinction this test exists for is
 * "settles" versus "does not", not a stopwatch.
 */
const MUST_SETTLE = ['/monitor', '/intelligence', '/account']
const SETTLE_BUDGET_MS = 4_000

/** `load` was never the problem; this is the number that proves it. */
const LOAD_BUDGET_MS = 3_000

let up = false
beforeAll(async () => {
  up = await serverIsUp()
}, 30_000)

afterAll(async () => {
  await closeBrowser()
})

describe.runIf(process.env.SKIP_BROWSER !== '1')('abandoned responses do not hold the page open', () => {
  it(
    'lets every non-streaming route reach network quiescence',
    async () => {
      if (!up) return
      const desktop = VIEWPORTS[VIEWPORTS.length - 1]
      const browser = await getBrowser()
      const results: Array<{ path: string; load: number | null; idle: number | null }> = []

      for (const path of MUST_SETTLE) {
        const ctx = await browser.newContext({
          viewport: { width: desktop.width, height: desktop.height },
        })
        const page = await ctx.newPage()
        try {
          const started = Date.now()
          let load: number | null = null
          page.on('load', () => {
            if (load === null) load = Date.now() - started
          })
          await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 40_000 })
          const idle = await page
            .waitForLoadState('networkidle', { timeout: SETTLE_BUDGET_MS + 4_000 })
            .then(() => Date.now() - started)
            .catch(() => null)
          results.push({ path, load, idle })
        } finally {
          await ctx.close()
        }
      }

      const stuck = results.filter((r) => r.idle === null)
      expect(
        stuck.map((r) => `${r.path} never went quiet — a response body is being abandoned unread`),
      ).toEqual([])

      const slow = results.filter((r) => (r.idle ?? 0) > SETTLE_BUDGET_MS)
      expect(slow.map((r) => `${r.path} settled in ${r.idle}ms, over ${SETTLE_BUDGET_MS}ms`)).toEqual(
        [],
      )

      /**
       * And the correction, asserted rather than only written down: `load` is
       * fast, and was fast before any of this. A future reader who finds this
       * change and assumes it bought a page-load win has this in front of them.
       */
      const slowLoad = results.filter((r) => r.load === null || r.load > LOAD_BUDGET_MS)
      expect(
        slowLoad.map((r) => `${r.path} load=${r.load ?? 'never'} — load was never the problem here`),
      ).toEqual([])
    },
    300_000,
  )
})
