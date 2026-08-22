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
// The catalogue and the shapes live apart, because a client component that
// imported them from here would pull the orchestrator — and `node:crypto`
// through it — into the browser bundle and fail the build outright.
import { registry } from '../engine/registry'
import { registerBoards } from '../engine/sources'
import type { Capability } from '../engine/types'
import type { BoardGroup, BoardReport, BoardRow } from './board-shared'

// Re-exported so nothing downstream has to know there are two files. The rule
// is only that a `'use client'` component imports from `board-shared` directly.
export * from './board-shared'

interface RowData {
  group?: string
  headline?: string
  detail?: string
  value?: number
  unit?: string
  at?: string | null
  url?: string
  weight?: number
  groupWeight?: number
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
  /**
   * Which registry to read. The shared one in every real call; a test seam so
   * the arrangement rules below — grouping, ordering, the sort — can be
   * exercised against a known set of rows instead of against whatever eight
   * live publishers happen to be saying today.
   */
  sources = registry,
): Promise<BoardReport> {
  if (sources === registry) registerBoards()
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability, value: subject.trim() }, { registry: sources, mode: 'all' })

  const byGroup = new Map<string, Array<BoardRow & { weight: number }>>()
  /**
   * A source's own view of where its groups belong, when it has one.
   *
   * Size is the default proxy for importance and it is a good one — until a
   * board answers a specific question. Search the crypto gateway for one asset
   * and it returns seven rows about that asset beside seventy headlines about
   * the sector: ordering by size puts what was asked for below two walls of
   * what was not. A source that knows better may now say so, and every board
   * that does not is unaffected.
   */
  const groupWeights = new Map<string, number>()
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
    if (typeof d.groupWeight === 'number') {
      // The strongest claim any row makes about its group wins, so one
      // unweighted row cannot drag a group back down to the default.
      groupWeights.set(d.group, Math.max(groupWeights.get(d.group) ?? 0, d.groupWeight))
    }
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
    /**
     * A declared order wins; otherwise bigger groups first.
     *
     * A group of one is usually a footnote, and making the reader scroll past
     * twelve of them to reach the substance is the arrangement failure this
     * platform keeps being told about. But "usually" is doing work there — when
     * a source has said where a group belongs, it knows something size does
     * not, and every board that says nothing keeps exactly the old ordering.
     */
    .sort(
      (a, b) =>
        (groupWeights.get(b.name) ?? 0) - (groupWeights.get(a.name) ?? 0) ||
        b.rows.length - a.rows.length ||
        a.name.localeCompare(b.name),
    )

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
