/**
 * Macro-economy source — passive, keyless (World Bank Open Data).
 *
 * For a country (name or ISO code) it reports the most-recent figures for
 * twelve indicators: how big the economy is, how expensive, how many people —
 * and what the country actually *makes*, which is the half that was missing.
 * Manufacturing, industry, agriculture and services as shares of GDP, exports,
 * and two measures of the private sector's real size.
 *
 * Self-filters: returns nothing unless the input resolves to a country, so it
 * can ride the Markets gateway without needing a mode of its own.
 */
import type { Evidence, Source } from '../types'
import { expectOk } from '../fetch-guard'

/** Common country names + ISO2 → ISO3 (World Bank uses ISO3). Extend as needed. */
const NAME_TO_ISO3: Record<string, string> = {
  'united states': 'USA', usa: 'USA', us: 'USA', america: 'USA',
  'united kingdom': 'GBR', uk: 'GBR', britain: 'GBR', england: 'GBR',
  china: 'CHN', cn: 'CHN', japan: 'JPN', jp: 'JPN', germany: 'DEU', de: 'DEU',
  france: 'FRA', fr: 'FRA', india: 'IND', in: 'IND', brazil: 'BRA', br: 'BRA',
  canada: 'CAN', ca: 'CAN', italy: 'ITA', it: 'ITA', spain: 'ESP', es: 'ESP',
  russia: 'RUS', ru: 'RUS', 'saudi arabia': 'SAU', sa: 'SAU', 'south korea': 'KOR', kr: 'KOR',
  australia: 'AUS', au: 'AUS', mexico: 'MEX', mx: 'MEX', indonesia: 'IDN', id: 'IDN',
  turkey: 'TUR', turkiye: 'TUR', tr: 'TUR', switzerland: 'CHE', ch: 'CHE',
  netherlands: 'NLD', nl: 'NLD', 'united arab emirates': 'ARE', uae: 'ARE', ae: 'ARE',
  egypt: 'EGY', eg: 'EGY', nigeria: 'NGA', ng: 'NGA', 'south africa': 'ZAF', za: 'ZAF',
  pakistan: 'PAK', pk: 'PAK', qatar: 'QAT', qa: 'QAT', singapore: 'SGP', sg: 'SGP',
}

function resolveCountry(input: string): string | null {
  const s = input.trim().toLowerCase()
  if (NAME_TO_ISO3[s]) return NAME_TO_ISO3[s]
  if (/^[a-z]{3}$/.test(s)) return s.toUpperCase() // assume ISO3
  return null
}

interface WbPoint {
  indicator?: { id?: string; value?: string }
  country?: { value?: string }
  date?: string
  value?: number | null
}
type WbResponse = [unknown, WbPoint[] | null]

/**
 * What a country's economy is, not just how big it is.
 *
 * This was three indicators — GDP, population, inflation — which answers "how
 * large and how expensive" and nothing else. A reader asking about a country's
 * **industry**, its **factories**, or the size of its **private sector** got
 * nothing at all, because none of it was ever requested.
 *
 * The additions are the shares that say what a country actually *does*.
 * Manufacturing, industry, agriculture and services are the four parts of
 * value added and they are published as percentages of GDP, so they can be
 * compared between countries of wildly different size — Germany's 17.6%
 * manufacturing share means something next to another country's 5% in a way
 * that two absolute figures never would.
 *
 * `Private sector credit` is the one that answers the private-versus-state half
 * of the question directly: how much of the banking system's lending reaches
 * private firms rather than the state. `New business density` is its companion
 * — how many companies are actually being founded per thousand working-age
 * adults.
 *
 * Every code here was requested live before it was added, and every one
 * answered with a current figure. An indicator that returns nothing is worse
 * than an absent one: it makes the gateway look broken on a country that is
 * simply not covered for that series.
 */
