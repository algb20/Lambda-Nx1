/**
 * Blockchain radar — what the chains are doing right now.
 *
 * Deliberately more than a price ticker. A price tells you what the market
 * thinks; congestion, chain tip and market structure tell you what the network
 * is actually doing, and those move for different reasons. The radar puts both
 * side by side: on-chain state from the network's own endpoints, and the biggest
 * movers from the markets board.
 *
 * Movers are computed from published 24h changes — we rank what was measured and
 * never extrapolate a trend from it.
 */
import { collect } from '../engine/orchestrator'
import { registerChainStateGateway, registerMarketsBoard } from '../engine/sources'
import type { Evidence } from '../engine/types'

export interface ChainFees {
  fastest: number
  halfHour: number | null
  hour: number | null
  economy: number | null
  unit: string
}

export interface ChainMover {
  symbol: string
  name: string
  price: number
  change: number
  sourceUrl: string | null
}

export interface ChainRadarReport {
  generatedAt: string
  network: {
    chain: 'bitcoin'
    tipHeight: number | null
    mempoolCount: number | null
    fees: ChainFees | null
    /** 0–1 congestion read, derived from the real next-block fee. */
    congestion: number | null
  } | null
  market: {
    totalMarketCapUsd: number
    totalVolumeUsd: number | null
    btcDominance: number | null
    ethDominance: number | null
    change24h: number | null
  } | null
  gainers: ChainMover[]
  losers: ChainMover[]
  findings: Evidence[]
  summary: { sourcesOk: number; sourcesFailed: number }
}

/**
 * Congestion from the next-block fee, on a log scale between a quiet chain
 * (1 sat/vB) and a badly congested one (300 sat/vB). Fees are the honest
 * congestion signal — the mempool count alone says nothing about what it costs
 * to get in.
 */
export function congestionFromFee(satPerVb: number): number {
  if (!Number.isFinite(satPerVb) || satPerVb <= 1) return 0
  const scaled = Math.log10(satPerVb) / Math.log10(300)
  return Number(Math.max(0, Math.min(1, scaled)).toFixed(3))
}

interface ChainData {
  metric?: string
  chain?: string
  height?: number
  count?: number
  fastest?: number
  halfHour?: number | null
  hour?: number | null
  economy?: number | null
  unit?: string
  totalMarketCapUsd?: number
  totalVolumeUsd?: number | null
  btcDominance?: number | null
  ethDominance?: number | null
  change24h?: number | null
}

interface BoardData {
  class?: string
  symbol?: string
  name?: string
  price?: number
  change?: number | null
  sourceUrl?: string
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

export async function chainRadar(): Promise<ChainRadarReport> {
  registerChainStateGateway()
  registerMarketsBoard()

  const [state, board] = await Promise.all([
    collect({ capability: 'chain_state', value: '' }, { mode: 'all' }),
    collect({ capability: 'market_board', value: '' }, { mode: 'all' }),
  ])

  let network: ChainRadarReport['network'] = null
  let market: ChainRadarReport['market'] = null

  for (const e of state.evidence) {
    const d = (e.data ?? {}) as ChainData
    if (d.metric === 'market') {
      const cap = num(d.totalMarketCapUsd)
      if (cap !== null) {
        market = {
          totalMarketCapUsd: cap,
          totalVolumeUsd: num(d.totalVolumeUsd),
          btcDominance: num(d.btcDominance),
          ethDominance: num(d.ethDominance),
          change24h: num(d.change24h),
        }
      }
      continue
    }
    if (d.chain !== 'bitcoin') continue
    network ??= { chain: 'bitcoin', tipHeight: null, mempoolCount: null, fees: null, congestion: null }
    if (d.metric === 'tip') network.tipHeight = num(d.height)
    if (d.metric === 'mempool') network.mempoolCount = num(d.count)
    if (d.metric === 'fees') {
      const fastest = num(d.fastest)
      if (fastest !== null) {
        network.fees = {
          fastest,
          halfHour: num(d.halfHour),
          hour: num(d.hour),
          economy: num(d.economy),
          unit: d.unit ?? 'sat/vB',
        }
        network.congestion = congestionFromFee(fastest)
      }
    }
  }

  const movers: ChainMover[] = []
  for (const e of board.evidence) {
    const d = (e.data ?? {}) as BoardData
    if (d.class !== 'crypto') continue
    const price = num(d.price)
    const change = num(d.change)
    if (price === null || change === null || !d.symbol) continue
    movers.push({
      symbol: d.symbol,
      name: d.name ?? d.symbol,
      price,
      change,
      sourceUrl: d.sourceUrl ?? e.sourceUrl ?? null,
    })
  }
  const ranked = [...movers].sort((a, b) => b.change - a.change)

  return {
    generatedAt: new Date().toISOString(),
    network,
    market,
    // Only genuine moves in each direction — a "top loser" that actually rose is
    // filler, and padding the list to a fixed length would produce exactly that.
    gainers: ranked.filter((m) => m.change > 0).slice(0, 5),
    losers: ranked
      .filter((m) => m.change < 0)
      .slice(-5)
      .reverse(),
    findings: [...state.evidence, ...board.evidence],
    summary: {
      sourcesOk: [...state.results, ...board.results].filter((r) => r.ok).length,
      sourcesFailed: [...state.results, ...board.results].filter((r) => !r.ok).length,
    },
  }
}
