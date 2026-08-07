/**
 * Chain-state sources — the on-chain half of the blockchain radar.
 *
 * Prices are already covered by the markets board. These answer the questions a
 * price feed cannot: how congested is the network, where is the chain tip, and
 * how is the market structured between assets. Those are measurements of the
 * chain itself, published by the network's own public endpoints, so they are
 * graded as observations rather than as reports about observations.
 *
 * Keyless, passive, read-only.
 */
import type { Evidence, Source, SourceContext, SourceInput } from '../types'

// ── mempool.space — Bitcoin network state ────────────────────────────────────
interface RecommendedFees {
  fastestFee?: number
  halfHourFee?: number
  hourFee?: number
  economyFee?: number
  minimumFee?: number
}
interface MempoolState {
  count?: number
  vsize?: number
  total_fee?: number
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

export const mempoolNetwork: Source = {
  key: 'mempool_network',
  capability: 'chain_state',
  passive: true,
  hosts: ['mempool.space'],
  minIntervalMs: 1500,
  async run(_input: SourceInput, ctx: SourceContext) {
    // Three small independent reads; one failing must not lose the other two.
    const [feesRes, tipRes, poolRes] = await Promise.allSettled([
      ctx.fetch('https://mempool.space/api/v1/fees/recommended'),
      ctx.fetch('https://mempool.space/api/blocks/tip/height'),
      ctx.fetch('https://mempool.space/api/mempool'),
    ])
    const at = new Date().toISOString()
    const out: Evidence[] = []
    const base = {
      sourceKey: 'mempool_network',
      sourceUrl: 'https://mempool.space',
      retrievedAt: at,
      // The network's own state, read from a node — an observation, not a claim.
      admiralty: { source: 'A', info: 1 } as const,
      confidence: 'confirmed' as const,
    }

    if (feesRes.status === 'fulfilled' && feesRes.value.ok) {
      const fees = (await feesRes.value.json().catch(() => null)) as RecommendedFees | null
      const fastest = num(fees?.fastestFee)
      if (fastest !== null) {
        out.push({
          ...base,
          claim: `Bitcoin fee for next-block confirmation: ${fastest} sat/vB`,
          entity: { type: 'other', value: 'bitcoin' },
          data: {
            metric: 'fees',
            chain: 'bitcoin',
            fastest,
            halfHour: num(fees?.halfHourFee),
            hour: num(fees?.hourFee),
            economy: num(fees?.economyFee),
            minimum: num(fees?.minimumFee),
            unit: 'sat/vB',
          },
        })
      }
    }

    if (tipRes.status === 'fulfilled' && tipRes.value.ok) {
      const text = await tipRes.value.text().catch(() => '')
      const height = Number(text.trim())
      if (Number.isFinite(height) && height > 0) {
        out.push({
          ...base,
          claim: `Bitcoin chain tip at block ${height.toLocaleString('en-US')}`,
          entity: { type: 'other', value: 'bitcoin' },
          data: { metric: 'tip', chain: 'bitcoin', height },
        })
      }
    }

    if (poolRes.status === 'fulfilled' && poolRes.value.ok) {
      const pool = (await poolRes.value.json().catch(() => null)) as MempoolState | null
      const count = num(pool?.count)
      if (count !== null) {
        out.push({
          ...base,
          claim: `${count.toLocaleString('en-US')} transactions waiting in the Bitcoin mempool`,
          entity: { type: 'other', value: 'bitcoin' },
          data: {
            metric: 'mempool',
            chain: 'bitcoin',
            count,
            vsize: num(pool?.vsize),
            totalFee: num(pool?.total_fee),
          },
        })
      }
    }

    return out
  },
}

// ── CoinGecko global — market structure ──────────────────────────────────────
interface GlobalResponse {
  data?: {
    active_cryptocurrencies?: number
    total_market_cap?: Record<string, number>
    total_volume?: Record<string, number>
    market_cap_percentage?: Record<string, number>
    market_cap_change_percentage_24h_usd?: number
  }
}

export const coingeckoGlobal: Source = {
  key: 'coingecko_global',
  capability: 'chain_state',
  passive: true,
  hosts: ['api.coingecko.com'],
  minIntervalMs: 2000,
  async run(_input: SourceInput, ctx: SourceContext) {
    const res = await ctx.fetch('https://api.coingecko.com/api/v3/global')
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as GlobalResponse | null
    const d = j?.data
    if (!d) return []
    const cap = num(d.total_market_cap?.usd)
    if (cap === null) return []
    const change = num(d.market_cap_change_percentage_24h_usd)
    return [
      {
        claim:
          `Total crypto market capitalisation $${(cap / 1e12).toFixed(2)}T` +
          (change !== null ? ` (${change >= 0 ? '+' : ''}${change.toFixed(2)}% in 24h)` : ''),
        entity: { type: 'other', value: 'crypto-market' },
        sourceKey: 'coingecko_global',
        sourceUrl: 'https://www.coingecko.com/en/global-charts',
        retrievedAt: new Date().toISOString(),
        // An aggregator's computation over exchange data — reliable, but derived.
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: {
          metric: 'market',
          totalMarketCapUsd: cap,
          totalVolumeUsd: num(d.total_volume?.usd),
          btcDominance: num(d.market_cap_percentage?.btc),
          ethDominance: num(d.market_cap_percentage?.eth),
          change24h: change,
          activeAssets: num(d.active_cryptocurrencies),
        },
      },
    ]
  },
}

export const chainStateSources: Source[] = [mempoolNetwork, coingeckoGlobal]
