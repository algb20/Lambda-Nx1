import { describe, it, expect } from 'vitest'
import { congestionFromFee } from './chain-radar'

describe('congestionFromFee', () => {
  it('reads a quiet chain as uncongested', () => {
    expect(congestionFromFee(1)).toBe(0)
    expect(congestionFromFee(0.5)).toBe(0)
  })

  it('rises with the fee and saturates at the top of the scale', () => {
    const quiet = congestionFromFee(3)
    const busy = congestionFromFee(30)
    const jammed = congestionFromFee(300)
    expect(quiet).toBeLessThan(busy)
    expect(busy).toBeLessThan(jammed)
    expect(jammed).toBe(1)
    expect(congestionFromFee(2000)).toBe(1)
  })

  it('is logarithmic, so a tenfold fee is a fixed step rather than tenfold', () => {
    const a = congestionFromFee(3)
    const b = congestionFromFee(30)
    const c = congestionFromFee(300)
    expect(b - a).toBeCloseTo(c - b, 2)
  })

  it('never returns a value outside 0..1 for junk input', () => {
    for (const v of [NaN, Infinity, -5, 0]) {
      const r = congestionFromFee(v)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
    }
  })
})
