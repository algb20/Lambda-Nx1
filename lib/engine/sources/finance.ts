/**
 * Financial / sanctions / corporate sources — passive, keyless-first.
 * - OpenSanctions: sanctions/PEP screening for a name or entity.
 * - GLEIF: legal-entity (LEI) records for a company name.
 * - mempool.space: public Bitcoin ledger facts for an address.
 * Each source self-filters by input shape so they register under their capability.
 */
import type { Evidence, Source } from '../types'

const BTC = /^(bc1[a-z0-9]{20,80}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/

// ── OpenSanctions (capability: sanctions) ────────────────────────────────────
interface OsResult {
  caption?: string
  schema?: string
  datasets?: string[]
}
interface OsResponse {
  results?: OsResult[]
}

export const opensanctions: Source = {
  key: 'opensanctions',
  capability: 'sanctions',
  passive: true,
  hosts: ['api.opensanctions.org'],
  minIntervalMs: 500,
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 3 || BTC.test(q)) return []
    const url = `https://api.opensanctions.org/search/default?q=${encodeURIComponent(q)}&limit=5`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as OsResponse | null
    const results = j?.results ?? []
    return results.slice(0, 5).map<Evidence>((r) => ({
      claim: `Sanctions/PEP list match: ${r.caption ?? 'entity'} (${r.schema ?? 'Entity'})`,
      entity: { type: 'person', value: r.caption ?? q },
      sourceKey: 'opensanctions',
      sourceUrl: `https://www.opensanctions.org/search/?q=${encodeURIComponent(q)}`,
      retrievedAt: new Date().toISOString(),
      admiralty: { source: 'B', info: 2 },
      confidence: 'probable',
      data: { caption: r.caption, schema: r.schema, datasets: r.datasets },
    }))
  },
}

// ── GLEIF (capability: sanctions — corporate identity) ───────────────────────
interface GleifRecord {
  attributes?: {
    lei?: string
    entity?: { legalName?: { name?: string }; legalAddress?: { country?: string } }
  }
}
interface GleifResponse {
  data?: GleifRecord[]
}

export const gleif: Source = {
  key: 'gleif',
  capability: 'sanctions',
  passive: true,
  hosts: ['api.gleif.org'],
  minIntervalMs: 500,
  async run(input, ctx) {
    const name = input.value.trim()
    if (name.length < 3 || BTC.test(name)) return []
    const url = `https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=${encodeURIComponent(name)}&page[size]=3`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as GleifResponse | null
    const records = j?.data ?? []
    return records.map<Evidence>((rec) => {
      const legal = rec.attributes?.entity?.legalName?.name ?? name
      const lei = rec.attributes?.lei ?? ''
      const country = rec.attributes?.entity?.legalAddress?.country
      return {
        claim: `Legal entity (GLEIF): ${legal}${lei ? ` — LEI ${lei}` : ''}${country ? ` [${country}]` : ''}`,
        entity: { type: 'company', value: legal },
        sourceKey: 'gleif',
        sourceUrl: lei ? `https://search.gleif.org/#/record/${lei}` : 'https://search.gleif.org',
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'A', info: 2 },
        confidence: 'probable',
        data: { lei, legalName: legal, country },
      }
    })
  },
}

// ── mempool.space (capability: wallet — Bitcoin) ─────────────────────────────
interface MempoolAddress {
  address?: string
  chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number; tx_count?: number }
}

export const mempool: Source = {
  key: 'mempool',
  capability: 'wallet',
  passive: true,
  hosts: ['mempool.space'],
  minIntervalMs: 500,
  async run(input, ctx) {
    const addr = input.value.trim()
    if (!BTC.test(addr)) return []
    const url = `https://mempool.space/api/address/${encodeURIComponent(addr)}`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as MempoolAddress | null
    const stats = j?.chain_stats
    if (!stats) return []
    const balanceSats = (stats.funded_txo_sum ?? 0) - (stats.spent_txo_sum ?? 0)
    const balanceBtc = (balanceSats / 1e8).toFixed(8)
    return [
      {
        claim: `Bitcoin address: balance ${balanceBtc} BTC across ${stats.tx_count ?? 0} tx`,
        entity: { type: 'wallet', value: addr },
        sourceKey: 'mempool',
        sourceUrl: `https://mempool.space/address/${addr}`,
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'A', info: 1 },
        confidence: 'probable',
        data: { balanceBtc, txCount: stats.tx_count },
      },
    ]
  },
}
