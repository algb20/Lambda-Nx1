import { describe, it, expect, vi, afterEach } from 'vitest'
import { coingeckoGlobal, mempoolNetwork } from './chain'

const input = { capability: 'chain_state' as const, value: '' }

function ok(body: unknown): Response {
  return { ok: true, json: async () => body, text: async () => String(body) } as unknown as Response
}
function fail(): Response {
  return { ok: false, json: async () => ({}), text: async () => '' } as unknown as Response
}

afterEach(() => vi.restoreAllMocks())

describe('mempoolNetwork', () => {
  it('is passive and keyless on its declared host', () => {
    expect(mempoolNetwork.passive).toBe(true)
    expect(mempoolNetwork.hosts).toEqual(['mempool.space'])
    expect(mempoolNetwork.capability).toBe('chain_state')
  })

  it('reads fees, chain tip and mempool depth as instrument-grade evidence', async () => {
    const ctx = {
      fetch: vi.fn(async (url: string) => {
        if (url.includes('fees')) return ok({ fastestFee: 12, halfHourFee: 8, hourFee: 5, economyFee: 2 })
        if (url.includes('tip/height')) return ok(880_123)
        return ok({ count: 42_000, vsize: 12_345, total_fee: 999 })
      }),
    }
    const evidence = await mempoolNetwork.run(input, ctx)
    expect(evidence).toHaveLength(3)
    for (const e of evidence) expect(e.admiralty).toEqual({ source: 'A', info: 1 })

    const fees = evidence.find((e) => (e.data as { metric: string }).metric === 'fees')!
    expect((fees.data as { fastest: number }).fastest).toBe(12)
    const tip = evidence.find((e) => (e.data as { metric: string }).metric === 'tip')!
    expect((tip.data as { height: number }).height).toBe(880_123)
    const pool = evidence.find((e) => (e.data as { metric: string }).metric === 'mempool')!
    expect((pool.data as { count: number }).count).toBe(42_000)
  })

  /** Three independent reads: one failing must not cost the other two. */
  it('keeps the readings that succeeded when one endpoint fails', async () => {
    const ctx = {
      fetch: vi.fn(async (url: string) => {
        if (url.includes('fees')) return fail()
        if (url.includes('tip/height')) return ok(900_000)
        throw new Error('mempool endpoint down')
      }),
    }
    const evidence = await mempoolNetwork.run(input, ctx)
    expect(evidence).toHaveLength(1)
    expect((evidence[0].data as { metric: string }).metric).toBe('tip')
  })

  it('ignores a nonsense chain tip rather than reporting it', async () => {
    const ctx = {
      fetch: vi.fn(async (url: string) =>
        url.includes('tip/height') ? ok('not a number') : fail(),
      ),
    }
    expect(await mempoolNetwork.run(input, ctx)).toEqual([])
  })
})

describe('coingeckoGlobal', () => {
  it('maps market structure and grades it as derived, not measured', async () => {
    const ctx = {
      fetch: vi.fn(async () =>
        ok({
          data: {
            total_market_cap: { usd: 2.4e12 },
            total_volume: { usd: 9.5e10 },
            market_cap_percentage: { btc: 54.2, eth: 12.1 },
            market_cap_change_percentage_24h_usd: -1.87,
            active_cryptocurrencies: 17000,
          },
        }),
      ),
    }
    const [e] = await coingeckoGlobal.run(input, ctx)
    expect(e.claim).toContain('2.40T')
    expect(e.claim).toContain('-1.87%')
    // An aggregator's computation over exchange data is reliable but secondary.
    expect(e.admiralty).toEqual({ source: 'B', info: 2 })
    const d = e.data as Record<string, number>
    expect(d.btcDominance).toBe(54.2)
    expect(d.totalVolumeUsd).toBe(9.5e10)
  })

  it('returns nothing when the payload has no usable capitalisation', async () => {
    const ctx = { fetch: vi.fn(async () => ok({ data: { market_cap_percentage: { btc: 50 } } })) }
    expect(await coingeckoGlobal.run(input, ctx)).toEqual([])
  })

  /** A provider we could not reach is a failure, not a market worth $0. */
  it('reports an unreachable provider', async () => {
    const bad = { fetch: vi.fn(async () => fail()) }
    await expect(coingeckoGlobal.run(input, bad)).rejects.toThrow(/coingecko_global/)
  })
})
