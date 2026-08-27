import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, boxOf, closeBrowser, serverIsUp, visit, VIEWPORTS } from './harness'

/**
 * The page must tell one story.
 *
 * Every assertion here was bought by a fault that shipped, and every one of
 * them is about a *relationship* — the thing a unit test cannot hold, because
 * it never sees both halves at once.
 */

const LAPTOP = VIEWPORTS.find((v) => v.name === 'laptop')!
const PHONE = VIEWPORTS.find((v) => v.name === 'phone')!
const DESKTOP = VIEWPORTS.find((v) => v.name === 'desktop')!

/** The world report the page is drawing, read from the same API the page reads. */
async function worldSummary(): Promise<{
  total: number
  placed: number
  newestAt: string | null
  untimed: number
  generatedAt: string
}> {
  const res = await fetch(`${BASE}/api/world`, { signal: AbortSignal.timeout(60_000) })
  const body = (await res.json()) as {
    generatedAt: string
    summary: { total: number; placed: number; newestAt: string | null; untimed: number }
  }
  return { ...body.summary, generatedAt: body.generatedAt }
}

let up = false
beforeAll(async () => {
  up = await serverIsUp()
  if (!up) {
    console.warn(
      `\n  Nothing serving at ${BASE}. Run "npm run test:ui" to build, serve and test.\n`,
    )
  }
}, 30_000)

afterAll(async () => {
  await closeBrowser()
})

describe.runIf(process.env.SKIP_BROWSER !== '1')('the map draws exactly what the engine placed', () => {
  /**
   * Null Island, as an assertion.
   *
   * A canvas is opaque to a browser test: the element measures the same whether
   * it drew the right marks, the wrong marks, or nothing. So the surface states
   * how many marks it was handed (`data-plotted`), and this holds that number
   * to the engine's own count of events it could place.
   *
   * When it failed, `placed` was 0 and `data-plotted` was 10 — ten events with
   * no coordinate, cast to numbers they never had, drawn as a cluster labelled
   * "10" off the coast of Ghana while the badge above read "0 of 10 on the map".
   */
  it('hands the canvas one mark per placed event, and none for the unplaceable', async () => {
    if (!up) return
    const summary = await worldSummary()
    const v = await visit('/', LAPTOP, { waitFor: '[data-plotted]' })
    try {
      expect(v.broke, 'the page threw before it could be measured').toEqual([])
      const plotted = await v.page.evaluate(() => {
        const el = document.querySelector('[data-plotted]')
        return el ? Number(el.getAttribute('data-plotted')) : null
      })
      expect(plotted, 'the world surface did not render').not.toBeNull()
      expect(plotted).toBe(summary.placed)
    } finally {
      await v.close()
    }
  }, 120_000)

  /**
   * The specific shape of the bug, stated separately so a failure reads
   * plainly: nothing to plot must mean nothing plotted.
   */
  it('draws nothing at all when no event carries a coordinate', async () => {
    if (!up) return
    const summary = await worldSummary()
    if (summary.placed !== 0) return // Only meaningful on a run with no placeable events.
    const v = await visit('/', LAPTOP, { waitFor: '[data-plotted]' })
    try {
      const plotted = await v.page.evaluate(() =>
        Number(document.querySelector('[data-plotted]')?.getAttribute('data-plotted') ?? -1),
      )
      expect(plotted, 'events with no location were plotted somewhere').toBe(0)
    } finally {
      await v.close()
    }
  }, 120_000)
})

