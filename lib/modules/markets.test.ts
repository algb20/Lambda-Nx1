import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyMarket, investigateMarkets } from './markets'

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('classifyMarket', () => {
  it('detects an FX pair vs an asset', () => {
    expect(classifyMarket('USD/EUR')).toBe('fx')
    expect(classifyMarket('usd eur')).toBe('fx')
    expect(classifyMarket('gbp-jpy')).toBe('fx')
    expect(classifyMarket('BTC')).toBe('asset')
    expect(classifyMarket('Apple')).toBe('asset')
  })
})

describe('investigateMarkets', () => {
  it('reads crypto market facts and SEC filings for an asset query', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const url = new URL(u)
        if (url.hostname === 'api.coingecko.com' && url.pathname.endsWith('/search'))
          return Promise.resolve(res({ coins: [{ id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', market_cap_rank: 1 }] }))
        if (url.hostname === 'api.coingecko.com' && url.pathname.endsWith('/simple/price'))
          return Promise.resolve(res({ bitcoin: { usd: 65000, usd_market_cap: 1.28e12, usd_24h_change: -1.5 } }))
        if (url.hostname === 'efts.sec.gov')
          return Promise.resolve(
            res({ hits: { total: { value: 1 }, hits: [{ _id: '0000320193-24:doc', _source: { display_names: ['Apple Inc. (AAPL)'], form: '10-K', file_date: '2024-11-01' } }] } }),
          )
        return Promise.resolve(res({}, 404))
      }),
    )
    const r = await investigateMarkets('bitcoin')
    expect(r.kind).toBe('asset')
    expect(r.findings.some((f) => /Crypto market — Bitcoin \(BTC\): \$65,000/.test(f.claim))).toBe(true)
    expect(r.findings.some((f) => /-1\.50% 24h/.test(f.claim))).toBe(true)
    expect(r.findings.some((f) => /market cap \$1\.28T/.test(f.claim))).toBe(true)
    expect(r.findings.some((f) => /SEC filing — Apple Inc\. \(AAPL\): 10-K filed 2024-11-01/.test(f.claim))).toBe(true)
  })

  it('reads an ECB reference rate for a currency pair', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const url = new URL(u)
        if (url.hostname === 'api.frankfurter.dev')
          return Promise.resolve(res({ base: 'USD', date: '2026-07-30', rates: { EUR: 0.92 } }))
        return Promise.resolve(res({}, 404))
      }),
    )
    const r = await investigateMarkets('USD/EUR')
    expect(r.kind).toBe('fx')
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0].claim).toMatch(/1 USD = 0\.92 EUR/)
  })

  it('reports World Bank macro indicators for a country', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const url = new URL(u)
        if (url.hostname === 'api.worldbank.org') {
          const ind = url.pathname.includes('NY.GDP.MKTP.CD')
            ? { indicator: { value: 'GDP' }, country: { value: 'France' }, date: '2023', value: 3.05e12 }
            : url.pathname.includes('SP.POP.TOTL')
              ? { indicator: { value: 'Population' }, country: { value: 'France' }, date: '2023', value: 68_000_000 }
              : { indicator: { value: 'Inflation' }, country: { value: 'France' }, date: '2023', value: 4.9 }
          return Promise.resolve(res([{ page: 1 }, [ind]]))
        }
        return Promise.resolve(res({}, 404))
      }),
    )
    const r = await investigateMarkets('France')
    expect(r.findings.some((f) => /Economy — France GDP \(2023\): \$3\.05T/.test(f.claim))).toBe(true)
    expect(r.findings.some((f) => /Population \(2023\): 68\.0M/.test(f.claim))).toBe(true)
    expect(r.findings.some((f) => /Inflation \(2023\): 4\.9%/.test(f.claim))).toBe(true)
  })

  it('rejects too-short input', async () => {
    await expect(investigateMarkets('x')).rejects.toThrow(/asset, company, ticker or a currency pair/)
  })
})
