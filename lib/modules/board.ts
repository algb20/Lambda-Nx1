/**
 * One module for seven gateways.
 *
 * ## Why generic
 *
 * Courts, regulation, officials, resources, the power grid, space weather and
 * orbital objects are not the same subject, but they are the same *shape*: a
 * publisher issues records, the records fall into groups, and a reader wants
 * the groups laid out with the newest or largest first. Written seven times,
 * that is seven places for the same off-by-one — and the seventh would be
 * written six months after the first, by which point the six do not agree.
 *
 * So the shape lives here once, and a gateway is a source plus a catalogue row.
 *
 * ## Grouping and spotlight, which is the point of the shape
 *
 * Every board returns its rows already grouped, and every group is
 * independently selectable. That is what makes "put the earthquakes and the
 * floods together, and let me watch two of the ten" a property of the data
 * rather than a feature bolted onto one screen: any board, any gateway, same
 * gesture. `groups` carries the full list with counts so the interface can
 * offer the choice without first reading every row.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerBoards } from '../engine/sources'
import type { Capability, Evidence } from '../engine/types'

export interface BoardRow {
  group: string
  headline: string
  detail?: string
  value?: number
  unit?: string
  at: string | null
  url?: string
  sourceKey: string
}

export interface BoardGroup {
  name: string
  rows: BoardRow[]
}

export interface BoardReport {
  generatedAt: string
  /** The gateway this is, so one renderer can label many boards. */
  board: string
  subject: string
  groups: BoardGroup[]
  findings: Evidence[]
  summary: {
    rows: number
    groups: number
    sourcesOk: number
    sourcesFailed: number
    /** The newest publisher timestamp on the board, or null if none stated one. */
    newestAt: string | null
  }
}

interface RowData {
  group?: string
  headline?: string
  detail?: string
  value?: number
  unit?: string
  at?: string | null
  url?: string
  weight?: number
}

/**
 * Build a board.
 *
 * `capability` selects the sources; everything else is derived from what they
 * returned. Nothing here knows what a settlement period or a K index is, which
 * is the property that lets the eighth gateway be a source and a row.
 */
export async function boardReport(
  board: string,
  capability: Capability,
  subject = '',
): Promise<BoardReport> {
  registerBoards()
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability, value: subject.trim() }, { registry, mode: 'all' })

  const byGroup = new Map<string, Array<BoardRow & { weight: number }>>()
  let newestAt: string | null = null

  for (const e of r.evidence) {
    const d = (e.data ?? {}) as RowData
    if (!d.group || !d.headline) continue
    const row = {
      group: d.group,
      headline: d.headline,
      detail: d.detail,
      value: d.value,
      unit: d.unit,
      at: e.publishedAt ?? d.at ?? null,
      url: d.url ?? e.sourceUrl,
      sourceKey: e.sourceKey,
      weight: typeof d.weight === 'number' ? d.weight : 0,
    }
    if (row.at && (!newestAt || row.at > newestAt)) newestAt = row.at
    const list = byGroup.get(d.group)
    if (list) list.push(row)
    else byGroup.set(d.group, [row])
  }

  const groups: BoardGroup[] = [...byGroup.entries()]
    .map(([name, rows]) => ({
      name,
      rows: rows
        .sort(
          (a, b) =>
            // An explicit weight means the source knows an order that matters —
            // megawatts on a grid, storm severity. Otherwise newest first, and
            // an undated row sorts last rather than to the top, where an empty
            // string would otherwise put it.
            b.weight - a.weight || (b.at ?? '').localeCompare(a.at ?? ''),
        )
        .map(({ weight: _weight, ...row }) => row),
    }))
    // Bigger groups first: a group of one is a footnote, and making the reader
    // scroll past twelve of them to reach the substance is the arrangement
    // failure this platform keeps being told about.
    .sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name))

  return {
    generatedAt,
    board,
    subject: subject.trim(),
    groups,
    findings: r.evidence,
    summary: {
      rows: groups.reduce((n, g) => n + g.rows.length, 0),
      groups: groups.length,
      sourcesOk: r.results.filter((s) => s.ok).length,
      sourcesFailed: r.results.filter((s) => !s.ok).length,
      newestAt,
    },
  }
}

/**
 * The boards, as data.
 *
 * Each row is everything the platform needs to know about a gateway that reads
 * one publisher and groups what it returns: which capability to collect, what
 * to call it, and what it is for. Adding the eighth is adding a row here and a
 * source there — no route, no view, no branch.
 */
export interface BoardDefinition {
  /** Matches the `Mode` in lib/gateways.ts. */
  key: string
  capability: Capability
  title: string
  /** One line under the title: what this board is, from the reader's side. */
  note: string
  /** Whether typing a subject narrows it. False for boards with no search. */
  searchable: boolean
}

export const BOARDS: BoardDefinition[] = [
  {
    key: 'courts',
    capability: 'courts',
    title: 'Courts & litigation',
    note: 'American court opinions as filed, newest first, from the Free Law Project index. Search a party, a subject or a doctrine.',
    searchable: true,
  },
  {
    key: 'regulation',
    capability: 'regulation',
    title: 'Regulation & rulemaking',
    note: 'The US Federal Register — every proposed rule, final rule, notice and presidential document, on the day it publishes.',
    searchable: true,
  },
  {
    key: 'officials',
    capability: 'officials',
    title: 'Officials & statements',
    note: 'What central bank governors actually said, in their own words, collected by the BIS. Public acts of office — never private life.',
    searchable: true,
  },
  {
    key: 'resources',
    capability: 'resources',
    title: 'Resources & commodities',
    note: 'Metals, energy minerals and food, at the IMF price series that national budgets and mining investment are set against. Monthly, and dated as monthly.',
    searchable: false,
  },
  {
    key: 'grid',
    capability: 'power_grid',
    title: 'Power grid',
    note: 'Britain’s electricity, metered half-hourly by the body that settles the market — not an estimate of what the grid is doing, the figure it is paid on.',
    searchable: false,
  },
  {
    key: 'space-weather',
    capability: 'space_weather',
    title: 'Space weather',
    note: 'NOAA’s own scales and the planetary K index — the alerts airlines and grid operators act on. The one hazard that hits everybody at once.',
    searchable: false,
  },
  {
    key: 'orbital',
    capability: 'orbital',
    title: 'Orbital objects',
    note: 'What is overhead: crewed stations and the last thirty days of launches, from the tracking network’s own element sets.',
    searchable: true,
  },
]

export function boardByKey(key: string): BoardDefinition | undefined {
  return BOARDS.find((b) => b.key === key)
}
