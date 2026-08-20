import { describe, expect, it } from 'vitest'
import { periodEnd } from './property'

/**
 * The three publishers state their period in three shapes, and the difference
 * between them decides whether the staleness banner tells the truth.
 */
describe('reading a published period', () => {
  it('reads a FRED observation date', () => {
    expect(periodEnd('2026-08-13')?.toISOString().slice(0, 10)).toBe('2026-08-13')
  })

  it('reads a Land Registry month as the end of that month', () => {
    expect(periodEnd('2026-06')?.toISOString().slice(0, 10)).toBe('2026-06-30')
  })

  /**
   * A quarter maps to its *last* month. Q1 data describes a period that ended in
   * March, and reading it as January would understate the lag by two months —
   * on the one number this gateway exists to be honest about.
   */
  it('reads a Eurostat quarter as the month it ended in', () => {
    expect(periodEnd('2026-Q1')?.toISOString().slice(0, 10)).toBe('2026-03-31')
    expect(periodEnd('2026-Q4')?.toISOString().slice(0, 10)).toBe('2026-12-31')
    expect(periodEnd('2026-Q2')?.toISOString().slice(0, 10)).toBe('2026-06-30')
  })

  it('answers null for a period it cannot read, rather than today', () => {
    expect(periodEnd('unknown')).toBeNull()
    expect(periodEnd('')).toBeNull()
  })
})
