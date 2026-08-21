/**
 * Blockchain radar — what the *networks* are doing, not only what their prices
 * are doing.
 *
 * The first version was a Bitcoin dashboard wearing a radar's name. This one
 * reads every chain from its own node — Pi Network's Horizon, Ethereum and
 * Solana JSON-RPC, Bitcoin's mempool — normalises them into one comparable
 * shape, and adds the layer a price feed can never give: **where the liquidity
 * physically sits**, by mapping each trading venue's registered country onto the
 * globe.
 *
 * What it deliberately does not claim: who is buying and who is selling. No
 * public, keyless feed identifies counterparties, and inventing that would be
 * the exact fabrication this project forbids. What it *can* honestly show is
 * where volume concentrates, how it is distributed across venues and
 * jurisdictions, and how congested each chain is — which is the answerable form
 * of the same question.
 */
import { collect } from '../engine/orchestrator'
import { registerChainStateGateway, registerMarketsBoard } from '../engine/sources'
import { findCountry } from '../geo/atlas'
import type { Evidence } from '../engine/types'

export interface ChainFees {
  fastest: number
  halfHour: number | null
  hour: number | null
  economy: number | null
  unit: string
}

/** One network's live state, normalised across very different chains. */
export interface ChainNetwork {
  chain: string
  label: string
  symbol: string
  /** Block, ledger or slot height — whatever "how far along" means on that chain. */
  height: number | null
  /** Current cost of transacting, in that chain's own unit. */
  fee: number | null
  feeUnit: string | null
  /** 0–1 congestion, only where the chain exposes something that means it. */
  congestion: number | null
  /** Measured transactions per second, where the chain publishes it. */
  tps: number | null
  /** Coins in existence, where the chain reports it (Pi does). */
  totalSupply: number | null
  /** Pending transactions, where the chain has a mempool concept. */
  pending: number | null
  extra: Record<string, number | string | null>
  sourceKey: string
  sourceUrl: string | null
  at: string
}

export interface ChainMover {
  symbol: string
  name: string
  price: number
  change: number
  sourceUrl: string | null
}

/** A trading venue, with the jurisdiction it is registered in. */
export interface Venue {
  name: string
  country: string | null
  countryIso: string | null
  lat: number | null
  lon: number | null
  volumeBtc: number
  /** Share of the total measured volume across all venues, 0–1. */
  share: number
  trustScore: number | null
  sourceUrl: string | null
}

/** Volume concentrated by jurisdiction — the globe layer. */
export interface VenueCountry {
  country: string
  iso: string
  lat: number
  lon: number
  volumeBtc: number
  venues: number
  share: number
}

/**
 * A rate an institution sets or publishes: a yield, a policy rate.
 *
 * `change` is against the previous published observation, and is null when
 * there is only one — a rate that is not moving and a rate we cannot tell is
 * moving must not look the same.
 */
export interface RateReading {
  kind: 'yield' | 'policy'
  label: string
  tenor: string | null
  value: number
  unit: string
  change: number | null
  observedOn: string
  sourceKey: string
  sourceUrl: string | null
}

/** One currency against the US dollar, at the ECB's daily reference fixing. */
export interface FxReading {
  base: string
  quote: string
  value: number
  observedOn: string
  sourceKey: string
  sourceUrl: string | null
}

export interface ChainRadarReport {
  generatedAt: string
  networks: ChainNetwork[]
  /** Sovereign yields and the policy rate they sit above. */
  rates: RateReading[]
  /** Reference exchange rates, per US dollar. */
  fx: FxReading[]
  market: {
    totalMarketCapUsd: number
    totalVolumeUsd: number | null
    btcDominance: number | null
    ethDominance: number | null
    change24h: number | null
  } | null
  gainers: ChainMover[]
  losers: ChainMover[]
  venues: Venue[]
  venueCountries: VenueCountry[]
  /** 0–1 Herfindahl concentration of volume across venues. 1 = one venue holds all. */
  venueConcentration: number | null
  findings: Evidence[]
  summary: {
    chains: number
    venuesCounted: number
    sourcesOk: number
    sourcesFailed: number
  }
}

