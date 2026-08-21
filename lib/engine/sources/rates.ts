/**
 * The traditional side of a market: what money costs, and what it is worth.
 *
 * ## What is here, and what is deliberately not
 *
 * Three things a crypto radar cannot tell you, from the institutions that set
 * them rather than from an aggregator:
 *
 *  - **Sovereign yields** — what a government pays to borrow, from the ECB's own
 *    euro-area yield curve. The 2Y/10Y pair is the single most-watched number in
 *    fixed income because its *spread* is the market's forecast of the economy.
 *  - **The policy rate** — what the central bank charges, which is the floor
 *    every other rate is built on.
 *  - **Reference exchange rates** — the ECB's daily fixing, published at 16:00
 *    CET, which is the rate contracts and accounts actually settle against.
 *
 * **Equity index levels are absent, and that is a finding rather than a gap in
 * effort.** Index levels are licensed intellectual property: S&P owns the S&P
 * 500's values, Deutsche Börse owns the DAX's, and both license them
 * commercially. There is no keyless, lawful public endpoint for them, and the
 * unofficial ones that exist are scrapes of a broker's site in breach of its
 * terms. Charter §3 forbids that route, so the honest answer is to say the
 * category needs a licensed feed and to publish nothing rather than to publish
 * something we had no right to take.
 *
 * Every endpoint here was probed live before it was written down: the ECB SDMX
 * service answered 200 with two observations for each curve point, the policy
 * rate answered with today's value, and Frankfurter answered with the full
 * reference table.
 */
import type { Evidence, Source, SourceContext, SourceInput } from '../types'

/** SDMX-JSON, reduced to the shape these calls actually return. */
interface SdmxJson {
  dataSets?: Array<{
    series?: Record<string, { observations?: Record<string, Array<number | null>> }>
  }>
  structure?: {
    dimensions?: {
      series?: Array<{ values?: Array<{ id?: string }> }>
      observation?: Array<{ values?: Array<{ id?: string }> }>
    }
  }
}

/** One point read off an SDMX series: the value and the date it belongs to. */
export interface SdmxPoint {
  date: string
  value: number
}

/** One series from a multi-series response, with the dimensions that name it. */
export interface SdmxSeries {
  /** The dimension ids this series is keyed by — e.g. `SR_10Y` for the tenor. */
  ids: string[]
  points: SdmxPoint[]
}

/**
 * Read every series out of an SDMX-JSON response.
 *
 * ## Two things SDMX does that a naive reader gets wrong
 *
 * **Observations are keyed by position, not by date.** The dates live in a
 * parallel array under `structure.dimensions.observation`. Reading the value
 * without reading that array yields a number with no idea when it was true —
 * and an undated rate is not publishable.
 *
 * **Series are keyed by position too.** A request for three tenors comes back
 * with keys like `0:0:0:0:0:0:1`, where each component indexes into
 * `structure.dimensions.series[i].values`. The last component is the tenor, and
 * the order is the API's, not the order asked for: `SR_2Y+SR_5Y+SR_10Y` came
 * back as `["SR_10Y","SR_2Y","SR_5Y"]`. Assuming the requested order would
 * silently label the ten-year yield as the two-year — a mislabelling no reader
 * could detect and every reader would act on.
 *
 * Returns an empty list rather than throwing: a rate we cannot name or date is
 * a rate we do not publish.
 */
export function readSdmxSeries(body: unknown): SdmxSeries[] {
  const json = body as SdmxJson
  const series = json?.dataSets?.[0]?.series
  const dates = json?.structure?.dimensions?.observation?.[0]?.values
  const seriesDims = json?.structure?.dimensions?.series
  if (!series || !Array.isArray(dates)) return []

  const out: SdmxSeries[] = []
  for (const [key, entry] of Object.entries(series)) {
    const observations = entry?.observations
    if (!observations) continue

    const ids = key.split(':').map((part, dimension) => {
      const value = seriesDims?.[dimension]?.values?.[Number(part)]
      return typeof value?.id === 'string' ? value.id : ''
    })

    const points: SdmxPoint[] = []
    for (const [index, tuple] of Object.entries(observations)) {
      const value = Array.isArray(tuple) ? tuple[0] : null
      const date = dates[Number(index)]?.id
      if (typeof value === 'number' && Number.isFinite(value) && typeof date === 'string') {
        points.push({ date, value })
      }
    }
    if (points.length > 0) {
      points.sort((a, b) => a.date.localeCompare(b.date))
      out.push({ ids: ids.filter(Boolean), points })
    }
  }
  return out
}

/** The single-series case, for endpoints that return exactly one. */
export function readSdmx(body: unknown): SdmxPoint[] {
  return readSdmxSeries(body)[0]?.points ?? []
}

/**
 * The euro-area yield curve points we read.
 *
 * Three, not thirty: 2Y and 10Y because their spread is the number the market
 * actually watches, and 5Y because a curve needs a middle to have a shape.
 * Reading the whole curve would be more data and no more meaning.
 */
const CURVE = [
  { tenor: '2Y', key: 'SR_2Y', label: '2-year' },
  { tenor: '5Y', key: 'SR_5Y', label: '5-year' },
  { tenor: '10Y', key: 'SR_10Y', label: '10-year' },
] as const

const ECB_HOST = 'data-api.ecb.europa.eu'

