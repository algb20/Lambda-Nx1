/**
 * Price *histories*, not price snapshots.
 *
 * Every markets source in this engine until now returned a quote: one number
 * per instrument, taken now. A quote cannot answer the question this source
 * exists for — *what moves with what* — because a correlation needs a series,
 * and one observation is not a series. Computing a "correlation" from a single
 * 24-hour change per asset would be arithmetic on one data point dressed up as
 * statistics, which is exactly the kind of thing this project exists not to do.
 *
 * ## The provider, and why it is the right one
 *
 * CoinGecko's `/coins/markets` endpoint returns, for each asset in one request,
 * `sparkline_in_7d.price` — **168 hourly closes**, the last seven days. That is
 * a genuine multivariate series: aligned by construction (every asset's 168
 * points cover the same 168 hours), long enough for a correlation to mean
 * something, and available with **no API key**, which keeps this inside the
 * charter's keyless rule.
 *
 * One request covers up to 250 assets. That matters: the alternative —
 * `/coins/{id}/market_chart` per asset — would be 250 requests against a
 * provider that throttles keyless callers hard, and the guaranteed outcome is a
 * source that reports itself healthy while returning a third of the market.
 * The same failure has already cost this codebase two working sources.
 *
 * ## What this source does not claim
 *
 * Hourly closes are not ticks. Two assets that move together within an hour and
 * apart across it will read as correlated here, and the surface drawing this
 * says the window and the observation count on screen for exactly that reason.
 * The series is also *seven days* — a correlation over one week is a statement
 * about one week, and calling it "the structure of the market" would be a
 * bigger claim than the data supports.
 */
import type { Evidence, Source, SourceContext, SourceInput } from '../types'
import { expectJson } from '../fetch-guard'

const COINGECKO = 'https://api.coingecko.com/api/v3'

/** How many assets to ask for. The provider caps a page at 250. */
export const SERIES_ASSETS = 100

/** Hourly closes the provider returns for the 7-day sparkline. */
export const SERIES_POINTS = 168

interface CgSparklineRow {
  id?: string
  symbol?: string
  name?: string
  current_price?: number
  market_cap?: number
  market_cap_rank?: number
  price_change_percentage_24h?: number
  sparkline_in_7d?: { price?: number[] }
}

/** The payload every consumer of this source reads. */
export interface MarketSeriesPoint {
  key: string
  symbol: string
  name: string
  price: number
  marketCap: number | null
  rank: number | null
  change24h: number | null
  /** Hourly closes, oldest first. */
  prices: number[]
  /** Hours between consecutive prices — stated, never assumed by the reader. */
  intervalHours: number
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

export const cryptoSeries: Source = {
  key: 'coingecko_series',
  capability: 'market_series',
  passive: true,
  hosts: ['api.coingecko.com'],
  /**
   * Two seconds, matching the other CoinGecko source in this engine. The
   * provider throttles keyless callers by IP, and this source and
   * `coingecko_asset` share that budget.
   */
  minIntervalMs: 2000,
  async run(_input: SourceInput, ctx: SourceContext): Promise<Evidence[]> {
    const rows = await expectJson<CgSparklineRow[] | null>(
      'coingecko_series',
      await ctx.fetch(
        `${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc` +
          `&per_page=${SERIES_ASSETS}&page=1&sparkline=true&price_change_percentage=24h`,
      ),
    )
    if (!Array.isArray(rows)) return []

    const retrievedAt = new Date().toISOString()

    return rows.flatMap<Evidence>((r) => {
      const prices = r.sparkline_in_7d?.price
      const price = num(r.current_price)
      if (!r.id || !r.symbol || !Array.isArray(prices) || price === null) return []

      /**
       * A series with a non-finite entry is passed through as it arrived. The
       * decision to drop it belongs to the analysis, which names every
       * exclusion and its reason — filtering here would delete the asset
       * silently and leave the reader with a shorter list and no explanation.
       */
      const point: MarketSeriesPoint = {
        key: r.id,
        symbol: r.symbol.toUpperCase(),
        name: r.name ?? r.symbol.toUpperCase(),
        price,
        marketCap: num(r.market_cap),
        rank: num(r.market_cap_rank),
        change24h: num(r.price_change_percentage_24h),
        prices,
        intervalHours: 1,
      }

      return [
        {
          claim: `${point.name} (${point.symbol}) — ${prices.length} hourly closes over 7 days`,
          entity: { type: 'other', value: point.symbol },
          sourceKey: 'coingecko_series',
          sourceUrl: `https://www.coingecko.com/en/coins/${r.id}`,
          retrievedAt,
          /**
           * The provider states no timestamp for the last sparkline point, so
           * this stays null rather than being filled with the fetch time. A
           * missing publication time is a fact about the source.
           */
          publishedAt: null,
          admiralty: { source: 'B', info: 2 },
          confidence: 'probable',
          data: point,
        },
      ]
    })
  },
}

export const MARKET_SERIES_SOURCES: Source[] = [cryptoSeries]
