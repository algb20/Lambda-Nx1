/**
 * Live world events — the analysis layer behind the world surface.
 *
 * The globe used to be a decoration: a sphere with a graticule and a handful of
 * dots taken from whichever headlines happened to name a country. This module
 * makes it an operations picture. It composes two capabilities:
 *
 *  - `world_events` — measured events with a coordinate (NASA EONET hazards,
 *    USGS seismic). These are instrument or agency observations.
 *  - `news` — reported events (Wikipedia ITN, ReliefWeb, USGS significant).
 *    These carry a country at best, and often no location at all.
 *
 * and produces one graded, deduplicated, ranked picture. Three rules keep it
 * honest, and they are the whole point of the module:
 *
 *  1. **Severity is never invented.** It is derived only where a real measure
 *     exists (earthquake magnitude, fire area, a tsunami flag). Everything else
 *     scores zero and simply does not pulse on the map.
 *  2. **Unplaceable events are shown, not dropped.** A real event with no
 *     coordinate is listed beside the map rather than silently discarded or,
 *     worse, plotted at a guessed location.
 *  3. **Every event keeps its source link, timestamp and Admiralty rating**, so
 *     any dot on the map can be audited back to the agency that measured it.
 */
import { collect } from '../engine/orchestrator'
import {
  registerCatalogSources,
  registerNewsGateway,
  registerWorldEventsGateway,
} from '../engine/sources'
import type { Evidence } from '../engine/types'
import { countryAt, findCountry } from '../geo/atlas'
import { fuseEvents, fusionSummary, type Signal } from '../analysis/fusion'
import { coverageMap, coverageSummary } from '../analysis/blindspots'
import { activeSources } from '../engine/catalog'
import {
  CATEGORY_META,
  REGION_LABEL,
  dedupeEvents,
  operationalOrder,
  regionOf,
  severityOf,
  type EventCategory,
  type Region,
  type SourceHealth,
  type WorldEvent,
  type WorldEventsReport,
} from './world-events-shared'

/** Worst first, so the states an operator must act on sort to the top. */
const STATUS_ORDER = { failed: 0, empty: 1, ok: 2 } as const

// Re-exported so existing importers keep one obvious entry point.
export * from './world-events-shared'

