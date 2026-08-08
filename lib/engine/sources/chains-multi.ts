/**
 * Multi-chain state — the networks themselves, not their prices.
 *
 * The radar used to be Bitcoin only, which is not a blockchain radar; it is a
 * Bitcoin dashboard. Each network here is read from **its own** public node or
 * Horizon instance, so what we report is the chain's own answer rather than an
 * aggregator's summary of it. Every one is keyless.
 *
 *  - **Pi Network** — a Stellar-derived chain, so its public Horizon API answers
 *    with ledgers carrying `total_coins` and `fee_pool`: real supply and real
 *    activity, straight from mainnet.
 *  - **Ethereum** — JSON-RPC against a public gateway: head block and base fee.
 *  - **Solana** — JSON-RPC: epoch progress and measured transactions per second.
 *
 * The per-chain shapes differ wildly, so each adapter normalises into the same
 * `chain_state` evidence the radar module consumes.
 */
import type { Evidence, Source, SourceContext, SourceInput } from '../types'
import { expectJson } from '../fetch-guard'

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/** Parse a decimal string that an API returned as text (Horizon does this). */
export function parseDecimal(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const n = Number(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Parse a 0x-prefixed quantity, as every Ethereum JSON-RPC result is encoded. */
export function parseHex(v: unknown): number | null {
  if (typeof v !== 'string' || !/^0x[0-9a-f]+$/i.test(v)) return null
  const n = Number.parseInt(v, 16)
  return Number.isFinite(n) ? n : null
}

async function rpc(
  ctx: SourceContext,
  url: string,
  method: string,
  params: unknown[] = [],
): Promise<unknown> {
  const res = await ctx.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) return null
  const j = (await res.json().catch(() => null)) as { result?: unknown } | null
  return j?.result ?? null
}

// ── Pi Network (Horizon) ─────────────────────────────────────────────────────
interface HorizonLedger {
  sequence?: number
  closed_at?: string
  total_coins?: string
  fee_pool?: string
  operation_count?: number
  successful_transaction_count?: number
  failed_transaction_count?: number
  base_fee_in_stroops?: number
}
interface HorizonLedgersResponse {
  _embedded?: { records?: HorizonLedger[] }
}

export const piNetworkChain: Source = {
  key: 'pi_network',
  capability: 'chain_state',
  passive: true,
  hosts: ['api.mainnet.minepi.com'],
  minIntervalMs: 1500,
  async run(_input: SourceInput, ctx: SourceContext) {
    const res = await ctx.fetch(
      'https://api.mainnet.minepi.com/ledgers?order=desc&limit=1',
      { headers: { Accept: 'application/json' } },
    )
    const j = await expectJson<HorizonLedgersResponse>('pi_network', res)
    const ledger = j?._embedded?.records?.[0]
    if (!ledger || typeof ledger.sequence !== 'number') return []

    const totalCoins = parseDecimal(ledger.total_coins)
    const feePool = parseDecimal(ledger.fee_pool)
    const txCount =
      (num(ledger.successful_transaction_count) ?? 0) + (num(ledger.failed_transaction_count) ?? 0)

    return [
      {
        claim:
          `Pi Network at ledger ${ledger.sequence.toLocaleString('en-US')}` +
          (totalCoins !== null ? `, total supply ${(totalCoins / 1e9).toFixed(2)}B π` : ''),
        entity: { type: 'other', value: 'pi-network' },
        sourceKey: 'pi_network',
        sourceUrl: 'https://api.mainnet.minepi.com/ledgers?order=desc&limit=1',
        retrievedAt: ledger.closed_at ?? new Date().toISOString(),
        // Mainnet's own Horizon node answering about its own ledger.
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: {
          metric: 'network',
          chain: 'pi',
          chainLabel: 'Pi Network',
          symbol: 'PI',
          height: ledger.sequence,
          closedAt: ledger.closed_at ?? null,
          totalSupply: totalCoins,
          feePool,
          operations: num(ledger.operation_count),
          transactions: txCount,
          baseFee: num(ledger.base_fee_in_stroops),
          feeUnit: 'stroops',
        },
      },
    ]
  },
}

// ── Ethereum (public JSON-RPC gateway) ───────────────────────────────────────
export const ethereumChain: Source = {
  key: 'ethereum_rpc',
  capability: 'chain_state',
  passive: true,
  hosts: ['ethereum-rpc.publicnode.com'],
  minIntervalMs: 1500,
  async run(_input: SourceInput, ctx: SourceContext) {
    const url = 'https://ethereum-rpc.publicnode.com'
    // Two independent reads; losing one must not lose the other.
    const [blockRaw, gasRaw] = await Promise.all([
      rpc(ctx, url, 'eth_blockNumber').catch(() => null),
      rpc(ctx, url, 'eth_gasPrice').catch(() => null),
    ])
    const height = parseHex(blockRaw)
    if (height === null) return []
    const gasWei = parseHex(gasRaw)
    const gwei = gasWei !== null ? gasWei / 1e9 : null
    return [
      {
        claim:
          `Ethereum at block ${height.toLocaleString('en-US')}` +
          (gwei !== null ? `, gas ${gwei.toFixed(2)} gwei` : ''),
        entity: { type: 'other', value: 'ethereum' },
        sourceKey: 'ethereum_rpc',
        sourceUrl: 'https://etherscan.io',
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: {
          metric: 'network',
          chain: 'ethereum',
          chainLabel: 'Ethereum',
          symbol: 'ETH',
          height,
          gasPrice: gwei,
          feeUnit: 'gwei',
        },
      },
    ]
  },
}

// ── Solana (public JSON-RPC) ─────────────────────────────────────────────────
interface EpochInfo {
  absoluteSlot?: number
  blockHeight?: number
  epoch?: number
  slotIndex?: number
  slotsInEpoch?: number
}
interface PerfSample {
  numTransactions?: number
  samplePeriodSecs?: number
}

export const solanaChain: Source = {
  key: 'solana_rpc',
  capability: 'chain_state',
  passive: true,
  hosts: ['api.mainnet-beta.solana.com'],
  minIntervalMs: 1500,
  async run(_input: SourceInput, ctx: SourceContext) {
    const url = 'https://api.mainnet-beta.solana.com'
    const [epochRaw, perfRaw] = await Promise.all([
      rpc(ctx, url, 'getEpochInfo').catch(() => null),
      rpc(ctx, url, 'getRecentPerformanceSamples', [1]).catch(() => null),
    ])
    const epoch = (epochRaw ?? null) as EpochInfo | null
    const height = num(epoch?.blockHeight) ?? num(epoch?.absoluteSlot)
    if (height === null) return []

    // Throughput is a measurement, so compute it only from a real sample.
    const sample = Array.isArray(perfRaw) ? ((perfRaw[0] ?? null) as PerfSample | null) : null
    const period = num(sample?.samplePeriodSecs)
    const txs = num(sample?.numTransactions)
    const tps = period && period > 0 && txs !== null ? txs / period : null

    const slotIndex = num(epoch?.slotIndex)
    const slotsInEpoch = num(epoch?.slotsInEpoch)
    const epochProgress =
      slotIndex !== null && slotsInEpoch && slotsInEpoch > 0 ? slotIndex / slotsInEpoch : null

    return [
      {
        claim:
          `Solana at block ${height.toLocaleString('en-US')}` +
          (tps !== null ? `, ${Math.round(tps).toLocaleString('en-US')} tx/s` : ''),
        entity: { type: 'other', value: 'solana' },
        sourceKey: 'solana_rpc',
        sourceUrl: 'https://explorer.solana.com',
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: {
          metric: 'network',
          chain: 'solana',
          chainLabel: 'Solana',
          symbol: 'SOL',
          height,
          tps,
          epoch: num(epoch?.epoch),
          epochProgress,
        },
      },
    ]
  },
}

// ── Exchange venues, with the country each is registered in ──────────────────
// This is what turns the radar into something geographic: trading volume has a
// jurisdiction, and an operator asking "where is the liquidity" is asking a
// question the globe can answer. CoinGecko publishes the venue's country and its
// 24h volume in BTC; we pass both through and the module plots them.
interface CgExchange {
  id?: string
  name?: string
  country?: string | null
  year_established?: number | null
  trust_score?: number | null
  trust_score_rank?: number | null
  trade_volume_24h_btc?: number | null
  url?: string
}

export const exchangeVenues: Source = {
  key: 'coingecko_exchanges',
  capability: 'chain_state',
  passive: true,
  hosts: ['api.coingecko.com'],
  minIntervalMs: 2500,
  async run(_input: SourceInput, ctx: SourceContext) {
    const rows = await expectJson<CgExchange[] | null>(
      'coingecko_exchanges',
      await ctx.fetch('https://api.coingecko.com/api/v3/exchanges?per_page=100&page=1'),
    )
    if (!Array.isArray(rows)) return []
    return rows
      .filter((r) => r.name && num(r.trade_volume_24h_btc) !== null)
      .map<Evidence>((r) => ({
        claim: `${r.name}: ${Math.round(r.trade_volume_24h_btc as number).toLocaleString('en-US')} BTC traded in 24h`,
        entity: { type: 'organization', value: r.name! },
        sourceKey: 'coingecko_exchanges',
        sourceUrl: r.url,
        retrievedAt: new Date().toISOString(),
        // An aggregator's reading of venue-reported volume — reliable, derived.
        admiralty: { source: 'B', info: 3 },
        confidence: 'probable',
        data: {
          metric: 'venue',
          venueId: r.id ?? null,
          name: r.name,
          country: r.country ?? null,
          volumeBtc: num(r.trade_volume_24h_btc),
          trustScore: num(r.trust_score),
          trustRank: num(r.trust_score_rank),
          established: num(r.year_established),
        },
      }))
  },
}

export const multiChainSources: Source[] = [
  piNetworkChain,
  ethereumChain,
  solanaChain,
  exchangeVenues,
]