describe.runIf(process.env.SKIP_BROWSER !== '1')('the live edge is the publisher’s clock', () => {
  /**
   * The strip printed **just now** in green over a run whose freshest item was
   * three hours old, because `newestAt` reduced over our own retrieval time.
   *
   * The assertion is not "it is old" — a genuinely live run is *supposed* to
   * read "just now". It is that the figure is not *pinned* to the fetch: if the
   * newest observation is materially older than the sweep, the page must say so.
   */
  it('does not report the fetch time as the age of the picture', async () => {
    if (!up) return
    const summary = await worldSummary()
    if (!summary.newestAt) return // Nothing dated; the "—" case is a unit test.
    const lagMs = Date.parse(summary.generatedAt) - Date.parse(summary.newestAt)
    if (lagMs < 60 * 60_000) return // Genuinely fresh; nothing to distinguish.

    const v = await visit('/', LAPTOP, { waitFor: '[data-plotted]' })
    try {
      const edge = await v.page.evaluate(() => {
        const strip = document.querySelector('[aria-label="Picture quality for this run"]')
        if (!strip) return null
        const cell = [...strip.children].find((c) =>
          (c.textContent ?? '').toUpperCase().includes('LIVE EDGE'),
        )
        return cell ? (cell.textContent ?? '').trim() : null
      })
      expect(edge, 'the KPI strip did not render a live-edge figure').not.toBeNull()
      expect(
        edge,
        `newest observation is ${Math.round(lagMs / 60_000)} minutes older than the sweep, so "just now" is false`,
      ).not.toContain('just now')
    } finally {
      await v.close()
    }
  }, 120_000)
})

describe.runIf(process.env.SKIP_BROWSER !== '1')('the map keeps the screen it needs', () => {
  /**
   * A rail that measured fine alone took a third of the map in context: this
   * tab already spends 26rem on a context rail from `xl`, and a second vertical
   * rail beside it left the canvas 530px of a 752px pane.
   *
   * Expressed as a share rather than a pixel count, because the failure is
   * always "chrome grew", never "the screen shrank".
   */
  it('gives the canvas most of its own pane on a laptop', async () => {
    if (!up) return
    // Waits for the *loaded* strip, not the canvas: the canvas renders
    // immediately and the skeletons above it are a different height from the
    // real thing, so measuring too early measures a layout nobody ever sees.
    const v = await visit('/', LAPTOP, { waitFor: '[aria-label="Picture quality for this run"]' })
    try {
      const measured = await v.page.evaluate(() => {
        const surface = document.querySelector('[data-plotted]')
        if (!surface) return null
        // The pane the map competes for: its nearest laid-out ancestor row.
        const pane = surface.closest('.flex.flex-col') ?? surface.parentElement
        return {
          canvas: Math.round(surface.getBoundingClientRect().width),
          pane: Math.round((pane as Element).getBoundingClientRect().width),
        }
      })
      expect(measured, 'the world surface did not render').not.toBeNull()
      const { canvas, pane } = measured!
      expect(
        canvas / pane,
        `the map has ${canvas}px of a ${pane}px pane — chrome has taken too much of it`,
      ).toBeGreaterThan(0.7)
    } finally {
      await v.close()
    }
  }, 120_000)

  /**
   * How much screen is spent before the thing the page exists to show.
   *
   * Measured at 33% / 42% / 49% on desktop / laptop / phone before the
   * dashboard band existed, which is what forced the control band into one row.
   * The band then took the phone figure to **81%** — a whole screen of
   * instrumentation before the world it instruments — and moving the scrubber
   * and the layer rail below the canvas under `xl` brought it back.
   *
   * Measured after: **52% phone · 45% laptop · 33% desktop.** The threshold is
   * set with headroom above the worst of those rather than at it, because a
   * limit pinned to today's exact number fails on a font metric.
   */
  it('does not spend half the screen before the map begins', async () => {
    if (!up) return
    for (const vp of [PHONE, LAPTOP, DESKTOP]) {
      const v = await visit('/', vp, { waitFor: '[aria-label="Picture quality for this run"]' })
      try {
        const box = await boxOf(v.page, '[data-plotted]')
        expect(box, `the world surface did not render at ${vp.name}`).not.toBeNull()
        expect(
          box!.y / vp.height,
          `${vp.name}: the map starts ${box!.y}px down a ${vp.height}px screen`,
        ).toBeLessThan(0.62)
      } finally {
        await v.close()
      }
    }
  }, 300_000)
})
