/**
 * Markets & Economy sources — passive, keyless-first public data.
 *
 *  - CoinGecko: live crypto market facts (price, market cap, 24h change).
 *  - SEC EDGAR (full-text search): public company filings / disclosures.
 *  - Frankfurter: ECB reference FX rates for a currency pair.
 *
 * Every fact is a *published, public* datum with its source and timestamp — we
 * report the market as it is, we do not predict it. Each source self-filters by
 * input shape so it only produces evidence for inputs it understands.
 */
import type { Evidence, Source } from '../types'

const FX_PAIR = /^([a-z]{3})\s*[\/\- ]\s*([a-z]{3})$/i

// ── CoinGecko (capability: market — crypto) ──────────────────────────────────
interface CgSearchCoin {
  id?: string
  name?: string
  symbol?: string
  market_cap_rank?: number | null
}
interface CgSearchResponse {
  coins?: CgSearchCoin[]
}
interface CgPriceEntry {
  usd?: number
  usd_market_cap?: number
  usd_24h_change?: number
}
type CgPriceResponse = Record<string, CgPriceEntry>

function fmtUsd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${n.toPrecision(4)}`
}

export const coingecko: Source = {
  key: 'coingecko',
  capability: 'market',
  passive: true,
  hosts: ['api.coingecko.com'],
  minIntervalMs: 1500,
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 2 || FX_PAIR.test(q)) return []
    // 1) Resolve the query to the best-ranked coin id.
    const searchRes = await ctx.fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
    )
    if (!searchRes.ok) return []
    const search = (await searchRes.json().catch(() => null)) as CgSearchResponse | null
    const coins = (search?.coins ?? []).filter((c) => c.id)
    if (coins.length === 0) return []
    // Prefer an exact symbol/name match, else the highest market-cap rank.
    const lower = q.toLowerCase()
    const exact = coins.find(
      (c) => c.symbol?.toLowerCase() === lower || c.name?.toLowerCase() === lower,
    )
    const ranked = [...coins].sort(
      (a, b) => (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9),
    )
    const coin = exact ?? ranked[0]
    const id = coin.id!
    // 2) Fetch live market facts for that coin.
    const priceRes = await ctx.fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}` +
        `&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`,
    )
    if (!priceRes.ok) return []
    const prices = (await priceRes.json().catch(() => null)) as CgPriceResponse | null
    const p = prices?.[id]
    if (!p || typeof p.usd !== 'number') return []
    const change = typeof p.usd_24h_change === 'number' ? p.usd_24h_change : null
    const mcap = typeof p.usd_market_cap === 'number' ? p.usd_market_cap : null
    const label = `${coin.name ?? id}${coin.symbol ? ` (${coin.symbol.toUpperCase()})` : ''}`
    return [
      {
        claim:
          `Crypto market — ${label}: ${fmtUsd(p.usd)}` +
          (change !== null ? `, ${change >= 0 ? '+' : ''}${change.toFixed(2)}% 24h` : '') +
          (mcap !== null ? `, market cap ${fmtUsd(mcap)}` : '') +
          (coin.market_cap_rank ? ` [rank #${coin.market_cap_rank}]` : ''),
        entity: { type: 'other', value: id },
        sourceKey: 'coingecko',
        sourceUrl: `https://www.coingecko.com/en/coins/${id}`,
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: { id, symbol: coin.symbol, usd: p.usd, change24h: change, marketCap: mcap, rank: coin.market_cap_rank },
      },
    ]
  },
}

// ── SEC EDGAR full-text search (capability: securities — disclosures) ─────────
interface EftsHit {
  _id?: string
  _source?: {
    display_names?: string[]
    form?: string
    file_date?: string
    file_type?: string
  }
}
interface EftsResponse {
  hits?: { total?: { value?: number }; hits?: EftsHit[] }
}

// SEC asks every automated client to send a descriptive User-Agent (else 403).
const SEC_HEADERS = {
  'User-Agent': 'Lambda NX OSINT (research; contact via app)',
  Accept: 'application/json',
}

export const edgar: Source = {
  key: 'edgar',
  capability: 'securities',
  passive: true,
  hosts: ['efts.sec.gov'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 2 || FX_PAIR.test(q)) return []
    const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${q}"`)}`
    const res = await ctx.fetch(url, { headers: SEC_HEADERS })
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as EftsResponse | null
    const hits = j?.hits?.hits ?? []
    if (hits.length === 0) return []
    return hits.slice(0, 5).map<Evidence>((h) => {
      const name = h._source?.display_names?.[0] ?? q
      const form = h._source?.form ?? 'filing'
      const date = h._source?.file_date ?? ''
      const accession = (h._id ?? '').split(':')[0]
      return {
        claim: `SEC filing — ${name}: ${form}${date ? ` filed ${date}` : ''}`,
        entity: { type: 'company', value: name },
        sourceKey: 'edgar',
        sourceUrl: accession
          ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(q)}`
          : 'https://www.sec.gov/cgi-bin/srqsb',
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: { name, form, date, accession },
      }
    })
  },
}

// ── Frankfurter (capability: fx — ECB reference rates) ───────────────────────
interface FrankfurterResponse {
  base?: string
  date?: string
  rates?: Record<string, number>
}

export const frankfurter: Source = {
  key: 'frankfurter',
  capability: 'fx',
  passive: true,
  hosts: ['api.frankfurter.dev'],
  minIntervalMs: 500,
  async run(input, ctx) {
    const m = FX_PAIR.exec(input.value.trim())
    if (!m) return []
    const base = m[1].toUpperCase()
    const target = m[2].toUpperCase()
    if (base === target) return []
    const url = `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${target}`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as FrankfurterResponse | null
    const rate = j?.rates?.[target]
    if (typeof rate !== 'number') return []
    return [
      {
        claim: `FX (ECB reference, ${j?.date ?? 'latest'}): 1 ${base} = ${rate} ${target}`,
        entity: { type: 'other', value: `${base}/${target}` },
        sourceKey: 'frankfurter',
        sourceUrl: 'https://www.frankfurter.dev',
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: { base, target, rate, date: j?.date },
      },
    ]
  },
}