/**
 * Congestion from Bitcoin's next-block fee, on a log scale between a quiet chain
 * (1 sat/vB) and a badly congested one (300 sat/vB). Fees are the honest
 * congestion signal — a mempool count alone says nothing about what it costs to
 * get in.
 */
export function congestionFromFee(satPerVb: number): number {
  if (!Number.isFinite(satPerVb) || satPerVb <= 1) return 0
  const scaled = Math.log10(satPerVb) / Math.log10(300)
  return Number(Math.max(0, Math.min(1, scaled)).toFixed(3))
}

/**
 * Ethereum congestion from the gas price, on the same idea: 5 gwei is calm and
 * 300 gwei is a fee market in crisis. A separate scale from Bitcoin's on purpose
 * — the two units are not comparable, and pretending otherwise would make the
 * two bars lie about each other.
 */
export function congestionFromGwei(gwei: number): number {
  if (!Number.isFinite(gwei) || gwei <= 5) return 0
  const scaled = Math.log10(gwei / 5) / Math.log10(60)
  return Number(Math.max(0, Math.min(1, scaled)).toFixed(3))
}

/**
 * Herfindahl–Hirschman concentration over venue shares, normalised to 0–1.
 * A high number means the world's crypto trading runs through very few venues,
 * which is a real systemic-risk reading rather than a decorative statistic.
 */
