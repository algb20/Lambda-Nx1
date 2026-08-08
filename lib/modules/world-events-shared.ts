/**
 * The parts of the world-events model that the browser needs.
 *
 * Split out of `world-events.ts` deliberately: that module imports the engine
 * orchestrator, which reaches `node:crypto` through the guardrail, and a client
 * component importing so much as a type from it drags the whole chain into the
 * browser bundle and fails the build. Everything here is pure — types, the
 * category palette, severity and region maths — so both sides can share it.
 */
import type { Admiralty, Confidence } from '../engine/types'

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
  | 'tsunami'
  | 'health'
  | 'space'
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
  volcano: { label: 'Volcano', color: '#dc2626' },
  flood: { label: 'Flood', color: '#3b82f6' },
  drought: { label: 'Drought', color: '#d97706' },
  landslide: { label: 'Landslide', color: '#a16207' },
  ice: { label: 'Ice & snow', color: '#7dd3fc' },
  dust: { label: 'Dust & haze', color: '#ca8a04' },
  temperature: { label: 'Temperature extreme', color: '#f43f5e' },
  manmade: { label: 'Man-made', color: '#94a3b8' },
  water: { label: 'Water', color: '#22d3ee' },
  natural: { label: 'Natural event', color: '#22c55e' },
  tsunami: { label: 'Tsunami', color: '#0ea5e9' },
  health: { label: 'Health emergency', color: '#14b8a6' },
  space: { label: 'Space', color: '#64748b' },
  humanitarian: { label: 'Humanitarian', color: '#eab308' },
  world: { label: 'World news', color: '#cbd5e1' },
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
  /** 0–1, from a real measurement or an agency's own alert level. 0 = neither. */
  severity: number
  /** The issuing agency's alert wording, where there was one ("Red", "Severe"). */
  alertLevel: string | null
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
  /** Plotted events grouped into coarse regions, for the region filter. */
  regions: Array<{ region: Region; label: string; count: number }>
  /** Countries with the most activity right now. */
  hotspots: Array<{ country: string; iso: string; count: number; lat: number; lon: number }>
  /** Per-feed health — a board that quietly loses a source is a lying board. */
  sourceHealth: Array<{ sourceKey: string; ok: boolean; error: string | null }>
  summary: {
    total: number
    placed: number
    /** Timestamp of the newest event held, or null. Answers "is this live?". */
    newestAt: string | null
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

/**
 * Ranking for an operations board.
 *
 * Severity alone is wrong: a red alert from last week outranks a live one, and
 * the board stops looking live. So severity decays with age over a 72-hour
 * half-life. A major quake stays near the top for a day and then makes room, on
 * its own, without anything being deleted.
 */
export function operationalScore(event: WorldEvent, now = Date.now()): number {
  const ageHours = Math.max(0, (now - Date.parse(event.at)) / 3_600_000)
  const decay = Number.isFinite(ageHours) ? Math.pow(0.5, ageHours / 72) : 0.5
  // The floor keeps a zero-severity but very recent event on the board.
  return (event.severity + 0.05) * decay
}

export function operationalOrder(a: WorldEvent, b: WorldEvent): number {
  const diff = operationalScore(b) - operationalScore(a)
  if (Math.abs(diff) > 1e-9) return diff
  return Date.parse(b.at) - Date.parse(a.at)
}

/** Coarse regions, matching how an operator filters a world board. */
export type Region = 'americas' | 'europe' | 'africa' | 'middle-east' | 'asia-pacific' | 'polar'

export const REGION_LABEL: Record<Region, string> = {
  americas: 'Americas',
  europe: 'Europe',
  africa: 'Africa',
  'middle-east': 'Middle East',
  'asia-pacific': 'Asia Pacific',
  polar: 'Polar',
}

/**
 * Which region a coordinate belongs to. Deliberately simple boxes rather than
 * political boundaries: the filter's job is to cut a busy board down to the part
 * of the world someone is watching, not to adjudicate borders.
 */
export function regionOf(lat: number, lon: number): Region {
  if (lat > 66 || lat < -60) return 'polar'
  if (lon >= -170 && lon < -25) return 'americas'
  if (lon >= 25 && lon <= 63 && lat >= 12 && lat <= 42) return 'middle-east'
  if (lon >= -25 && lon < 40 && lat < 37) return 'africa'
  if (lon >= -25 && lon < 40) return 'europe'
  return 'asia-pacific'
}