/**
 * All three tenors in **one** request.
 *
 * It was three, one per tenor, and the engine dropped the whole source: a
 * source declaring `minIntervalMs` is rate-limited against its own previous
 * call, so the second and third fetches inside a single run were refused and
 * the curve silently produced nothing. It worked perfectly when run by hand,
 * which is exactly how that class of bug survives.
 *
 * One request is also the better citizen: three round trips to ask an
 * institution for three points of one curve is three times the load for no
 * additional information.
 */
const CURVE_URL = `https://${ECB_HOST}/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.${CURVE.map(
  (c) => c.key,
).join('+')}?lastNObservations=2&format=jsondata`

/**
 * Euro-area sovereign yields, from the institution that computes the curve.
 *
 * Two observations rather than one, because a yield without its previous value
 * cannot show a move — and a rate that is not moving and a rate we cannot tell
 * is moving look identical on a screen.
 */
export const ecbYieldCurve: Source = {
  key: 'ecb_yield_curve',
  capability: 'chain_state',
  passive: true,
  hosts: [ECB_HOST],
  minIntervalMs: 60_000,
  async run(_input: SourceInput, ctx: SourceContext): Promise<Evidence[]> {
    const res = await ctx.fetch(CURVE_URL, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const all = readSdmxSeries(await res.json())

    const out: Evidence[] = []
    for (const point of CURVE) {
      // Matched by the dimension id the API returned, never by position — the
      // response order is not the requested order.
      const series = all.find((s) => s.ids.includes(point.key))?.points ?? []
      const latest = series[series.length - 1]
      if (!latest) continue
      const previous = series.length > 1 ? series[series.length - 2] : null

      out.push({
        claim: `Euro-area ${point.label} government bond yield ${latest.value.toFixed(3)}%`,
        entity: { type: 'other', value: `euro-yield-${point.tenor}` },
        sourceKey: 'ecb_yield_curve',
        sourceUrl: CURVE_URL,
        // The observation's own date, not the moment we fetched it. A Friday
        // close read on a Sunday is Friday's number, and dating it today would
        // make a stale rate look live.
        retrievedAt: `${latest.date}T00:00:00.000Z`,
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: {
          metric: 'rate',
          kind: 'yield',
          tenor: point.tenor,
          label: `Euro area ${point.label}`,
          value: latest.value,
          unit: '%',
          previous: previous ? previous.value : null,
          change: previous ? latest.value - previous.value : null,
          observedOn: latest.date,
        },
      })
    }
    return out
  },
}

const MRO_URL = `https://${ECB_HOST}/service/data/FM/D.U2.EUR.4F.KR.MRR_FR.LEV?lastNObservations=1&format=jsondata`

/** The ECB's main refinancing rate — the floor under every euro rate. */
export const ecbPolicyRate: Source = {
  key: 'ecb_policy_rate',
  capability: 'chain_state',
  passive: true,
  hosts: [ECB_HOST],
  minIntervalMs: 60_000,
  async run(_input: SourceInput, ctx: SourceContext): Promise<Evidence[]> {
    const res = await ctx.fetch(MRO_URL, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const latest = readSdmx(await res.json()).pop()
    if (!latest) return []
    return [
      {
        claim: `ECB main refinancing rate ${latest.value.toFixed(2)}%`,
        entity: { type: 'other', value: 'ecb-mro' },
        sourceKey: 'ecb_policy_rate',
        sourceUrl: MRO_URL,
        retrievedAt: `${latest.date}T00:00:00.000Z`,
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: {
          metric: 'rate',
          kind: 'policy',
          label: 'ECB main refinancing rate',
          value: latest.value,
          unit: '%',
          previous: null,
          change: null,
          observedOn: latest.date,
        },
      },
    ]
  },
}

interface FrankfurterResponse {
  base?: string
  date?: string
  rates?: Record<string, number>
}

/**
 * The currencies we show.
 *
 * A reference table has 30-odd currencies and a screen has room for the ones a
 * reader recognises. These are the majors plus the two most-traded regional
 * currencies our audience actually deals in.
 */
const CURRENCIES = ['EUR', 'GBP', 'JPY', 'CHF', 'CNY', 'CAD', 'AUD', 'INR', 'BRL', 'ZAR'] as const

const FX_HOST = 'api.frankfurter.app'
const FX_URL = `https://${FX_HOST}/latest?from=USD&to=${CURRENCIES.join(',')}`

/**
 * ECB daily reference rates, per US dollar.
 *
 * Quoted from the dollar because that is the unit every other number on this
 * page is in, and a page that switches base currency halfway down is a page
 * that will be misread.
 */
export const referenceRates: Source = {
  key: 'ecb_reference_rates',
  capability: 'chain_state',
  passive: true,
  hosts: [FX_HOST],
  minIntervalMs: 60_000,
  async run(_input: SourceInput, ctx: SourceContext): Promise<Evidence[]> {
    const res = await ctx.fetch(FX_URL, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const json = (await res.json()) as FrankfurterResponse
    const rates = json?.rates
    const date = typeof json?.date === 'string' ? json.date : null
    if (!rates || !date) return []

    return Object.entries(rates)
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .map(([code, value]) => ({
        claim: `1 USD = ${value} ${code} (ECB reference rate, ${date})`,
        entity: { type: 'other', value: `fx-usd-${code.toLowerCase()}` },
        sourceKey: 'ecb_reference_rates',
        sourceUrl: FX_URL,
        retrievedAt: `${date}T00:00:00.000Z`,
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: {
          metric: 'fx',
          base: 'USD',
          quote: code,
          value,
          observedOn: date,
        },
      }))
  },
}