export function concentration(shares: number[]): number | null {
  const valid = shares.filter((s) => Number.isFinite(s) && s > 0)
  if (valid.length === 0) return null
  if (valid.length === 1) return 1
  const total = valid.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  const hhi = valid.reduce((sum, s) => sum + (s / total) ** 2, 0)
  // Rescale so that a perfectly even split reads as 0 rather than 1/n.
  const floor = 1 / valid.length
  return Number(Math.max(0, Math.min(1, (hhi - floor) / (1 - floor))).toFixed(3))
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null
const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

interface ChainData {
  metric?: string
  chain?: string
  chainLabel?: string
  symbol?: string
  height?: number
  count?: number
  fastest?: number
  halfHour?: number | null
  hour?: number | null
  economy?: number | null
  unit?: string
  feeUnit?: string
  gasPrice?: number
  tps?: number
  epoch?: number
  epochProgress?: number
  totalSupply?: number
  feePool?: number
  operations?: number
  transactions?: number
  closedAt?: string
  totalMarketCapUsd?: number
  totalVolumeUsd?: number | null
  btcDominance?: number | null
  ethDominance?: number | null
  change24h?: number | null
  // venue
  name?: string
  country?: string | null
  volumeBtc?: number
  trustScore?: number | null
}

/** Bitcoin arrives as three separate readings; fold them into one network. */
function foldBitcoin(evidence: Evidence[]): ChainNetwork | null {
  let height: number | null = null
  let pending: number | null = null
  let fee: number | null = null
  let at = new Date().toISOString()
  let seen = false

  for (const e of evidence) {
    const d = (e.data ?? {}) as ChainData
    if (d.chain !== 'bitcoin') continue
    seen = true
    at = e.retrievedAt || at
    if (d.metric === 'tip') height = num(d.height)
    if (d.metric === 'mempool') pending = num(d.count)
    if (d.metric === 'fees') fee = num(d.fastest)
  }
  if (!seen) return null
  return {
    chain: 'bitcoin',
    label: 'Bitcoin',
    symbol: 'BTC',
    height,
    fee,
    feeUnit: fee !== null ? 'sat/vB' : null,
    congestion: fee !== null ? congestionFromFee(fee) : null,
    tps: null,
    totalSupply: null,
    pending,
    extra: {},
    sourceKey: 'mempool_network',
    sourceUrl: 'https://mempool.space',
    at,
  }
}

/** Every other chain reports itself in one evidence item. */
function toNetwork(e: Evidence): ChainNetwork | null {
  const d = (e.data ?? {}) as ChainData
  if (d.metric !== 'network') return null
  const chain = str(d.chain)
  if (!chain) return null

  const gas = num(d.gasPrice)
  const fee = gas ?? null
  const extra: Record<string, number | string | null> = {}
  if (num(d.epoch) !== null) extra.epoch = num(d.epoch)
  if (num(d.epochProgress) !== null) extra.epochProgress = num(d.epochProgress)
  if (num(d.feePool) !== null) extra.feePool = num(d.feePool)
  if (num(d.operations) !== null) extra.operations = num(d.operations)
  if (num(d.transactions) !== null) extra.transactions = num(d.transactions)

  return {
    chain,
    label: str(d.chainLabel) ?? chain,
    symbol: str(d.symbol) ?? chain.toUpperCase().slice(0, 4),
    height: num(d.height),
    fee,
    feeUnit: fee !== null ? (str(d.feeUnit) ?? null) : null,
    congestion: chain === 'ethereum' && gas !== null ? congestionFromGwei(gas) : null,
    tps: num(d.tps),
    totalSupply: num(d.totalSupply),
    pending: null,
    extra,
    sourceKey: e.sourceKey,
    sourceUrl: e.sourceUrl ?? null,
    at: e.retrievedAt,
  }
}

/** Networks in a stable, meaningful order rather than whichever answered first. */
const CHAIN_ORDER = ['bitcoin', 'ethereum', 'pi', 'solana']
function chainRank(chain: string): number {
  const i = CHAIN_ORDER.indexOf(chain)
  return i === -1 ? CHAIN_ORDER.length : i
}

export async function chainRadar(): Promise<ChainRadarReport> {
  registerChainStateGateway()
  registerMarketsBoard()

  const [state, board] = await Promise.all([
    collect({ capability: 'chain_state', value: '' }, { mode: 'all' }),
    collect({ capability: 'market_board', value: '' }, { mode: 'all' }),
  ])

  // ── Networks ───────────────────────────────────────────────────────────────
  const networks: ChainNetwork[] = []
  const bitcoin = foldBitcoin(state.evidence)
  if (bitcoin) networks.push(bitcoin)
  for (const e of state.evidence) {
    const n = toNetwork(e)
    if (n) networks.push(n)
  }
  networks.sort((a, b) => chainRank(a.chain) - chainRank(b.chain))

  // ── Rates and currencies ───────────────────────────────────────────────────
  const rates: RateReading[] = []
  const fx: FxReading[] = []
  for (const e of state.evidence) {
    const d = (e.data ?? {}) as Record<string, unknown>
    if (d.metric === 'rate') {
      const value = num(d.value)
      if (value === null) continue
      rates.push({
        kind: d.kind === 'policy' ? 'policy' : 'yield',
        label: String(d.label ?? ''),
        tenor: typeof d.tenor === 'string' ? d.tenor : null,
        value,
        unit: String(d.unit ?? '%'),
        change: num(d.change),
        observedOn: String(d.observedOn ?? ''),
        sourceKey: e.sourceKey,
        sourceUrl: e.sourceUrl ?? null,
      })
    } else if (d.metric === 'fx') {
      const value = num(d.value)
      if (value === null) continue
      fx.push({
        base: String(d.base ?? 'USD'),
        quote: String(d.quote ?? ''),
        value,
        observedOn: String(d.observedOn ?? ''),
        sourceKey: e.sourceKey,
        sourceUrl: e.sourceUrl ?? null,
      })
    }
  }
  /**
   * The policy rate leads, then the curve short-to-long. That is the order the
   * numbers mean something in: the floor first, then how much more the market
   * charges as the horizon lengthens.
   */
  const TENOR_ORDER = ['2Y', '5Y', '10Y']
  rates.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'policy' ? -1 : 1
    return TENOR_ORDER.indexOf(a.tenor ?? '') - TENOR_ORDER.indexOf(b.tenor ?? '')
  })
  fx.sort((a, b) => a.quote.localeCompare(b.quote))

  // ── Market structure ───────────────────────────────────────────────────────
  let market: ChainRadarReport['market'] = null
  for (const e of state.evidence) {
    const d = (e.data ?? {}) as ChainData
    if (d.metric !== 'market') continue
    const cap = num(d.totalMarketCapUsd)
    if (cap === null) continue
    market = {
      totalMarketCapUsd: cap,
      totalVolumeUsd: num(d.totalVolumeUsd),
      btcDominance: num(d.btcDominance),
      ethDominance: num(d.ethDominance),
      change24h: num(d.change24h),
    }
  }

  // ── Venues, and where they are ─────────────────────────────────────────────
  const rawVenues: Array<{
    name: string
    country: string | null
    volumeBtc: number
    trustScore: number | null
    sourceUrl: string | null
  }> = []
  for (const e of state.evidence) {
    const d = (e.data ?? {}) as ChainData
    if (d.metric !== 'venue') continue
    const volume = num(d.volumeBtc)
    const name = str(d.name)
    if (!name || volume === null || volume <= 0) continue
    rawVenues.push({
      name,
      country: str(d.country),
      volumeBtc: volume,
      trustScore: num(d.trustScore),
      sourceUrl: e.sourceUrl ?? null,
    })
  }
  const totalVolume = rawVenues.reduce((sum, v) => sum + v.volumeBtc, 0)

  const venues: Venue[] = rawVenues
    .map((v) => {
      const shape = v.country ? findCountry(v.country) : null
      return {
        name: v.name,
        country: shape?.name ?? v.country,
        countryIso: shape?.iso || null,
        lat: shape?.centroid.lat ?? null,
        lon: shape?.centroid.lon ?? null,
        volumeBtc: v.volumeBtc,
        share: totalVolume > 0 ? v.volumeBtc / totalVolume : 0,
        trustScore: v.trustScore,
        sourceUrl: v.sourceUrl,
      }
    })
    .sort((a, b) => b.volumeBtc - a.volumeBtc)

  const byCountry = new Map<string, { country: string; iso: string; lat: number; lon: number; volumeBtc: number; venues: number }>()
  for (const v of venues) {
    if (v.lat === null || v.lon === null || !v.country) continue
    const key = v.countryIso || v.country
    const existing = byCountry.get(key)
    if (existing) {
      existing.volumeBtc += v.volumeBtc
      existing.venues += 1
    } else {
      byCountry.set(key, {
        country: v.country,
        iso: v.countryIso ?? '',
        lat: v.lat,
        lon: v.lon,
        volumeBtc: v.volumeBtc,
        venues: 1,
      })
    }
  }
  const venueCountries: VenueCountry[] = [...byCountry.values()]
    .map((c) => ({ ...c, share: totalVolume > 0 ? c.volumeBtc / totalVolume : 0 }))
    .sort((a, b) => b.volumeBtc - a.volumeBtc)

  // ── Movers ─────────────────────────────────────────────────────────────────
  const movers: ChainMover[] = []
  for (const e of board.evidence) {
    const d = (e.data ?? {}) as ChainData & { class?: string; price?: number; change?: number | null }
    if (d.class !== 'crypto') continue
    const price = num(d.price)
    const change = num(d.change)
    const symbol = str((d as { symbol?: string }).symbol)
    if (price === null || change === null || !symbol) continue
    movers.push({
      symbol,
      name: str(d.name) ?? symbol,
      price,
      change,
      sourceUrl: e.sourceUrl ?? null,
    })
  }
  const ranked = [...movers].sort((a, b) => b.change - a.change)

  const results = [...state.results, ...board.results]
  return {
    generatedAt: new Date().toISOString(),
    networks,
    rates,
    fx,
    market,
    // Only genuine moves in each direction — padding to a fixed length would
    // produce a "top loser" that actually rose.
    gainers: ranked.filter((m) => m.change > 0).slice(0, 6),
    losers: ranked
      .filter((m) => m.change < 0)
      .slice(-6)
      .reverse(),
    venues: venues.slice(0, 25),
    venueCountries,
    venueConcentration: concentration(venues.map((v) => v.volumeBtc)),
    findings: [...state.evidence, ...board.evidence],
    summary: {
      chains: networks.length,
      venuesCounted: venues.length,
      sourcesOk: results.filter((r) => r.ok).length,
      sourcesFailed: results.filter((r) => !r.ok).length,
    },
  }
}
