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
        if (url.hostname === 'stooq.com') {
          const s = url.searchParams.get('s') ?? ''
          if (s.includes('^SPX'))
            return Promise.resolve(csv('Symbol,Date,Time,Open,High,Low,Close,Volume\n^SPX,2026-07-31,21:00:00,5000,5050,4990,5040,0'))
          return Promise.resolve(csv('Symbol,Date,Time,Open,High,Low,Close,Volume\nXAUUSD,2026-07-31,21:00:00,2400,2410,2395,2412,0'))
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
    expect(idx.rows[0].symbol).toBe('^SPX')
    expect(idx.rows[0].change).toBeCloseTo(((5040 - 5000) / 5000) * 100, 5)

    const comm = b.sections.find((s) => s.key === 'commodities')!
    expect(comm.rows[0].name).toBe('Gold')

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
