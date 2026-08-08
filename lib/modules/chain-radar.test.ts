import { describe, it, expect } from 'vitest'
import { concentration, congestionFromFee, congestionFromGwei } from './chain-radar'

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

describe('congestionFromGwei — Ethereum has its own scale', () => {
  it('reads a calm fee market as uncongested', () => {
    expect(congestionFromGwei(5)).toBe(0)
    expect(congestionFromGwei(1)).toBe(0)
  })

  it('rises with gas and saturates in a crisis', () => {
    expect(congestionFromGwei(15)).toBeGreaterThan(0)
    expect(congestionFromGwei(120)).toBeGreaterThan(congestionFromGwei(15))
    expect(congestionFromGwei(300)).toBe(1)
    expect(congestionFromGwei(5000)).toBe(1)
  })

  /**
   * The two units are not comparable, so the two scales must be separate — a
   * shared scale would make one chain's bar lie about the other's.
   */
  it('is a different scale from the Bitcoin one', () => {
    expect(congestionFromGwei(30)).not.toBeCloseTo(congestionFromFee(30), 2)
  })
})

describe('concentration — how few venues carry the world', () => {
  it('reads a single venue as total concentration', () => {
    expect(concentration([100])).toBe(1)
  })

  it('reads a perfectly even split as no concentration', () => {
    expect(concentration([25, 25, 25, 25])).toBe(0)
  })

  it('rises as volume piles into one venue', () => {
    const even = concentration([10, 10, 10, 10])!
    const skewed = concentration([70, 10, 10, 10])!
    const extreme = concentration([97, 1, 1, 1])!
    expect(skewed).toBeGreaterThan(even)
    expect(extreme).toBeGreaterThan(skewed)
    expect(extreme).toBeLessThanOrEqual(1)
  })

  it('returns null when there is nothing to measure', () => {
    expect(concentration([])).toBeNull()
    expect(concentration([0, 0])).toBeNull()
    expect(concentration([NaN])).toBeNull()
  })
})
