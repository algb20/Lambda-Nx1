/**
 * Markets Board — a live, organized overview of the strongest markets across
 * classes: top crypto, commodities / raw materials, major stock indices, and key
 * FX. Built from passive, keyless public data (CoinGecko, Stooq, ECB). It reports
 * quotes as published; it never predicts. The AI analyst can triage the board.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerMarketsBoard } from '../engine/sources'
import type { Evidence } from '../engine/types'

export type BoardClass = 'crypto' | 'commodities' | 'indices' | 'fx'

export interface BoardRow {
  symbol: string
  name: string
  price: number
  change: number | null
  unit: string
  sourceKey: string
  sourceUrl?: string
}

export interface BoardSection {
  key: BoardClass
  title: string
  rows: BoardRow[]
}

export interface MarketsBoardReport {
  generatedAt: string
  sections: BoardSection[]
  findings: Evidence[]
  summary: { instruments: number; sourcesOk: number; sourcesFailed: number }
}

const SECTION_ORDER: Array<{ key: BoardClass; title: string }> = [
  { key: 'indices', title: 'Stock indices' },
  { key: 'commodities', title: 'Commodities & raw materials' },
  { key: 'crypto', title: 'Cryptocurrencies' },
  { key: 'fx', title: 'Currencies (FX)' },
]

interface RowData {
  class?: BoardClass
  symbol?: string
  name?: string
  price?: number
  change?: number | null
  unit?: string
  sourceUrl?: string
}

export async function marketsBoard(): Promise<MarketsBoardReport> {
  registerMarketsBoard()
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'market_board', value: '' }, { registry, mode: 'all' })

  const byClass = new Map<BoardClass, BoardRow[]>()
  for (const e of r.evidence) {
    const d = (e.data ?? {}) as RowData
    if (!d.class || typeof d.price !== 'number' || !d.symbol) continue
    const row: BoardRow = {
      symbol: d.symbol,
      name: d.name ?? d.symbol,
      price: d.price,
      change: typeof d.change === 'number' ? d.change : null,
      unit: d.unit ?? 'USD',
      sourceKey: e.sourceKey,
      sourceUrl: d.sourceUrl ?? e.sourceUrl,
    }
    const list = byClass.get(d.class) ?? []
    list.push(row)
    byClass.set(d.class, list)
  }

  const sections: BoardSection[] = SECTION_ORDER.map(({ key, title }) => ({
    key,
    title,
    rows: byClass.get(key) ?? [],
  })).filter((s) => s.rows.length > 0)

  const instruments = sections.reduce((n, s) => n + s.rows.length, 0)
  return {
    generatedAt,
    sections,
    findings: r.evidence,
    summary: {
      instruments,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}
