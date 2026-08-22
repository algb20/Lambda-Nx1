import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyMarket, investigateMarkets } from './markets'
import { rankFindings } from './markets'
import type { Evidence } from '../engine/types'

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

  /**
   * One response carrying every indicator, which is what the API returns.
   *
   * This stub used to branch on which indicator code appeared in the path,
   * because the source made one request per indicator — twelve round trips to
   * one institution about one country. It asks once now, so the fixture is a
   * single multi-indicator response, and each row carries the `indicator.id`
   * the reader is matched on. Matching by position is the bug that once printed
   * the ECB's ten-year yield under the two-year's name.
   */
  it('reports World Bank macro indicators for a country', async () => {
    const row = (id: string, value: number) => ({
      indicator: { id, value: id },
      country: { value: 'France' },
      date: '2023',
      value,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const url = new URL(u)
        if (url.hostname === 'api.worldbank.org') {
          return Promise.resolve(
            res([
              { page: 1 },
              [
                // Deliberately not the order they are asked for.
                row('SP.POP.TOTL', 68_000_000),
                row('NV.IND.MANF.ZS', 9.8),
                row('NY.GDP.MKTP.CD', 3.05e12),
                row('FP.CPI.TOTL.ZG', 4.9),
              ],
            ]),
          )
        }
        return Promise.resolve(res({}, 404))
      }),
    )
    const r = await investigateMarkets('France')
    expect(r.findings.some((f) => /Economy — France GDP \(2023\): \$3\.05T/.test(f.claim))).toBe(true)
    expect(r.findings.some((f) => /Population \(2023\): 68\.0M/.test(f.claim))).toBe(true)
    expect(r.findings.some((f) => /Inflation \(2023\): 4\.9%/.test(f.claim))).toBe(true)
    // The half that was missing entirely: what the country actually makes.
    expect(r.findings.some((f) => /Manufacturing \(share of GDP\) \(2023\): 9\.8%/.test(f.claim))).toBe(true)
  })

  it('rejects too-short input', async () => {
    await expect(investigateMarkets('x')).rejects.toThrow(/asset, company, ticker or a currency pair/)
  })
})

/**
 * Ordering, from what the live gateway actually returned.
 *
 * There was no ordering at all — findings came out in whatever order the
 * sources happened to answer in. Searching "Germany" led with an **E.ON filing
 * from 2002**, then Allianz from 2002, then a Greek shipping company that
 * mentions Germany; the country's current GDP was sixth. "Saudi Arabia" led
 * with two American ETF prospectuses. The data was right and the reader would
 * never reach it, which for them is the same as not having it.
 */
describe('rankFindings — the answer first, not the loudest source', () => {
  const filing = (name: string, filedAt: string): Evidence =>
    ({
      claim: `SEC filing — ${name}`,
      entity: { type: 'company', value: name },
      sourceKey: 'sec_edgar_full_text',
      sourceUrl: 'https://efts.sec.gov/',
      retrievedAt: filedAt,
      admiralty: { source: 'B', info: 2 },
      confidence: 'probable',
      data: { filedAt },
    }) as Evidence

  const indicator = (country: string): Evidence =>
    ({
      claim: `Economy — ${country} GDP (2025): $5.05T`,
      entity: { type: 'other', value: country },
      sourceKey: 'worldbank_economy',
      sourceUrl: 'https://data.worldbank.org/',
      retrievedAt: new Date().toISOString(),
      admiralty: { source: 'A', info: 1 },
      confidence: 'confirmed',
      data: { indicator: 'NY.GDP.MKTP.CD', value: 5.05e12, year: '2025' },
    }) as Evidence

  it('puts what the subject *is* above what merely mentions it', () => {
    const ranked = rankFindings(
      [filing('E ON AG', '2002-07-01'), filing('ALLIANZ', '2002-06-25'), indicator('Germany')],
      'Germany',
    )
    expect(ranked[0]?.claim).toContain('Economy — Germany GDP')
  })

  it('puts a recent filing above a twenty-year-old one', () => {
    const ranked = rankFindings(
      [filing('E ON AG', '2002-07-01'), filing('Castor Maritime Inc.', '2025-05-14')],
      'Germany',
    )
    expect(ranked[0]?.claim).toContain('Castor Maritime')
  })

  /**
   * An old filing is still evidence about 2002 and is never deleted — someone
   * researching that year is entitled to find it. It simply stops being the
   * first thing everyone else sees.
   */
  it('keeps every finding, and only changes their order', () => {
    const input = [filing('A', '2002-01-01'), indicator('Germany'), filing('B', '2025-01-01')]
    expect(rankFindings(input, 'Germany')).toHaveLength(input.length)
  })

  /**
   * Two findings the ranking cannot separate must not swap places between runs:
   * a list that reshuffles identical evidence looks broken to anyone watching.
   */
  it('is stable where it cannot tell two findings apart', () => {
    const same = [filing('A', '2025-01-01'), filing('B', '2025-01-01')]
    expect(rankFindings(same, 'x').map((e) => e.claim)).toEqual(same.map((e) => e.claim))
  })

  it('survives evidence with no usable date rather than dropping it', () => {
    const undated = { ...filing('C', 'not a date') }
    expect(rankFindings([undated], 'x')).toHaveLength(1)
  })
})
