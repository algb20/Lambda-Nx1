/**
 * Property & real estate — the module.
 *
 * Reads the three statistical authorities in `lib/engine/sources/property.ts`
 * and arranges what they published into four sections a reader can act on:
 * prices, market activity, the cost of borrowing, and supply.
 *
 * ## The one thing this gateway insists on
 *
 * **Every figure carries its period, and the report says how stale the freshest
 * one is.** Housing statistics are published with a lag measured in months —
 * the UK index runs about two months behind, Eurostat's quarterly index can be
 * a full quarter, and a reader who assumes "as of today" will be wrong about
 * the market by an entire cycle. Products that hide this are the reason people
 * argue about housing using numbers from different years without noticing.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerProperty } from '../engine/sources'
import type { Evidence } from '../engine/types'
import type { PropertyClass } from '../engine/sources/property'

export interface PropertyRow {
  region: string
  name: string
  value: number
  change: number | null
  unit: string
  period: string
  sourceKey: string
  sourceUrl?: string
}

export interface PropertySection {
  key: PropertyClass
  title: string
  /** What this section is for, in one line — the legend a reader needs. */
  note: string
  rows: PropertyRow[]
}

export interface PropertyReport {
  generatedAt: string
  sections: PropertySection[]
  findings: Evidence[]
  summary: {
    figures: number
    regions: number
    sourcesOk: number
    sourcesFailed: number
    /**
     * Days between the newest published period and now.
     *
     * The headline honesty measure of this gateway. Null when nothing parseable
     * came back at all — which is different from "up to date" and must not be
     * rendered as zero.
     */
    freshestLagDays: number | null
  }
}

const SECTIONS: Array<{ key: PropertyClass; title: string; note: string }> = [
  {
    key: 'price',
    title: 'Prices',
    note: 'What homes actually sold for, as the national statistical authority recorded it.',
  },
  {
    key: 'activity',
    title: 'Market activity',
    note: 'How much is being built and how much is changing hands.',
  },
  {
    key: 'finance',
    title: 'Cost of borrowing',
    note: 'The rate that decides what a buyer can afford — and therefore what prices do next.',
  },
  {
    key: 'supply',
    title: 'Supply & vacancy',
    note: 'How much unsold and unrented stock there is. The tightest leading signal here.',
  },
]

interface RowData {
  class?: PropertyClass
  region?: string
  name?: string
  value?: number
  change?: number | null
  unit?: string
  period?: string
  sourceUrl?: string
}

/**
 * A published period as a date.
 *
 * These arrive in three shapes — `2026-06-01` from FRED, `2026-06` from the
 * Land Registry, `2026-Q1` from Eurostat — and a quarter is mapped to its
 * *last* month, since Q1 data describes a period that ended in March rather
 * than one that began in January.
 */
export function periodEnd(period: string): Date | null {
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period)
  if (quarter) {
    const month = Number(quarter[2]) * 3 // Q1 → March, Q4 → December
    return new Date(Date.UTC(Number(quarter[1]), month, 0))
  }
  const month = /^(\d{4})-(\d{2})$/.exec(period)
  if (month) return new Date(Date.UTC(Number(month[1]), Number(month[2]), 0))
  const parsed = Date.parse(period)
  return Number.isFinite(parsed) ? new Date(parsed) : null
}

export async function propertyReport(now: () => number = Date.now): Promise<PropertyReport> {
  registerProperty()
  const generatedAt = new Date(now()).toISOString()

  const r = await collect({ capability: 'property', value: '' }, { registry, mode: 'all' })

  const byClass = new Map<PropertyClass, PropertyRow[]>()
  const regions = new Set<string>()
  let freshest: number | null = null

  for (const e of r.evidence) {
    const d = (e.data ?? {}) as RowData
    if (!d.class || typeof d.value !== 'number' || !d.region || !d.name) continue
    const row: PropertyRow = {
      region: d.region,
      name: d.name,
      value: d.value,
      change: typeof d.change === 'number' ? d.change : null,
      unit: d.unit ?? '',
      period: d.period ?? 'unknown',
      sourceKey: e.sourceKey,
      sourceUrl: d.sourceUrl ?? e.sourceUrl,
    }
    regions.add(d.region)
    const end = periodEnd(row.period)
    if (end) freshest = freshest === null ? end.getTime() : Math.max(freshest, end.getTime())
    const list = byClass.get(d.class)
    if (list) list.push(row)
    else byClass.set(d.class, [row])
  }

  const sections = SECTIONS.map((s) => ({
    ...s,
    // Largest economies read first within a section, then alphabetically — a
    // reader scanning European house prices wants the aggregate and the big
    // members at the top, not Cyprus because C sorts early.
    rows: (byClass.get(s.key) ?? []).sort(rankRegion),
  })).filter((s) => s.rows.length > 0)

  return {
    generatedAt,
    sections,
    findings: r.evidence,
    summary: {
      figures: sections.reduce((n, s) => n + s.rows.length, 0),
      regions: regions.size,
      sourcesOk: r.results.filter((s) => s.ok).length,
      sourcesFailed: r.results.filter((s) => !s.ok).length,
      freshestLagDays:
        freshest === null ? null : Math.max(0, Math.round((now() - freshest) / 86_400_000)),
    },
  }
}

/** Aggregates first, then the largest economies, then everything alphabetically. */
const REGION_RANK = [
  'European Union',
  'Euro area',
  'United States',
  'United Kingdom',
  'Germany',
  'France',
  'Italy',
  'Spain',
]

function rankRegion(a: PropertyRow, b: PropertyRow): number {
  const rank = (row: PropertyRow) => {
    const index = REGION_RANK.findIndex((name) => row.region.startsWith(name))
    return index === -1 ? REGION_RANK.length : index
  }
  const diff = rank(a) - rank(b)
  return diff !== 0 ? diff : a.region.localeCompare(b.region) || a.name.localeCompare(b.name)
}
