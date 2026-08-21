import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every page fits every screen — the parts of that a test can actually hold.
 *
 * Most of this rule is checked by measuring real pages in a real browser at
 * real widths (`scripts/responsive-audit.mjs`), because layout is a property of
 * rendered pixels and not of source text. What is left here are the handful of
 * declarations that silently disable the whole arrangement if someone removes
 * them, each of which was already wrong once.
 */

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

/**
 * The same file with its comments removed. Every rule below is about what the
 * code does, and the comments have to be free to name the mistake they exist to
 * warn about — a doc comment explaining why `userScalable: false` is wrong must
 * not read as the codebase doing it.
 */
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')

describe('the page meets the screen on the terms we chose', () => {
  const layout = code('app/layout.tsx')

  /**
   * `viewportFit: 'cover'` is the switch that makes `env(safe-area-inset-*)`
   * report real numbers. Without it every inset reads 0, and the bottom
   * navigation's safe-area padding silently does nothing on exactly the phones
   * it exists for — a failure that looks like nothing at all in a desktop
   * browser.
   */
  it('opts into the full screen, so the safe-area insets are real', () => {
    expect(layout).toMatch(/viewportFit:\s*["']cover["']/)
  })

  /**
   * The usual pair reached for to stop iOS zooming a focused input. It also
   * takes pinch-zoom from every reader who needs it — WCAG 1.4.4 — in a product
   * whose readers span every language and every age. The right fix for the
   * input zoom is a 16px font on the input.
   */
  it('never takes zoom away from the reader', () => {
    expect(layout).not.toMatch(/userScalable:\s*false/)
    expect(layout).not.toMatch(/maximumScale:\s*1\b/)
  })
})

describe('the phone-shaped rules survive in the stylesheet', () => {
  const css = code('app/globals.css')

  /**
   * A finger needs about 44px and an analyst chip is 21px tall. Growing the
   * *touch* area rather than the visual one is what reconciles those, and it
   * must stay behind `pointer: coarse` — on a mouse the invisible overhang
   * swallows clicks meant for the control beside it.
   */
  it('grows touch targets only where the pointer is a finger', () => {
    expect(css).toContain('.touch-target')
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'))
    expect(coarse).toContain('.touch-target')
    expect(coarse).toContain('44px')
  })

  it('offers a row that scrolls rather than one that hides what does not fit', () => {
    expect(css).toContain('.scroll-row')
  })
})

describe('nothing sits under the phone’s own controls', () => {
  /**
   * The bar is `fixed bottom-0`, and on a phone the bottom edge is not the
   * bottom of the screen: iOS draws its home indicator over the last ~34px and
   * Android its gesture bar. Without the inset the tab labels live underneath
   * the system's control, and a tap there belongs to the operating system.
   */
  it('the tab bar clears the home indicator', () => {
    expect(code('components/bottom-nav.tsx')).toContain('safe-area-inset-bottom')
  })

  /**
   * And the page's own bottom padding has to track the bar rather than guess a
   * fixed height, or the last row of every page ends up behind it.
   */
  it('the page reserves room for however tall the bar turns out to be', () => {
    expect(code('app/page.tsx')).toContain('safe-area-inset-bottom')
  })
})

describe('a control that cannot be read is not a control', () => {
  /**
   * The globe's layer switcher hid its labels below 640px on the reasoning that
   * the sentence underneath names the layer. It names the *selected* one, so a
   * phone reader was given five unlabelled glyphs and had to tap each to learn
   * what it was — worse for the majority of our readers, who never met the icon
   * set it borrows from. It scrolls now, and every option stays readable.
   */
  it('the globe names every layer at every width', () => {
    const source = code('components/globe-view.tsx')
    expect(source).not.toMatch(/hidden sm:inline["'`]?>\{LAYER_META/)
    expect(source).toContain('scroll-row')
  })
})
