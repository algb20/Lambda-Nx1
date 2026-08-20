/**
 * Property & real estate — sources.
 *
 * ## Why this gateway did not exist, and why it does now
 *
 * Housing is the largest asset class on earth and the one most people's wealth
 * actually sits in, and the platform had nothing on it: not a price, not a
 * mortgage rate, not a construction figure. Meanwhile every "property data"
 * product on the market sells the same three public series back to its users
 * behind a login.
 *
 * ## What is here, and why these and not others
 *
 * Three publishers, chosen because each is the **statistical authority for its
 * own territory** — not an aggregator reselling them:
 *
 *  - **FRED** (Federal Reserve Bank of St. Louis) for the United States:
 *    Case-Shiller, median sale price, housing starts, the 30-year mortgage,
 *    rental vacancy and months' supply. The Fed publishing series it curates
 *    itself is A/1.
 *  - **Eurostat** for the European Union: the official quarterly house price
 *    index, the number every EU housing policy argument is conducted in.
 *  - **HM Land Registry** for the United Kingdom, published as linked open
 *    data. This is the registry itself — the body that records every transfer
 *    of title in England and Wales — not a portal's estimate of what houses
 *    might be worth.
 *
 * ## What is deliberately absent
 *
 * Individual property listings and per-address valuations. They are the obvious
 * thing to want and they are the wrong thing to build: the listing portals'
 * terms forbid it, an address is a private individual's home, and charter §3
 * rules out exactly this. Aggregate market structure is public, lawful and is
 * what an analyst actually reasons with.
 */
import type { Evidence, Source } from '../types'

export type PropertyClass = 'price' | 'activity' | 'finance' | 'supply'

interface PropertyPoint {
  cls: PropertyClass
  region: string
  name: string
  value: number
  /** Change against the previous published observation, in percent. */
  change: number | null
  unit: string
  period: string
  sourceKey: string
  sourceUrl: string
  admiraltyInfo: 1 | 2
}

function propertyEvidence(p: PropertyPoint): Evidence {
  const chg = p.change !== null ? ` (${p.change >= 0 ? '+' : ''}${p.change.toFixed(2)}%)` : ''
  return {
    // The period is inside the claim, not beside it. A housing figure without
    // its quarter reads as today's and is often six months old — every one of
    // these series is published with a lag, and hiding that would be the single
    // most misleading thing this gateway could do.
    claim: `${p.region} — ${p.name}: ${formatValue(p.value, p.unit)}${chg} · ${p.period}`,
    entity: { type: 'other', value: `${p.region}:${p.name}` },
    sourceKey: p.sourceKey,
    sourceUrl: p.sourceUrl,
    retrievedAt: new Date().toISOString(),
    admiralty: { source: 'A', info: p.admiraltyInfo },
    confidence: 'probable',
    data: {
      class: p.cls,
      region: p.region,
      name: p.name,
      value: p.value,
      change: p.change,
      unit: p.unit,
      period: p.period,
      sourceUrl: p.sourceUrl,
    },
  }
}

