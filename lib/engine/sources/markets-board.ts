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
import { expectJson, expectOk, SourceUnavailableError } from '../fetch-guard'

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
    /**
     * A throttle is not a quiet market.
     *
     * This was `if (!res.ok) return []`, and it produced the exact fault this
     * project keeps finding: on the deployed site `/api/chain` reported **13
     * sources OK, 0 failed — and 0 movers**. CoinGecko throttles keyless
     * callers from a cloud address, the board swallowed the refusal, and
     * thirteen green lights sat over a blank panel.
     */
    const rows = await expectJson<CgMarket[] | null>('coingecko_board', await ctx.fetch(url))
    if (!Array.isArray(rows)) {
      throw new SourceUnavailableError('coingecko_board', 200, 'expected a list of markets')
    }
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

// ── FRED — indices and commodities, from the Federal Reserve ────────────────
/**
 * Stooq served these until 2026-08-15, when it began answering every quote URL
 * with a `noindex,nofollow` challenge page. The source kept reporting healthy
 * because it answered `200`: the parser simply found no numbers in the HTML and
 * returned an empty list. So the board silently lost **two of its four
 * sections** — stocks and commodities — while every health check stayed green,
 * and a user opening the markets board saw crypto and currencies and concluded
 * the product had no stocks at all. They were right.
 *
 * A bot challenge is a provider stating its terms, and the charter is explicit
 * that we do not work around one. So Stooq is withdrawn and replaced.
 *
 * FRED is the better source anyway, and not only because it answers:
 *
 *  - It is the **Federal Reserve Bank of St. Louis** publishing its own series,
 *    which grades A/1 rather than A/2 — a primary publisher, not an aggregator.
 *  - `fredgraph.csv` is a documented download endpoint, keyless by design and
 *    intended to be fetched. No disguise, no scraping, no terms to skirt.
 *  - The series are the canonical ones an analyst would cite.
 *
 * What it costs us, stated rather than hidden: FRED publishes **daily closes**,
 * not live quotes. A number here is the last settled value, and the row carries
 * the date it belongs to. That is the honest trade — a real close from the
 * central bank beats a live price we are not permitted to take.
 */
interface FredSeries {
  /** FRED series id, e.g. `SP500`. */
  id: string
  name: string
  cls: AssetClass
  unit?: string
}

const FRED_SERIES: FredSeries[] = [
  // Indices — the ones a reader recognises without a legend.
  { id: 'SP500', name: 'S&P 500', cls: 'indices', unit: '' },
  { id: 'DJIA', name: 'Dow Jones Industrial Average', cls: 'indices', unit: '' },
  { id: 'NASDAQCOM', name: 'Nasdaq Composite', cls: 'indices', unit: '' },
  { id: 'WILL5000PRFC', name: 'Wilshire 5000 (full cap)', cls: 'indices', unit: '' },
  { id: 'VIXCLS', name: 'VIX volatility index', cls: 'indices', unit: '' },
  // Commodities — energy and metals, the ones that move everything else.
  { id: 'DCOILWTICO', name: 'Crude Oil (WTI)', cls: 'commodities' },
  { id: 'DCOILBRENTEU', name: 'Brent Crude', cls: 'commodities' },
  { id: 'DHHNGSP', name: 'Natural Gas (Henry Hub)', cls: 'commodities' },
  { id: 'GASREGW', name: 'US Retail Gasoline', cls: 'commodities' },
]

/**
 * The last two observations of a FRED series.
 *
 * Two, not one, because the change between them is the only honest way to state
 * a move: FRED gives levels, never percentages, so computing it here from two
 * published closes is arithmetic over its own data rather than a number we
 * invented. FRED writes `.` for a day with no observation — a holiday, or a
 * series that has not settled — and those rows are skipped rather than read as
 * zero, which would draw a crash.
 */
function lastTwoObservations(csv: string): Array<{ date: string; value: number }> {
  const rows: Array<{ date: string; value: number }> = []
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [date, raw] = line.split(',')
    if (!date || !raw || raw.trim() === '.') continue
    const value = Number(raw)
    if (!Number.isFinite(value)) continue
    rows.push({ date: date.trim(), value })
  }
  return rows.slice(-2)
}

function fredSource(key: string, cls: AssetClass): Source {
  const series = FRED_SERIES.filter((s) => s.cls === cls)
  return {
    key,
    capability: 'market_board',
    passive: true,
    hosts: ['fred.stlouisfed.org'],
    /**
     * Per **request**, not per run — and this source makes one request per
     * series.
     *
     * At the 2000 ms used elsewhere, five index series cost ten seconds and the
     * orchestrator's eight-second deadline killed the whole source: the board
     * came back with commodities and no stocks, reported as one failure with no
     * hint that the cause was our own politeness rather than FRED's.
     *
     * 300 ms is still deliberate spacing on a static CSV download built to be
     * fetched, and it puts nine series comfortably inside the budget.
     */
    minIntervalMs: 300,
    async run(_input, ctx) {
      const out: Evidence[] = []
      /**
       * Counted, because "one series is missing" and "the provider is refusing
       * us" are different findings that look identical one row at a time.
       *
       * Skipping a bad series is right: a board that fails whole because one
       * number is missing is worse than one that says which number is missing.
       * But skipping *every* series and returning an empty list is the fault
       * this whole pass exists to remove — the source would report itself
       * healthy while the provider had shut the door. So the skips are tallied
       * and a complete refusal is raised as one.
       */
      let refused = 0
      for (const s of series) {
        const res = await ctx.fetch(
          `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(s.id)}`,
        )
        if (!res.ok) {
          refused++
          continue
        }
        const rows = lastTwoObservations(await res.text().catch(() => ''))
        const latest = rows[rows.length - 1]
        if (!latest) continue
        const previous = rows.length > 1 ? rows[0] : null
        const change =
          previous && previous.value !== 0
            ? ((latest.value - previous.value) / previous.value) * 100
            : null

        out.push(
          boardEvidence({
            cls,
            symbol: s.id,
            // The date travels in the name, because a daily close presented
            // without its date reads as a live quote and is not one.
            name: `${s.name} · ${latest.date}`,
            price: latest.value,
            change,
            unit: s.unit ?? '$',
            sourceKey: key,
            sourceUrl: `https://fred.stlouisfed.org/series/${s.id}`,
            // The Federal Reserve publishing its own series: primary, not
            // aggregated.
            admiraltyInfo: 1,
          }),
        )
      }
      /**
       * Every series refused, and none produced a row: that is the provider
       * shutting the door, not nine coincidental gaps. Reported as a refusal so
       * the board says it was refused instead of showing an empty section under
       * a green light.
       */
      if (out.length === 0 && refused === series.length) {
        throw new SourceUnavailableError(key, null, `all ${refused} series refused`)
      }
      return out
    },
  }
}

export const fredIndices = fredSource('fred_indices', 'indices')
export const fredCommodities = fredSource('fred_commodities', 'commodities')

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
    // Same rule as the crypto half above: a refusal is not an empty rate table.
    const res = expectOk('frankfurter_board', await ctx.fetch(url))
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
