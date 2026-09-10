import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeBrowser, serverIsUp, visit, VIEWPORTS } from './harness'

/**
 * The reference layer, measured on a canvas that cannot be asked what is on it.
 *
 * A unit test can prove `chooseLabels` picks the right places from projected
 * points. It cannot prove that anything reached the screen: the projection, the
 * visibility test, the draw order and the density wiring all sit between the
 * function and the pixels, and every one of them can be wrong while the unit
 * tests stay green. `data-labels` is what the surface says it drew on the last
 * frame, and these hold the feature to that number.
 */

const LAPTOP = VIEWPORTS.find((v) => v.name === 'laptop')!
const PHONE = VIEWPORTS.find((v) => v.name === 'phone')!

let up = false
beforeAll(async () => {
  up = await serverIsUp()
  if (!up) console.warn('\n  Nothing serving. Run "npm run test:ui".\n')
}, 30_000)

afterAll(async () => {
  await closeBrowser()
})

const labelsOn = async (page: import('playwright-core').Page): Promise<number | null> => {
  const el = await page.$('[data-labels]')
  if (!el) return null
  const raw = await el.getAttribute('data-labels')
  return raw === null ? null : Number(raw)
}

describe.runIf(process.env.SKIP_BROWSER !== '1')('the world has names on it', () => {
  /**
   * The assertion the whole layer exists for. Before it, every layer on this
   * canvas was a view of one sweep, so a quiet run drew a blank planet and
   * nothing said where anything was.
   */
  it('draws place labels by default', async () => {
    if (!up) return
    const v = await visit('/', LAPTOP, { waitFor: '[data-labels]' })
    try {
      expect(v.broke, 'the page threw before it could be measured').toEqual([])
      // The canvas animates; give the first frame a moment to publish its count.
      await v.page.waitForFunction(
        () => Number(document.querySelector('[data-labels]')?.getAttribute('data-labels') ?? 0) > 0,
        undefined,
        { timeout: 15_000 },
      )
      const drawn = await labelsOn(v.page)
      expect(drawn, 'the reference layer drew nothing').toBeGreaterThan(0)
    } finally {
      await v.close()
    }
  }, 120_000)

  /**
   * A budget is a ceiling, and a canvas that ignores it is a canvas that will
   * eventually try to draw 1251 words.
   */
  it('never draws more labels than the density allows', async () => {
    if (!up) return
    const v = await visit('/', LAPTOP, { waitFor: '[data-labels]' })
    try {
      await v.page.waitForFunction(
        () => Number(document.querySelector('[data-labels]')?.getAttribute('data-labels') ?? 0) > 0,
        undefined,
        { timeout: 15_000 },
      )
      const drawn = await labelsOn(v.page)
      // `balanced` is the default density; its budget is 30.
      expect(drawn).toBeLessThanOrEqual(30)
    } finally {
      await v.close()
    }
  }, 120_000)

  /**
   * The switch has to do something visible, and "off" has to reach the canvas
   * rather than only the preference. A toggle that flips a boolean while the
   * last frame's labels stay on screen is indistinguishable from a broken one.
   */
  it('stops drawing them when the layer is switched off', async () => {
    if (!up) return
    const v = await visit('/', LAPTOP, { waitFor: '[data-labels]' })
    try {
      await v.page.waitForFunction(
        () => Number(document.querySelector('[data-labels]')?.getAttribute('data-labels') ?? 0) > 0,
        undefined,
        { timeout: 15_000 },
      )
      const before = await labelsOn(v.page)
      expect(before).toBeGreaterThan(0)

      await v.page.click('button[aria-pressed="true"]:has-text("Places")')
      await v.page.waitForFunction(
        () => Number(document.querySelector('[data-labels]')?.getAttribute('data-labels') ?? -1) === 0,
        undefined,
        { timeout: 15_000 },
      )
      expect(await labelsOn(v.page)).toBe(0)
    } finally {
      await v.close()
    }
  }, 120_000)

  /**
   * A phone is where crowding actually hurts, and where the budget is doing the
   * most work: the same thirty-label ceiling over a third of the width.
   */
  it('keeps the labels sparse on a phone', async () => {
    if (!up) return
    const v = await visit('/', PHONE, { waitFor: '[data-labels]' })
    try {
      await v.page.waitForFunction(
        () => Number(document.querySelector('[data-labels]')?.getAttribute('data-labels') ?? 0) > 0,
        undefined,
        { timeout: 15_000 },
      )
      const drawn = await labelsOn(v.page)
      expect(drawn).toBeGreaterThan(0)
      /**
       * Fewer than a laptop draws, because the separation is enforced in pixels
       * and a phone has fewer of them. Asserted as a ceiling rather than an
       * exact number: the figure depends on the projection and the camera, and a
       * test pinned to today's value fails on a font metric.
       */
      expect(drawn).toBeLessThanOrEqual(30)
    } finally {
      await v.close()
    }
  }, 120_000)
})
