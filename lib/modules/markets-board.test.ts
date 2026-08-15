import { describe, it, expect, vi, afterEach } from 'vitest'
import { marketsBoard } from './markets-board'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
function csv(text: string, status = 200): Response {
  return new Response(text, { status, headers: { 'content-type': 'text/csv' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('marketsBoard', () => {
  it('assembles a grouped, live board across asset classes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const url = new URL(u)
        if (url.hostname === 'api.coingecko.com')
          return Promise.resolve(
            json([
              { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 65000, price_change_percentage_24h: 1.2, market_cap_rank: 1 },
            ]),
          )
        // FRED replaced Stooq on 2026-08-15: Stooq began answering every quote
        // URL with a bot-challenge page while still returning 200, so the board
        // silently lost its stock and commodity sections.
        if (url.hostname === 'fred.stlouisfed.org') {
          const id = url.searchParams.get('id') ?? ''
          if (id === 'SP500')
            return Promise.resolve(csv('observation_date,SP500\n2026-07-30,5000\n2026-07-31,5040'))
          if (id === 'DCOILWTICO')
            return Promise.resolve(csv('observation_date,DCOILWTICO\n2026-07-30,80\n2026-07-31,84'))
          // Every other series is genuinely unavailable in this fixture, which
          // also exercises "one missing series must not cost the others".
          return Promise.resolve(csv('', 404))
        }
        if (url.hostname === 'api.frankfurter.dev')
          return Promise.resolve(json({ base: 'USD', date: '2026-07-31', rates: { EUR: 0.92, JPY: 150 } }))
        return Promise.resolve(json({}, 404))
      }),
    )

    const b = await marketsBoard()
    const classes = b.sections.map((s) => s.key)
    expect(classes).toEqual(['indices', 'commodities', 'crypto', 'fx'])

    const crypto = b.sections.find((s) => s.key === 'crypto')!
    expect(crypto.rows[0]).toMatchObject({ symbol: 'BTC', name: 'Bitcoin', price: 65000, change: 1.2 })

    const idx = b.sections.find((s) => s.key === 'indices')!
    expect(idx.rows[0].symbol).toBe('SP500')
    expect(idx.rows[0].change).toBeCloseTo(((5040 - 5000) / 5000) * 100, 5)
    // The observation date travels with the name: a daily close shown without
    // it reads as a live quote, and is not one.
    expect(idx.rows[0].name).toContain('2026-07-31')

    const comm = b.sections.find((s) => s.key === 'commodities')!
    expect(comm.rows[0].name).toContain('Crude Oil')

    const fx = b.sections.find((s) => s.key === 'fx')!
    expect(fx.rows.map((r) => r.symbol).sort()).toEqual(['USD/EUR', 'USD/JPY'])

    expect(b.summary.instruments).toBe(5)
  })

  it('skips N/D quotes and stays usable if a provider is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const url = new URL(u)
        if (url.hostname === 'stooq.com')
          return Promise.resolve(csv('Symbol,Date,Time,Open,High,Low,Close,Volume\nXAUUSD,N/D,N/D,N/D,N/D,N/D,N/D,N/D'))
        return Promise.resolve(json({}, 503))
      }),
    )
    const b = await marketsBoard()
    expect(b.summary.instruments).toBe(0)
    expect(b.sections).toHaveLength(0)
  })
})
