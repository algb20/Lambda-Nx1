import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeBrowser, horizontalOverflow, serverIsUp, visit, VIEWPORTS } from './harness'

/**
 * Every page fits every screen, and nothing on it is unreachable.
 *
 * Charter S10: phone, tablet, laptop, desktop. This was an audit script whose
 * output a person read; a report nobody reads on the day it changes is not a
 * guarantee. As a test, a regression fails the build.
 */

const PAGES = [
  '/',
  '/globe',
  '/markets',
  '/intelligence',
  '/monitor',
  '/account',
  '/pricing',
  '/privacy',
  '/terms',
  '/docs/api',
]

/** Apple's and Google's floor for a touch target, and the one we hold to. */
const MIN_TOUCH_PX = 44

let up = false
beforeAll(async () => {
  up = await serverIsUp()
}, 30_000)

afterAll(async () => {
  await closeBrowser()
})

describe.runIf(process.env.SKIP_BROWSER !== '1')('nothing scrolls sideways', () => {
  /**
   * One load per page, resized through every width.
   *
   * ## Why not one load per page *per* width
   *
   * That is what it did, and it was fifty page loads costing several gateway
   * calls each. The server's own rate limit is 30 requests a minute per address
   * (`GATEWAY_LIMIT`), so the suite was refused — and for a while it passed
   * anyway, measuring geometry on pages whose every data call had returned 429.
   * Green over a blank document, which is the exact fault this codebase keeps
   * finding one layer up.
   *
   * Pacing the suite to the limit was correct and cost eleven minutes. Resizing
   * is better on every axis: what is under test is CSS answering a width, and
   * reloading the document to change a width tests the data path four extra
   * times per page for nothing. Ten loads instead of fifty, the same five widths
   * asserted, and the suite stays inside the limit without waiting.
   */
  it(
    'holds every page inside every width',
    async () => {
      if (!up) return
      const failures: string[] = []
      for (const path of PAGES) {
        const v = await visit(path, VIEWPORTS[VIEWPORTS.length - 1])
        try {
          /**
           * Checked before the geometry, always. A page that threw has no
           * overflow either and measures as perfectly laid out — the first
           * version of this audit reported a crashed globe as "ok" at every
           * width, and the second reported a rate-limited one as fitting.
           */
          if (v.broke.length > 0) {
            failures.push(`${path} broke: ${v.broke.slice(0, 2).join(' · ')}`)
            continue
          }
          for (const vp of VIEWPORTS) {
            await v.page.setViewportSize({ width: vp.width, height: vp.height })
            await v.page.waitForTimeout(200)
            const { overflows, scrollWidth, clientWidth } = await horizontalOverflow(v.page)
            if (overflows) {
              failures.push(`${path} at ${vp.name}: ${scrollWidth} > ${clientWidth}`)
            }
          }
        } finally {
          await v.close()
        }
      }
      expect(failures).toEqual([])
    },
    900_000,
  )
})

describe.runIf(process.env.SKIP_BROWSER !== '1')('a phone reader can hit every control', () => {
  /**
   * A control the thumb cannot land on is a control that is not there.
   *
   * ## What is measured, and the mistake the first version made
   *
   * This began by measuring `getBoundingClientRect()` on every button and link
   * and demanding 44px. It reported fifty-one failures, and it was wrong about
   * most of them, because this codebase already solves the problem a better way:
   * the `.touch-target` utility in `globals.css` grows the *hit area* to 44px
   * with a centred `::after`, leaving the visual box small. A 28px chip with a
   * 44px tap area is correct design, and a test that reads only the visual box
   * cannot see the thing that makes it correct.
   *
   * So the rule is: a control passes when its own box is big enough **or** it
   * carries the utility that guarantees the hit area. Anything else genuinely
   * has a target smaller than a fingertip.
   *
   * ## And what is not a control
   *
   * A headline in a list is an anchor, and it is *text* — it inherits the line
   * height of the row it sits in, and padding it to 44px would put a
   * finger-height gap between every item in a feed. Links are excluded and
   * buttons are not, because a button is always a target and a link is
   * sometimes a sentence.
   */
  it('gives every visible button a 44px tap area on a phone', async () => {
    if (!up) return
    const phone = VIEWPORTS.find((v) => v.name === 'phone')!
    const v = await visit('/', phone)
    try {
      expect(v.broke).toEqual([])
      /**
       * The **effective** hit area, not the drawn one.
       *
       * Measured from the `::after` the utility paints rather than from the
       * class name, so this checks that the mechanism works and not merely that
       * somebody remembered to type the word. `matchMedia('(pointer: coarse)')`
       * is confirmed first: the utility lives inside that query, and on a
       * context where it does not match, every control would be excused for a
       * reason that has nothing to do with the control.
       */
      const coarse = await v.page.evaluate(() => matchMedia('(pointer: coarse)').matches)
      expect(coarse, 'this viewport is not emulating a touch pointer').toBe(true)

      const small = await v.page.evaluate((min) => {
        const px = (s: string) => (s.endsWith('px') ? parseFloat(s) : 0)
        const out: string[] = []
        for (const el of document.querySelectorAll('button, [role="button"]')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          const after = getComputedStyle(el, '::after')
          // A pseudo-element with no `content` is not painted and has no area.
          const grown = after.content !== 'none' && after.content !== ''
          const w = Math.max(r.width, grown ? px(after.width) : 0)
          const h = Math.max(r.height, grown ? px(after.height) : 0)
          if (h >= min && w >= min) continue
          const label =
            (el.textContent ?? '').trim().slice(0, 40) ||
            el.getAttribute('aria-label') ||
            el.tagName
          out.push(`${label} — ${Math.round(w)}×${Math.round(h)}`)
        }
        return out
      }, MIN_TOUCH_PX)
      expect(small, 'controls too small to tap on a phone').toEqual([])
    } finally {
      await v.close()
    }
  }, 120_000)
})