interface RawData {
  lat?: unknown
  lon?: unknown
  country?: unknown
  place?: unknown
  category?: unknown
  categoryLabel?: unknown
  magnitude?: unknown
  magnitudeUnit?: unknown
  tsunami?: unknown
  kind?: unknown
  assignedSeverity?: unknown
  alertLevel?: unknown
  observedAt?: unknown
  independence?: unknown
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/** Map a source's evidence onto our event shape without inventing anything. */
function toEvent(e: Evidence, index: number): WorldEvent | null {
  const title = e.claim?.trim()
  if (!title) return null
  const data = (e.data ?? {}) as RawData

  const rawCategory = str(data.category)
  const category: EventCategory =
    rawCategory && rawCategory in CATEGORY_META
      ? (rawCategory as EventCategory)
      : e.sourceKey === 'reliefweb'
        ? 'humanitarian'
        : 'world'

  const lat = num(data.lat)
  const lon = num(data.lon)
  const plottable =
    lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null

  // Resolve the country from the coordinate when we have one (authoritative),
  // and from the source's own country tag otherwise.
  const shape = plottable
    ? countryAt(plottable.lat, plottable.lon)
    : str(data.country)
      ? findCountry(str(data.country)!)
      : null

  const magnitude = num(data.magnitude)
  const unit = str(data.magnitudeUnit)

  // An official alert level is a severity a responsible agency assigned. It
  // outranks anything we could derive, and it is the only severity available for
  // hazards that have no numeric magnitude at all.
  const assigned = num(data.assignedSeverity)
  const severity =
    assigned !== null && assigned > 0
      ? assigned
      : severityOf(category, magnitude, unit, data.tsunami === true)

  return {
    id: `${e.sourceKey}:${index}:${title.slice(0, 60)}`,
    title,
    category,
    categoryLabel: str(data.categoryLabel) ?? CATEGORY_META[category].label,
    color: CATEGORY_META[category].color,
    lat: plottable?.lat ?? null,
    lon: plottable?.lon ?? null,
    country: shape?.name ?? str(data.country),
    countryIso: shape?.iso || null,
    magnitude,
    magnitudeUnit: unit,
    severity,
    alertLevel: str(data.alertLevel),
    at: e.retrievedAt,
    // Never defaulted to the retrieval time: a feed that published no date
    // yields an event we cannot age, and saying so is the honest answer.
    observedAt: str(data.observedAt),
    sourceKey: e.sourceKey,
    sourceUrl: e.sourceUrl ?? null,
    independence: str(data.independence),
    admiralty: e.admiralty ?? null,
    confidence: e.confidence,
  }
}

/**
 * A world event as a fusion signal.
 *
 * The independence group is what fusion counts, and it travels on the evidence
 * from the catalogue record. Falling back to the source key is correct rather
 * than lossy: a source that declares no group **is** its own group.
 */
function toSignal(event: WorldEvent): Signal {
  return {
    id: event.id,
    title: event.title,
    independence: event.independence ?? event.sourceKey,
    sourceKey: event.sourceKey,
    sourceUrl: event.sourceUrl,
    admiralty: event.admiralty,
    lat: event.lat,
    lon: event.lon,
    observedAt: event.observedAt ?? null,
    receivedAt: event.at,
    magnitude: event.magnitude,
    topic: event.category,
  }
}

/** Build the live picture. Returns whatever the reachable sources gave us. */
export async function getWorldEvents(): Promise<WorldEventsReport> {
  registerWorldEventsGateway()
  registerNewsGateway()
  // The declarative catalogue: dozens of official hazard, health and advisory
  // feeds that would otherwise each need a module of their own.
  registerCatalogSources()

  // Two capabilities, run concurrently: a slow news provider must not delay the
  // measured-events layer that the map mainly depends on.
  const [measured, reported] = await Promise.all([
    collect({ capability: 'world_events', value: '' }, { mode: 'all' }),
    collect({ capability: 'news', value: '' }, { mode: 'all' }),
  ])

  const results = [...measured.results, ...reported.results]
  const all = [...measured.evidence, ...reported.evidence]
    .map(toEvent)
    .filter((e): e is WorldEvent => e !== null)

  /**
   * Fusion, then deduplication.
   *
   * `dedupeEvents` removes byte-identical repeats — the same feed read twice.
   * Fusion does the harder thing: it recognises that a USGS solution, an EMSC
   * solution and three wire stories describe **one** earthquake, and presents
   * them as one event carrying five pieces of evidence.
   *
   * The order matters. Fusing first would waste work on exact duplicates;
   * deduplicating first leaves fusion the real question — which distinct
   * reports are the same event.
   */
  const deduped = dedupeEvents(all)
  const fused = fuseEvents(deduped.map(toSignal))
  const fusion = fusionSummary(deduped.map(toSignal), fused)

  /**
   * Where we cannot see.
   *
   * Built from the catalogue's declared coverage and this run's observations
   * together, because neither alone is enough: declared coverage would call a
   * region covered while every source in it silently failed, and observed
   * coverage could not tell a quiet hour from a permanent hole.
   */
  const coverage = coverageMap(
    activeSources(),
    deduped.map((e) => ({
      lat: e.lat,
      lon: e.lon,
      independence: e.independence,
      sourceKey: e.sourceKey,
    })),
  )
  const events = deduped.filter((e) => e.lat !== null && e.lon !== null).sort(operationalOrder)
  const unplaceable = deduped.filter((e) => e.lat === null || e.lon === null).sort(operationalOrder)

  const counts = new Map<EventCategory, number>()
  for (const e of deduped) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
  const categories = [...counts.entries()]
    .map(([category, count]) => ({
      category,
      label: CATEGORY_META[category].label,
      color: CATEGORY_META[category].color,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  const byCountry = new Map<string, { country: string; iso: string; count: number }>()
  for (const e of deduped) {
    if (!e.country) continue
    const key = e.countryIso || e.country
    const existing = byCountry.get(key)
    if (existing) existing.count += 1
    else byCountry.set(key, { country: e.country, iso: e.countryIso ?? '', count: 1 })
  }
  const hotspots = [...byCountry.values()]
    .map((c) => {
      const shape = findCountry(c.iso || c.country)
      return shape ? { ...c, lat: shape.centroid.lat, lon: shape.centroid.lon } : null
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const regionCounts = new Map<Region, number>()
  for (const e of events) {
    const r = regionOf(e.lat as number, e.lon as number)
    regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1)
  }
  const regions = [...regionCounts.entries()]
    .map(([region, count]) => ({ region, label: REGION_LABEL[region], count }))
    .sort((a, b) => b.count - a.count)

  // Per-source health. A board that quietly loses a feed is worse than one that
  // says it lost it — an operator has to know the map is incomplete.
  //
  // The count is what makes this honest. `r.ok` only means the adapter did not
  // throw, so a provider answering 200 with an empty result set used to report
  // green while contributing nothing: the globe drew a bare sphere with every
  // source healthy and no explanation on screen. Answering and contributing are
  // different facts and are now reported as different states.
  const contributed = new Map<string, number>()
  for (const r of results) contributed.set(r.sourceKey, 0)
  for (const e of [...events, ...unplaceable]) {
    contributed.set(e.sourceKey, (contributed.get(e.sourceKey) ?? 0) + 1)
  }
  const sourceHealth: SourceHealth[] = results
    .map((r) => {
      const count = contributed.get(r.sourceKey) ?? 0
      return {
        sourceKey: r.sourceKey,
        status: !r.ok ? ('failed' as const) : count > 0 ? ('ok' as const) : ('empty' as const),
        count,
        error: r.error ?? null,
        ok: r.ok,
      }
    })
    // Worst first: failures need attention, then the quiet feeds, then the
    // healthy ones nobody has to look at.
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.sourceKey.localeCompare(b.sourceKey),
    )

  const newestAt = deduped.reduce<string | null>((newest, e) => {
    const t = Date.parse(e.at)
    if (!Number.isFinite(t)) return newest
    return !newest || t > Date.parse(newest) ? e.at : newest
  }, null)

  return {
    generatedAt: new Date().toISOString(),
    events,
    unplaceable,
    categories,
    regions,
    hotspots,
    sourceHealth,
    /**
     * The fused picture: distinct events rather than distinct reports.
     *
     * Reported alongside the raw events rather than replacing them, because a
     * reader auditing a claim needs the individual reports, and an operator
     * reading the map needs the events. Both are true; they answer different
     * questions.
     */
    fused,
    fusion,
    coverage,
    coverageSummary: coverageSummary(coverage),
    summary: {
      total: deduped.length,
      placed: events.length,
      /** The most recent event we hold — the honest answer to "is this live?". */
      newestAt,
      sources: results.map((r) => r.sourceKey),
      // Counted from the graded health, so "ok" means contributed — not merely
      // "did not throw". A summary that counts empty feeds as healthy is how an
      // empty map ends up reporting that everything is fine.
      sourcesOk: sourceHealth.filter((s) => s.status === 'ok').length,
      sourcesEmpty: sourceHealth.filter((s) => s.status === 'empty').length,
      sourcesFailed: sourceHealth.filter((s) => s.status === 'failed').length,
    },
  }
}
