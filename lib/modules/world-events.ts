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
import { registerNewsGateway, registerWorldEventsGateway } from '../engine/sources'
import type { Evidence } from '../engine/types'
import { countryAt, findCountry } from '../geo/atlas'
import {
  CATEGORY_META,
  REGION_LABEL,
  dedupeEvents,
  operationalOrder,
  regionOf,
  severityOf,
  type EventCategory,
  type Region,
  type WorldEvent,
  type WorldEventsReport,
} from './world-events-shared'

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
    sourceKey: e.sourceKey,
    sourceUrl: e.sourceUrl ?? null,
    admiralty: e.admiralty ?? null,
    confidence: e.confidence,
  }
}

/** Build the live picture. Returns whatever the reachable sources gave us. */
export async function getWorldEvents(): Promise<WorldEventsReport> {
  registerWorldEventsGateway()
  registerNewsGateway()

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

  const deduped = dedupeEvents(all)
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
  const sourceHealth = results
    .map((r) => ({ sourceKey: r.sourceKey, ok: r.ok, error: r.error ?? null }))
    .sort((a, b) => Number(a.ok) - Number(b.ok) || a.sourceKey.localeCompare(b.sourceKey))

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
    summary: {
      total: deduped.length,
      placed: events.length,
      /** The most recent event we hold — the honest answer to "is this live?". */
      newestAt,
      sources: results.map((r) => r.sourceKey),
      sourcesOk: results.filter((r) => r.ok).length,
      sourcesFailed: results.filter((r) => !r.ok).length,
    },
  }
}