describe.runIf(process.env.SKIP_BROWSER !== '1')('the dashboard band survives every width', () => {
  /**
   * The KPI strip and the layer rail are the two pieces this layout is built
   * around. A breakpoint change that drops either on one screen is invisible in
   * a unit test and obvious to a reader who has lost their controls.
   *
   * ## One page, resized — not five pages
   *
   * The first version opened a fresh context per viewport, and each one loaded
   * `/` and started its own world sweep. Five sweeps to test five *breakpoints*,
   * on top of the fifty visits the overflow tests had already made, and the
   * server stopped answering inside sixty seconds. The failure named a real
   * element at a real width and the cause was this file.
   *
   * Resizing one loaded page is also the more honest test: what is under test is
   * CSS responding to a width, and reloading the document at each width tests
   * the data path five more times for no reason. The report stays put, the
   * breakpoints are exercised, and the server is asked for the world once.
   */
  it('shows the KPI strip and the layer rail at every width', async () => {
    if (!up) return
    const widest = VIEWPORTS[VIEWPORTS.length - 1]
    const v = await visit('/', widest, { waitFor: '[aria-label="Picture quality for this run"]' })
    try {
      if (v.ready === false) {
        // Say what the page actually was. Two rounds were spent guessing at
        // this — a saturated server, then an exhausted browser — and both
        // guesses were wrong because nothing recorded what the reader would
        // have seen.
        const diag = await v.page.evaluate(() => ({
          url: location.href,
          title: document.title,
          bodyStart: document.body.innerText.trim().slice(0, 300).replace(/\s+/g, ' '),
          hasSurface: !!document.querySelector('[data-plotted]'),
          hasStrip: !!document.querySelector('[aria-label="Picture quality for this run"]'),
        }))
        throw new Error(`the world report never arrived: ${JSON.stringify(diag)}`)
      }

      const missing: string[] = []
      for (const vp of VIEWPORTS) {
        await v.page.setViewportSize({ width: vp.width, height: vp.height })
        // One frame for the layout to settle at the new width.
        await v.page.waitForTimeout(250)
        const present = await v.page.evaluate(() => {
          const visible = (sel: string) => {
            const el = document.querySelector(sel)
            if (!el) return false
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.height > 0
          }
          const strip = document.querySelector('[aria-label="Picture quality for this run"]')
          const cell = [...(strip?.children ?? [])].find((c) =>
            (c.textContent ?? '').toUpperCase().includes('REPORTING'),
          )
          return {
            strip: visible('[aria-label="Picture quality for this run"]'),
            rail: visible('[aria-label="Map layers by category"]'),
            reporting: Number((cell?.textContent ?? '').replace(/[^\d]/g, '').slice(0, 2) || 0),
          }
        })
        if (!present.strip) missing.push(`${vp.name}: no KPI strip`)
        // The rail only exists when the run carried categories to list, so its
        // absence is only a fault when the strip says something is reporting.
        if (!present.rail && present.reporting > 0) {
          missing.push(`${vp.name}: no layer rail while ${present.reporting} kinds report`)
        }
      }
      expect(missing).toEqual([])
    } finally {
      await v.close()
    }
  }, 300_000)
})