const INDICATORS: Array<{ code: string; label: string; kind: 'usd' | 'num' | 'pct' }> = [
  { code: 'NY.GDP.MKTP.CD', label: 'GDP', kind: 'usd' },
  { code: 'NY.GDP.PCAP.CD', label: 'GDP per person', kind: 'usd' },
  { code: 'SP.POP.TOTL', label: 'Population', kind: 'num' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation', kind: 'pct' },
  { code: 'SL.UEM.TOTL.ZS', label: 'Unemployment', kind: 'pct' },
  // What the country makes and sells — the productive economy.
  { code: 'NV.IND.MANF.ZS', label: 'Manufacturing (share of GDP)', kind: 'pct' },
  { code: 'NV.IND.TOTL.ZS', label: 'Industry incl. construction (share of GDP)', kind: 'pct' },
  { code: 'NV.AGR.TOTL.ZS', label: 'Agriculture (share of GDP)', kind: 'pct' },
  { code: 'NV.SRV.TOTL.ZS', label: 'Services (share of GDP)', kind: 'pct' },
  { code: 'NE.EXP.GNFS.ZS', label: 'Exports (share of GDP)', kind: 'pct' },
  // The private sector, measured rather than assumed.
  { code: 'FS.AST.PRVT.GD.ZS', label: 'Credit to the private sector (share of GDP)', kind: 'pct' },
  { code: 'IC.BUS.NDNS.ZS', label: 'New businesses per 1,000 adults', kind: 'num' },
]

function fmt(value: number, kind: 'usd' | 'num' | 'pct'): string {
  if (kind === 'pct') return `${value.toFixed(1)}%`
  const abs = Math.abs(value)
  if (kind === 'usd') {
    if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  return value.toLocaleString('en-US')
}

export const worldbankEconomy: Source = {
  key: 'worldbank_economy',
  capability: 'economy',
  passive: true,
  hosts: ['api.worldbank.org'],
  minIntervalMs: 800,
  async run(input, ctx) {
    const code = resolveCountry(input.value)
    if (!code) return []

    /**
     * All twelve indicators in **one** request.
     *
     * It was one request per indicator, which was survivable at three and is
     * not at twelve: twelve round trips to ask one institution twelve
     * questions about one country, when the API answers all of them together
     * (`indicator/A;B;C`), is twelve times the load for no extra information
     * — and §3 asks us to respect the rate limits of the public bodies we
     * read.
     *
     * It is also the exact shape of a bug already paid for in
     * `lib/engine/sources/rates.ts`: a source that declares `minIntervalMs`
     * is rate-limited against its own previous call, so fan-out inside a
     * single run can be silently refused and the source produces nothing
     * while looking healthy. One request cannot race with itself.
     */
    const codes = INDICATORS.map((i) => i.code).join(';')
    const url = `https://api.worldbank.org/v2/country/${code}/indicator/${codes}?format=json&mrv=1&source=2&per_page=200`
    const res = await ctx.fetch(url)
    expectOk('worldbank_economy', res)
    const j = (await res.json().catch(() => null)) as WbResponse | null
    const points = Array.isArray(j) ? (j[1] ?? []) : []

    /**
     * Keep the order the indicators are declared in, not the order the API
     * happened to return them.
     *
     * GDP first and manufacturing share next is a reading order chosen on
     * purpose; the response order is the provider's business and has changed
     * before. This is the same mistake the ECB yield curve made — reading a
     * multi-series response by position instead of by identity.
     */
    const byCode = new Map<string, WbPoint>()
    for (const p of points) {
      const id = p?.indicator?.id
      if (typeof id !== 'string' || typeof p.value !== 'number') continue
      // `mrv=1` should give one row per indicator; if a provider ever returns
      // more, the first is the most recent and the rest are history.
      if (!byCode.has(id)) byCode.set(id, p)
    }

    return INDICATORS.map((ind) => {
      const point = byCode.get(ind.code)
      return point ? { ind, point } : null
    })
      .filter((r): r is { ind: (typeof INDICATORS)[number]; point: WbPoint } => r !== null)
      .map<Evidence>(({ ind, point }) => ({
        claim: `Economy — ${point.country?.value ?? code} ${ind.label} (${point.date}): ${fmt(point.value as number, ind.kind)}`,
        entity: { type: 'other', value: point.country?.value ?? code },
        sourceKey: 'worldbank_economy',
        sourceUrl: `https://data.worldbank.org/country/${code}`,
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: { indicator: ind.code, value: point.value, year: point.date },
      }))
  },
}
