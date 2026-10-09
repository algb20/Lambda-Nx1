import {
  fusedByEventId,
  rankEvents,
  type EventCategory,
  type FusedEventSummary,
  type RankedEvent,
  type WorldEvent,
  type WorldEventsReport,
} from '@/lib/modules/world-events-shared'

/**
 * What the Home dashboard (R338 reference design) shows, computed from one
 * world sweep. Pure, so every panel's number can be tested and explained.
 */

/** The reference design's eight map layers, as groups of real event categories. */
export type LayerGroup = 'physical' | 'human' | 'economic' | 'technology' | 'natural' | 'digital' | 'space' | 'intelligence'

export const LAYER_GROUPS: ReadonlyArray<{ id: LayerGroup; label: string; categories: readonly EventCategory[] }> = [
  { id: 'physical', label: 'Physical', categories: ['seismic', 'volcano', 'landslide', 'tsunami'] },
  { id: 'human', label: 'Human', categories: ['humanitarian', 'conflict', 'health'] },
  { id: 'economic', label: 'Economic', categories: ['economy', 'transport', 'energy'] },
  { id: 'technology', label: 'Technology', categories: ['research'] },
  { id: 'natural', label: 'Natural', categories: ['wildfire', 'storm', 'flood', 'drought', 'ice', 'dust', 'temperature', 'natural', 'water'] },
  { id: 'digital', label: 'Digital', categories: ['cyber', 'infrastructure'] },
  { id: 'space', label: 'Space', categories: ['space'] },
  { id: 'intelligence', label: 'Intelligence', categories: ['world', 'manmade'] },
]

const GROUP_OF = new Map<EventCategory, LayerGroup>(
  LAYER_GROUPS.flatMap((g) => g.categories.map((c) => [c, g.id] as const)),
)

export function layerGroupOf(category: EventCategory): LayerGroup {
  return GROUP_OF.get(category) ?? 'intelligence'
}

/** Events whose layer group is switched on. */
export function eventsInLayers(events: WorldEvent[], on: ReadonlySet<LayerGroup>): WorldEvent[] {
  return events.filter((e) => on.has(layerGroupOf(e.category)))
}

/**
 * "Intelligence health" as measured rates — each a fraction of something
 * counted, never a confidence. Null when there is nothing to divide by.
 */
export interface Health {
  /** Sources that answered with data or from a fresh cache, of all asked. */
  sourceHealth: number | null
  /** Sources that answered at all (with data or genuinely empty), of all asked. */
  reachability: number | null
  /** Regions trustworthy enough to read, of all declared regions. */
  coverage: number | null
  /** Fused events reported by two or more independent origins. */
  corroboration: number | null
  /** Events carrying the source's own time rather than our receipt time. */
  dated: number | null
  /** Headline figure: source health. */
  overall: number | null
}

const share = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null)

export function intelligenceHealth(report: WorldEventsReport): Health {
  const asked = report.sourceHealth.length
  const ok = report.sourceHealth.filter((s) => s.status === 'ok' || s.status === 'cached').length
  const answered = report.sourceHealth.filter((s) => s.status !== 'failed').length
  const sourceHealth = share(ok, asked)
  return {
    sourceHealth,
    reachability: share(answered, asked),
    coverage: share(report.coverageSummary.trustworthyRegions, report.coverageSummary.totalRegions),
    corroboration: share(report.fusion.corroborated, report.fusion.events),
    dated: share(report.summary.total - report.summary.untimed, report.summary.total),
    overall: sourceHealth,
  }
}

/** The ranked feed, newest-significant first. */
export function latestIntelligence(report: WorldEventsReport, n: number, now = Date.now()): RankedEvent[] {
  const fused = fusedByEventId(report.fused)
  return rankEvents(report.events.concat(report.unplaceable), { now, fused }).slice(0, n)
}

/** Situations: real-world events seen by two or more independent origins first. */
export function activeSituations(report: WorldEventsReport, n: number): FusedEventSummary[] {
  return [...report.fused]
    .sort(
      (a, b) =>
        b.independentSources - a.independentSources ||
        b.signals.length - a.signals.length ||
        Date.parse(b.lastReceivedAt) - Date.parse(a.lastReceivedAt),
    )
    .slice(0, n)
}

/**
 * Events per UTC day in this sweep, oldest first — the sparkline behind the
 * active-situations card.
 *
 * Deliberately no day-over-day percentage. The sweep's sources keep different
 * look-back windows (a week of earthquakes, a day of airport notices), so the
 * older days are under-counted by construction: measured on 2026-10-09 the
 * last full day read "+250%" against the one before, which describes the
 * windows, not the world. The line is labelled as reports per day in the sweep.
 */
export function dailyTotals(report: WorldEventsReport): number[] {
  return report.timeline.days.map((d) => d.total)
}
