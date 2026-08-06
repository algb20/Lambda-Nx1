/**
 * Macro-economy source — passive, keyless (World Bank Open Data). For a country
 * (name or ISO code) it reports the most-recent key indicators: GDP, population
 * and inflation. Self-filters: returns nothing unless the input resolves to a
 * country, so it can ride the Markets gateway without a separate mode.
 */
import type { Evidence, Source } from '../types'

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
  indicator?: { value?: string }
  country?: { value?: string }
  date?: string
  value?: number | null
}
type WbResponse = [unknown, WbPoint[] | null]

const INDICATORS: Array<{ code: string; label: string; kind: 'usd' | 'num' | 'pct' }> = [
  { code: 'NY.GDP.MKTP.CD', label: 'GDP', kind: 'usd' },
  { code: 'SP.POP.TOTL', label: 'Population', kind: 'num' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation', kind: 'pct' },
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
    const results = await Promise.all(
      INDICATORS.map(async (ind) => {
        const url = `https://api.worldbank.org/v2/country/${code}/indicator/${ind.code}?format=json&mrv=1`
        const res = await ctx.fetch(url)
        if (!res.ok) return null
        const j = (await res.json().catch(() => null)) as WbResponse | null
        const point = Array.isArray(j) ? j[1]?.[0] : null
        if (!point || typeof point.value !== 'number') return null
        return { ind, point }
      }),
    )
    return results
      .filter((r): r is NonNullable<typeof r> => r !== null)
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