function formatValue(value: number, unit: string): string {
  if (unit === '%') return `${value.toFixed(2)}%`
  if (unit === 'USD') return `$${Math.round(value).toLocaleString('en-US')}`
  if (unit === 'GBP') return `£${Math.round(value).toLocaleString('en-GB')}`
  if (unit === 'thousands of units') return `${value.toLocaleString('en-US')}k units`
  if (unit === 'months') return `${value.toFixed(1)} months`
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

// ── United States — FRED ─────────────────────────────────────────────────────

interface FredHousingSeries {
  id: string
  name: string
  cls: PropertyClass
  unit: string
}

const US_SERIES: FredHousingSeries[] = [
  { id: 'CSUSHPINSA', name: 'Case-Shiller national home price index', cls: 'price', unit: 'index' },
  { id: 'MSPUS', name: 'Median sale price, houses sold', cls: 'price', unit: 'USD' },
  { id: 'HOUST', name: 'Housing starts', cls: 'activity', unit: 'thousands of units' },
  { id: 'MORTGAGE30US', name: '30-year fixed mortgage rate', cls: 'finance', unit: '%' },
  { id: 'RRVRUSQ156N', name: 'Rental vacancy rate', cls: 'supply', unit: '%' },
  { id: 'MSACSR', name: "Months' supply of new houses", cls: 'supply', unit: 'months' },
]

/**
 * The last two observations of a FRED series.
 *
 * Two rather than one, because the change between them is the only defensible
 * way to state a move: FRED publishes levels and never percentages, so a change
 * computed here is arithmetic over its own numbers rather than one we invented.
 * `.` marks a period with no observation and is skipped — reading it as zero
 * would draw a housing market that fell to nothing.
 */
function lastTwo(csv: string): Array<{ date: string; value: number }> {
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

export const usHousing: Source = {
  key: 'fred_housing',
  capability: 'property',
  passive: true,
  hosts: ['fred.stlouisfed.org'],
  // Per request, and this source makes one per series. Six series at the 2000ms
  // used for slower providers would spend twelve seconds and be killed by the
  // orchestrator's deadline — losing the whole gateway to our own politeness.
  minIntervalMs: 300,
  async run(_input, ctx) {
    const out: Evidence[] = []
    for (const s of US_SERIES) {
      const res = await ctx.fetch(
        `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(s.id)}`,
      )
      // One unavailable series must not cost the other five.
      if (!res.ok) continue
      const rows = lastTwo(await res.text().catch(() => ''))
      const latest = rows[rows.length - 1]
      if (!latest) continue
      const previous = rows.length > 1 ? rows[0] : null
      out.push(
        propertyEvidence({
          cls: s.cls,
          region: 'United States',
          name: s.name,
          value: latest.value,
          change:
            previous && previous.value !== 0
              ? ((latest.value - previous.value) / previous.value) * 100
              : null,
          unit: s.unit,
          period: latest.date,
          sourceKey: 'fred_housing',
          sourceUrl: `https://fred.stlouisfed.org/series/${s.id}`,
          admiraltyInfo: 1,
        }),
      )
    }
    return out
  },
}

// ── European Union — Eurostat ────────────────────────────────────────────────

/**
 * Eurostat answers in JSON-stat, which is a dimension-indexed format rather than
 * a list of rows: values live in a flat object keyed by a *computed* position
 * across every dimension. Reading it requires the dimension sizes and each
 * category's index, which is why this is fifteen lines rather than a `.map`.
 */
interface JsonStat {
  value?: Record<string, number>
  dimension?: Record<string, { category?: { index?: Record<string, number>; label?: Record<string, string> } }>
  id?: string[]
  size?: number[]
}

/**
 * Aggregates that describe a membership the Union no longer has.
 *
 * Eurostat publishes seven of them — `EU`, `EU28`, `EA`, `EA19`, `EA20` and so
 * on — because a researcher comparing across decades needs the composition that
 * was in force at the time. A reader looking at house prices does not: they see
 * six near-identical rows with numbers that differ in the first decimal, and
 * learn nothing from any of them. Only the two current definitions are kept.
 */
const SUPERSEDED_AGGREGATES = new Set(['EU', 'EU28', 'EA', 'EA19', 'EA20'])

/**
 * Eurostat's labels carry their own footnotes — "European Union - 27 countries
 * (from 2020)" — which is precise and unreadable at the width of a row. The two
 * aggregates get a plain name; every country already has one.
 */
function cleanRegion(code: string, label: string | undefined): string {
  if (code === 'EU27_2020') return 'European Union'
  if (code === 'EA21') return 'Euro area'
  return label ?? code
}

export const euHousePrices: Source = {
  key: 'eurostat_hpi',
  capability: 'property',
  passive: true,
  hosts: ['ec.europa.eu'],
  minIntervalMs: 1500,
  async run(_input, ctx) {
    // `purchase=TOTAL` — all dwellings; `unit=I15_Q` — index, 2015 = 100, the
    // series Eurostat's own housing commentary quotes.
    const url =
      'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hpi_q' +
      '?format=JSON&lastTimePeriod=1&purchase=TOTAL&unit=I15_Q'
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const body = (await res.json().catch(() => null)) as JsonStat | null
    if (!body?.value || !body.dimension || !body.id || !body.size) return []

    const geoIndex = body.dimension.geo?.category?.index ?? {}
    const geoLabel = body.dimension.geo?.category?.label ?? {}
    const timeLabels = Object.keys(body.dimension.time?.category?.index ?? {})
    const period = timeLabels[timeLabels.length - 1] ?? 'latest'

    // Position of `geo` among the dimensions, and the stride of one step along
    // it — the product of the sizes of every dimension after it.
    const geoAxis = body.id.indexOf('geo')
    if (geoAxis === -1) return []
    const stride = body.size.slice(geoAxis + 1).reduce((n, s) => n * s, 1)

    const out: Evidence[] = []
    for (const [code, index] of Object.entries(geoIndex)) {
      if (SUPERSEDED_AGGREGATES.has(code)) continue
      const value = body.value[String(index * stride)]
      if (typeof value !== 'number') continue
      out.push(
        propertyEvidence({
          cls: 'price',
          region: cleanRegion(code, geoLabel[code]),
          name: 'House price index (2015 = 100)',
          value,
          // One period was requested, so there is no previous observation to
          // difference against. Stating null is right; a change against nothing
          // would be a number with no meaning.
          change: null,
          unit: 'index',
          period,
          sourceKey: 'eurostat_hpi',
          sourceUrl: 'https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_q/default/table',
          admiraltyInfo: 1,
        }),
      )
    }
    return out
  },
}

// ── United Kingdom — HM Land Registry ────────────────────────────────────────

interface UkhpiResult {
  result?: {
    primaryTopic?: Record<string, unknown>
  }
}

/** The Land Registry publishes each figure as a one-element array of literals. */
function ukValue(topic: Record<string, unknown>, key: string): number | null {
  const raw = topic[key]
  const first = Array.isArray(raw) ? raw[0] : raw
  const value = typeof first === 'object' && first !== null ? (first as { _value?: unknown })._value : first
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export const ukHousePrices: Source = {
  key: 'ukhpi_landregistry',
  capability: 'property',
  passive: true,
  hosts: ['landregistry.data.gov.uk'],
  minIntervalMs: 1500,
  async run(_input, ctx) {
    /**
     * The UK HPI is published with roughly a two-month lag, so "this month" is
     * never available. Walking back from three months ago and stopping at the
     * first month that exists is how the lag is handled without hard-coding a
     * guess about it — a fixed offset would silently break the day the registry
     * changed its publication schedule.
     */
    const now = new Date()
    for (let back = 2; back <= 6; back++) {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
      const stamp = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`
      const res = await ctx.fetch(
        `https://landregistry.data.gov.uk/data/ukhpi/region/united-kingdom/month/${stamp}.json`,
      )
      if (!res.ok) continue
      const body = (await res.json().catch(() => null)) as UkhpiResult | null
      const topic = body?.result?.primaryTopic
      if (!topic) continue

      const average = ukValue(topic, 'averagePrice')
      if (average === null) continue
      const annual = ukValue(topic, 'percentageAnnualChange')
      const sales = ukValue(topic, 'salesVolume')

      const out: Evidence[] = [
        propertyEvidence({
          cls: 'price',
          region: 'United Kingdom',
          name: 'Average house price',
          value: average,
          change: annual,
          unit: 'GBP',
          period: stamp,
          sourceKey: 'ukhpi_landregistry',
          sourceUrl: `https://landregistry.data.gov.uk/app/ukhpi/browse?from=${stamp}-01`,
          // The registry of title itself, not an estimate of what a house might
          // fetch: this is the transaction record.
          admiraltyInfo: 1,
        }),
      ]
      if (sales !== null) {
        out.push(
          propertyEvidence({
            cls: 'activity',
            region: 'United Kingdom',
            name: 'Residential sales volume',
            value: sales,
            change: null,
            unit: 'transactions',
            period: stamp,
            sourceKey: 'ukhpi_landregistry',
            sourceUrl: `https://landregistry.data.gov.uk/app/ukhpi/browse?from=${stamp}-01`,
            admiraltyInfo: 1,
          }),
        )
      }
      return out
    }
    return []
  },
}

export const PROPERTY_SOURCES: Source[] = [usHousing, euHousePrices, ukHousePrices]
