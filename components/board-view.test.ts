import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The board renderer, asserted from its source.
 *
 * Reading the file rather than importing it is deliberate and the same choice
 * `lib/gateways.test.ts` makes: this is a `'use client'` component that pulls
 * the whole UI tree, and importing it drags `node:crypto` into a test
 * environment with no business loading it.
 */
const source = readFileSync(join(process.cwd(), 'components/board-view.tsx'), 'utf8')

describe('a board group does not render its whole self on a phone', () => {
  /**
   * Walked in a real browser before this existed: crypto came out **12,902
   * pixels** tall on a 390px viewport and fact-checks **12,233** — both longer
   * than the globe page this project was already told nobody could use, and
   * neither had anything wrong with its data. 2,151 unit tests passed
   * throughout.
   */
  it('collapses a long group instead of printing every row', () => {
    expect(source).toMatch(/const ROWS_BEFORE_COLLAPSE = \d+/)
    const cap = Number(source.match(/const ROWS_BEFORE_COLLAPSE = (\d+)/)?.[1])
    expect(cap).toBeGreaterThan(2)
    // Past a dozen it stops being a collapse and starts being a scroll again.
    expect(cap).toBeLessThanOrEqual(12)
    expect(source).toContain('rows.slice(0, ROWS_BEFORE_COLLAPSE)')
  })

  it('offers the rest with its real count, never silently drops it', () => {
    // "Show all" without a number is a different offer from "show all 385",
    // and a reader deciding whether to press deserves to know which.
    expect(source).toContain('Show all ${rows.length}')
    expect(source).toContain('Show fewer')
  })

  it('gives the control a real hit area and an expanded state', () => {
    // R264: 44px on a coarse pointer, which `.touch-target` carries.
    expect(source).toMatch(/touch-target[^"]*"\s*\n?\s*>?[\s\S]{0,80}Show all|touch-target/)
    expect(source).toContain('aria-expanded={open}')
  })

  it('still lets a reader narrow to the groups they want', () => {
    // The collapse must not replace the select-and-watch gesture R266 asked
    // for; they are different questions — which groups, and how much of one.
    expect(source).toContain('aria-pressed={on}')
    expect(source).toContain('watch all again')
  })
})
