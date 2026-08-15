import { describe, expect, it, vi } from 'vitest'
import { fredIndices, fredCommodities } from './markets-board'
import type { SourceContext, SourceInput } from '../types'

const INPUT: SourceInput = { capability: 'market_board', value: '' }

/** FRED's real CSV shape: a header, then `date,value`, with `.` for no data. */
const CSV = `observation_date,SP500
2026-08-12,7810.11
2026-08-13,7798.99
2026-08-14,7785.76
`

function ctx(body: string, ok = true): SourceContext {
  return { fetch: vi.fn(async () => ({ ok, status: ok ? 200 : 503, text: async () => body })) } as unknown as SourceContext
}

describe('FRED market series', () => {
  it('reads the latest close and the move that produced it', async () => {
    const [first] = await fredIndices.run(INPUT, ctx(CSV))
    const d = first.data as { price: number; change: number; class: string }
    expect(d.price).toBe(7785.76)
    // Computed from FRED's own two closes, never asserted from elsewhere.
    expect(d.change).toBeCloseTo(((7785.76 - 7798.99) / 7798.99) * 100, 6)
    expect(d.class).toBe('indices')
  })

  /**
   * A daily close shown without its date reads as a live quote and is not one.
   */
  it('carries the observation date, so a close is not mistaken for a quote', async () => {
    const [first] = await fredIndices.run(INPUT, ctx(CSV))
    expect(first.claim).toContain('2026-08-14')
  })

  it('grades the Federal Reserve publishing its own series as primary', async () => {
    const [first] = await fredCommodities.run(INPUT, ctx(CSV))
    expect(first.admiralty).toEqual({ source: 'A', info: 1 })
  })

  /**
   * FRED writes `.` for a holiday or an unsettled day. Reading that as zero
   * would draw a crash to nothing and a −100% move.
   */
  it('skips the no-observation marker rather than reading it as zero', async () => {
    const withGaps = `observation_date,DCOILWTICO
2026-08-12,84.10
2026-08-13,.
2026-08-14,84.77
`
    const [first] = await fredCommodities.run(INPUT, ctx(withGaps))
    const d = first.data as { price: number; change: number }
    expect(d.price).toBe(84.77)
    expect(d.change).toBeCloseTo(((84.77 - 84.1) / 84.1) * 100, 6)
  })

  it('states no change rather than a fabricated one from a single point', async () => {
    const single = `observation_date,VIXCLS
2026-08-14,14.63
`
    const [first] = await fredIndices.run(INPUT, ctx(single))
    expect((first.data as { change: number | null }).change).toBeNull()
  })

  /**
   * The defect that made this source necessary: Stooq answered 200 with an HTML
   * challenge page, the parser found no numbers, and the board silently lost
   * two of its four sections while every health check stayed green.
   */
  it('returns nothing for an HTML page rather than inventing rows', async () => {
    const html = '<!DOCTYPE html><html><body>The page you requested does not exist</body></html>'
    expect(await fredIndices.run(INPUT, ctx(html))).toEqual([])
  })

  it('keeps the other series when one is unavailable', async () => {
    // A board that fails whole because one number is missing is worse than one
    // that is short a row and says so.
    let call = 0
    const flaky = {
      fetch: vi.fn(async () => {
        call++
        return call === 1
          ? { ok: false, status: 404, text: async () => '' }
          : { ok: true, status: 200, text: async () => CSV }
      }),
    } as unknown as SourceContext
    const out = await fredIndices.run(INPUT, flaky)
    expect(out.length).toBeGreaterThan(0)
  })

  it('is spaced politely but inside the request budget', async () => {
    // Nine series at the 2000ms used elsewhere would exceed the orchestrator's
    // 8s deadline and lose the whole source — which is exactly what happened.
    expect(fredIndices.minIntervalMs).toBeLessThanOrEqual(500)
    expect(fredIndices.minIntervalMs).toBeGreaterThan(0)
  })

  it('only ever reads FRED', async () => {
    expect(fredIndices.hosts).toEqual(['fred.stlouisfed.org'])
    expect(fredIndices.passive).toBe(true)
  })
})
