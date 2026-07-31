/**
 * Markets Board sources — a curated live overview across asset classes, from
 * passive, keyless public data. Each source returns one Evidence per instrument,
 * tagged with its asset `class` so the module can group the board.
 *
 *  - CoinGecko : top cryptocurrencies by market cap.
 *  - Stooq     : commodities / raw materials + major stock indices (free CSV).
 *  - Frankfurter (ECB) : key FX rates.
 *
 * We report the quote as published, with source + timestamp. We never predict.
 */
import type { Evidence, Source } from '../types'

type AssetClass = 'crypto' | 'commodities' | 'indices' | 'fx'

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  return n.toPrecision(4)
}

function boardEvidence(opts: {
  cls: AssetClass
  symbol: string
  name: string
  price: number
  change: number | null
  unit?: string
  sourceKey: string
  sourceUrl?: string
  admiraltyInfo: 1 | 2 | 3
}): Evidence {
  const chg = opts.change !== null ? `, ${opts.change >= 0 ? '+' : ''}${opts.change.toFixed(2)}%` : ''
  return {
    claim: `${opts.name} (${opts.symbol}): ${opts.unit ?? '$'}${fmtPrice(opts.price)}${chg}`,
    entity: { type: 'other', value: opts.symbol },
    sourceKey: opts.sourceKey,
    sourceUrl: opts.sourceUrl,
    retrievedAt: new Date().toISOString(),
    admiralty: { source: 'A', info: opts.admiraltyInfo },
    confidence: 'probable',
    data: {
      class: opts.cls,
      symbol: opts.symbol,
      name: opts.name,
      price: opts.price,
      change: opts.change,
      unit: opts.unit ?? 'USD',
      sourceUrl: opts.sourceUrl,
    },
  }
}

// ── CoinGecko — top crypto by market cap ─────────────────────────────────────
interface CgMarket {
  id?: string
  symbol?: string
  name?: string
  current_price?: number
  price_change_percentage_24h?: number
  market_cap_rank?: number
}

export const coingeckoTop: Source = {
  key: 'coingecko_board',
  capability: 'market_board',
  passive: true,
  hosts: ['api.coingecko.com'],
  minIntervalMs: 1500,
  async run(_input, ctx) {
    const url =
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc' +
      '&per_page=10&page=1&price_change_percentage=24h'
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const rows = (await res.json().catch(() => null)) as CgMarket[] | null
    if (!Array.isArray(rows)) return []
    return rows
      .filter((r) => r.id && typeof r.current_price === 'number')
      .map((r) =>
        boardEvidence({
          cls: 'crypto',
          symbol: (r.symbol ?? r.id!).toUpperCase(),
          name: r.name ?? r.id!,
          price: r.current_price!,
          change: typeof r.price_change_percentage_24h === 'number' ? r.price_change_percentage_24h : null,
          sourceKey: 'coingecko_board',
          sourceUrl: `https://www.coingecko.com/en/coins/${r.id}`,
          admiraltyInfo: 2,
        }),
      )
  },
}

// ── Stooq — commodities / raw materials + major indices (free CSV) ───────────
const COMMODITIES: Array<[string, string]> = [
  ['XAUUSD', 'Gold'],
  ['XAGUSD', 'Silver'],
  ['CL.F', 'Crude Oil (WTI)'],
  ['CB.F', 'Brent Crude'],
  ['NG.F', 'Natural Gas'],
  ['HG.F', 'Copper'],
]
const INDICES: Array<[string, string]> = [
  ['^SPX', 'S&P 500'],
  ['^NDQ', 'Nasdaq Composite'],
  ['^DJI', 'Dow Jones'],
  ['^DAX', 'DAX'],
  ['^NKX', 'Nikkei 225'],
]

/** Parse a Stooq light-quote CSV into rows keyed by the header names. */
function parseStooqCsv(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const cells = line.split(',')
    const row: Record<string, string> = {}
    header.forEach((h, i) => (row[h.trim()] = (cells[i] ?? '').trim()))
    return row
  })
}

function stooqSource(key: string, cls: AssetClass, basket: Array<[string, string]>): Source {
  const names = new Map(basket.map(([s, n]) => [s.toUpperCase(), n]))
  return {
    key,
    capability: 'market_board',
    passive: true,
    hosts: ['stooq.com'],
    minIntervalMs: 1500,
    async run(_input, ctx) {
      const symbols = basket.map(([s]) => s).join(',')
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbols)}&f=sd2t2ohlcv&h&e=csv`
      const res = await ctx.fetch(url)
      if (!res.ok) return []
      const text = await res.text().catch(() => '')
      const rows = parseStooqCsv(text)
      const out: Evidence[] = []
      for (const row of rows) {
        const symbol = (row.Symbol ?? '').toUpperCase()
        const close = Number(row.Close)
        const open = Number(row.Open)
        if (!symbol || !Number.isFinite(close) || close <= 0) continue // N/D rows skipped
        const change = Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null
        out.push(
          boardEvidence({
            cls,
            symbol,
            name: names.get(symbol) ?? symbol,
            price: close,
            change,
            unit: cls === 'indices' ? '' : '$',
            sourceKey: key,
            sourceUrl: `https://stooq.com/q/?s=${encodeURIComponent(symbol.toLowerCase())}`,
            admiraltyInfo: 2,
          }),
        )
      }
      return out
    },
  }
}

export const stooqCommodities = stooqSource('stooq_commodities', 'commodities', COMMODITIES)
export const stooqIndices = stooqSource('stooq_indices', 'indices', INDICES)

// ── Frankfurter (ECB) — key FX rates ─────────────────────────────────────────
interface FrankfurterResponse {
  base?: string
  date?: string
  rates?: Record<string, number>
}
const FX_SYMBOLS = ['EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD', 'INR']

export const frankfurterBoard: Source = {
  key: 'frankfurter_board',
  capability: 'market_board',
  passive: true,
  hosts: ['api.frankfurter.dev'],
  minIntervalMs: 800,
  async run(_input, ctx) {
    const url = `https://api.frankfurter.dev/v1/latest?base=USD&symbols=${FX_SYMBOLS.join(',')}`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as FrankfurterResponse | null
    const rates = j?.rates ?? {}
    return Object.entries(rates)
      .filter(([, v]) => typeof v === 'number')
      .map(([sym, rate]) =>
        boardEvidence({
          cls: 'fx',
          symbol: `USD/${sym}`,
          name: `US Dollar → ${sym}`,
          price: rate,
          change: null,
          unit: '',
          sourceKey: 'frankfurter_board',
          sourceUrl: 'https://www.frankfurter.dev',
          admiraltyInfo: 1,
        }),
      )
  },
}
