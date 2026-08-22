import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The row list and the board renderer, asserted from their source.
 *
 * Reading the files rather than importing them is deliberate and the same
 * choice `lib/gateways.test.ts` makes: these are `'use client'` components that
 * pull the whole UI tree, and importing them drags `node:crypto` into a test
 * environment with no business loading it.
 */
const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const rowList = read('components/row-list.tsx')
const board = read('components/board-view.tsx')
const dashboard = read('components/intelligence-dashboard.tsx')

describe('a group does not render its whole self on a phone', () => {
  /**
   * Walked in a real browser before this existed: crypto came out **12,902
   * pixels** tall on a 390px viewport and fact-checks **12,233** — both longer
   * than the globe page this project was already told nobody could use, and
   * neither had anything wrong with its data. 2,151 unit tests passed
   * throughout.
   *
   * These assertions now read `row-list.tsx`, because the collapse moved there
   * when three more gateways needed it. That move is the point: the rule about
   * how long a list may get before it asks a reader's permission is one rule,
   * and a second copy is how two of them drift apart.
   */
  it('collapses a long group instead of printing every row', () => {
    expect(rowList).toMatch(/const ROWS_BEFORE_COLLAPSE = \d+/)
    const cap = Number(rowList.match(/const ROWS_BEFORE_COLLAPSE = (\d+)/)?.[1])
    expect(cap).toBeGreaterThan(2)
    // Past a dozen it stops being a collapse and starts being a scroll again.
    expect(cap).toBeLessThanOrEqual(12)
    expect(rowList).toContain('rows.slice(0, ROWS_BEFORE_COLLAPSE)')
  })

  it('offers the rest with its real count, never silently drops it', () => {
    // "Show all" without a number is a different offer from "show all 385",
    // and a reader deciding whether to press deserves to know which.
    expect(rowList).toContain('Show all ${rows.length}')
    expect(rowList).toContain('Show fewer')
  })

  it('gives the control a real hit area and an expanded state', () => {
    // R264: 44px on a coarse pointer, which `.touch-target` carries.
    expect(rowList).toContain('touch-target')
    expect(rowList).toContain('aria-expanded={open}')
  })

  /**
   * And every view that groups things uses it, rather than open-coding a list
   * that grows without limit. Broadcasts shipped a country with 116 stations in
   * it; had it rendered them all, the page would have been the maritime
   * gateway's 64,056 pixels again with a different dataset.
   */
  it('is the list every grouping view actually uses', () => {
    expect(board).toContain('<RowList')
    const uses = [...dashboard.matchAll(/<RowList\b/g)].length
    expect(uses, 'broadcasts, filings and venues each group rows').toBeGreaterThanOrEqual(3)
  })

  it('still lets a reader narrow to the groups they want', () => {
    // The collapse must not replace the select-and-watch gesture R266 asked
    // for; they are different questions — which groups, and how much of one.
    expect(board).toContain('aria-pressed={on}')
    expect(board).toContain('watch all again')
  })
})
