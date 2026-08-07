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
import type { Admiralty, Confidence, Evidence } from '../engine/types'
import { countryAt, findCountry } from '../geo/atlas'

export type EventCategory =
  | 'seismic'
  | 'wildfire'
  | 'storm'
  | 'volcano'
  | 'flood'
  | 'drought'
  | 'landslide'
  | 'ice'
  | 'dust'
  | 'temperature'
  | 'manmade'
  | 'water'
  | 'natural'
  | 'humanitarian'
  | 'world'

/**
 * One place for a category's label and colour, so the legend, the filter chips
 * and the dots on the canvas can never disagree about what red means.
 */
export const CATEGORY_META: Record<EventCategory, { label: string; color: string }> = {
  seismic: { label: 'Earthquake', color: '#f97316' },
  wildfire: { label: 'Wildfire', color: '#ef4444' },
  storm: { label: 'Severe storm', color: '#38bdf8' },
  volcano: { label: 'Volcano', color: '#e11d48' },
  flood: { label: 'Flood', color: '#3b82f6' },
  drought: { label: 'Drought', color: '#d97706' },
  landslide: { label: 'Landslide', color: '#a16207' },
  ice: { label: 'Ice & snow', color: '#a5f3fc' },
  dust: { label: 'Dust & haze', color: '#ca8a04' },
  temperature: { label: 'Temperature extreme', color: '#fb7185' },
  manmade: { label: 'Man-made', color: '#94a3b8' },
  water: { label: 'Water', color: '#22d3ee' },
  natural: { label: 'Natural event', color: '#34d399' },
  humanitarian: { label: 'Humanitarian', color: '#c084fc' },
  world: { label: 'World news', color: '#e2e8f0' },
}

export interface WorldEvent {
  id: string
  title: string
  category: EventCategory
  categoryLabel: string
  color: string
  lat: number | null
  lon: number | null
  country: string | null
  countryIso: string | null
  magnitude: number | null
  magnitudeUnit: string | null
  /** 0–1, derived only from a real measurement. 0 means "not measured". */
  severity: number
  at: string
  sourceKey: string
  sourceUrl: string | null
  admiralty: Admiralty | null
  confidence: Confidence
}

export interface WorldEventsReport {
  generatedAt: string
  /** Events with a coordinate — these are what the map draws. */
  events: WorldEvent[]
  /** Real events with no location. Listed, never plotted at a guess. */
  unplaceable: WorldEvent[]
  categories: Array<{ category: EventCategory; label: string; color: string; count: number }>
  /** Countries with the most activity right now. */
  hotspots: Array<{ country: string; iso: string; count: number; lat: number; lon: number }>
  summary: {
    total: number
    placed: number
    sources: string[]
    sourcesOk: number
    sourcesFailed: number
  }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * Severity from a real measurement, or zero.
 *
 * Earthquakes use moment magnitude on its own logarithmic scale: M2.5 is the
 * feed's floor and M7.5 saturates the display. Fires use burnt area, also
 * logarithmic, saturating around a million acres. A tsunami flag floors the
 * severity high regardless of magnitude, because that is what makes a quake
 * dangerous to people rather than to instruments.
 */
export function severityOf(
  category: EventCategory,
  magnitude: number | null,
  unit: string | null,
  tsunami = false,
): number {
  let severity = 0
  if (category === 'seismic' && typeof magnitude === 'number') {
    severity = clamp01((magnitude - 2.5) / 5)
  } else if (category === 'wildfire' && typeof magnitude === 'number' && magnitude > 0) {
    const acres = unit?.toLowerCase().includes('km') ? magnitude * 247.1 : magnitude
    severity = clamp01(Math.log10(acres + 1) / 6)
  }
  if (tsunami) severity = Math.max(severity, 0.9)
  return Number(severity.toFixed(3))
}

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
    severity: severityOf(category, magnitude, unit, data.tsunami === true),
    at: e.retrievedAt,
    sourceKey: e.sourceKey,
    sourceUrl: e.sourceUrl ?? null,
    admiralty: e.admiralty ?? null,
    confidence: e.confidence,
  }
}

/**
 * Collapse the same real-world event reported by more than one feed. Two events
 * match when they share a category and sit within ~1 km of each other, or when
 * their titles are identical. The survivor is the one with the stronger
 * Admiralty source rating — a sensor reading beats a headline about it.
 */
export function dedupeEvents(events: WorldEvent[]): WorldEvent[] {
  const rank = (e: WorldEvent) => (e.admiralty ? 'FEDCBA'.indexOf(e.admiralty.source) : -1)
  const byKey = new Map<string, WorldEvent>()
  for (const event of events) {
    const key =
      event.lat !== null && event.lon !== null
        ? `${event.category}@${event.lat.toFixed(2)},${event.lon.toFixed(2)}`
        : `title:${event.title.toLowerCase()}`
    const existing = byKey.get(key)
    if (!existing || rank(event) > rank(existing)) byKey.set(key, event)
  }
  return [...byKey.values()]
}

/** Newest and most severe first — what an operator should look at. */
function operationalOrder(a: WorldEvent, b: WorldEvent): number {
  if (b.severity !== a.severity) return b.severity - a.severity
  return Date.parse(b.at) - Date.parse(a.at)
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

  return {
    generatedAt: new Date().toISOString(),
    events,
    unplaceable,
    categories,
    hotspots,
    summary: {
      total: deduped.length,
      placed: events.length,
      sources: results.map((r) => r.sourceKey),
      sourcesOk: results.filter((r) => r.ok).length,
      sourcesFailed: results.filter((r) => !r.ok).length,
    },
  }
}
