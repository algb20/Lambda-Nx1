/**
 * World-events sources — the geolocated layer behind the live world surface.
 *
 * These answer a different question from the news gateway. News tells you what
 * is being *reported*; these tell you what a sensor or an official agency has
 * *measured*, with a coordinate attached. That distinction is why they are their
 * own capability: an analyst reading the map needs to know whether a dot is an
 * instrument reading (Admiralty A/1) or a headline (C/3).
 *
 * Both are keyless, passive, read-only public endpoints.
 */
import type { Evidence, Source, SourceContext, SourceInput } from '../types'

// ── NASA EONET v3 (natural hazards, exact coordinates) ───────────────────────
// The Earth Observatory Natural Event Tracker: wildfires, severe storms,
// volcanoes, floods, ice, dust and drought, curated by NASA from official
// observatories and satellite observation. Open events only — the map should
// show what is happening, not a history lesson.
interface EonetGeometry {
  date?: string
  type?: string
  coordinates?: unknown
  magnitudeValue?: number
  magnitudeUnit?: string
}
interface EonetEvent {
  id?: string
  title?: string
  description?: string
  link?: string
  categories?: Array<{ id?: string; title?: string }>
  sources?: Array<{ id?: string; url?: string }>
  geometry?: EonetGeometry[]
}
interface EonetResponse {
  events?: EonetEvent[]
}

/**
 * EONET gives a Point for most events and a Polygon for area events (ice
 * shelves, large burn scars). Both must reduce to one plottable coordinate, and
 * a malformed one must reduce to nothing rather than to (0, 0) — a dot in the
 * Gulf of Guinea is worse than no dot.
 */
export function eonetCoordinate(geometry: EonetGeometry | undefined): [number, number] | null {
  const coords = geometry?.coordinates
  if (!Array.isArray(coords)) return null

  const valid = (lon: unknown, lat: unknown): [number, number] | null =>
    typeof lon === 'number' &&
    typeof lat === 'number' &&
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    Math.abs(lon) <= 180 &&
    Math.abs(lat) <= 90
      ? [lon, lat]
      : null

  if (typeof coords[0] === 'number') return valid(coords[0], coords[1])

  // Polygon / MultiPolygon: average the outermost ring's vertices.
  let ring: unknown = coords[0]
  while (Array.isArray(ring) && Array.isArray(ring[0]) && Array.isArray(ring[0][0])) ring = ring[0]
  if (!Array.isArray(ring)) return null
  let sumLon = 0
  let sumLat = 0
  let n = 0
  for (const pair of ring) {
    if (!Array.isArray(pair)) continue
    const p = valid(pair[0], pair[1])
    if (!p) continue
    sumLon += p[0]
    sumLat += p[1]
    n++
  }
  return n > 0 ? [sumLon / n, sumLat / n] : null
}

/** EONET category id → our event category. Unknown ids stay 'natural'. */
const EONET_CATEGORY: Record<string, string> = {
  wildfires: 'wildfire',
  severeStorms: 'storm',
  volcanoes: 'volcano',
  floods: 'flood',
  drought: 'drought',
  landslides: 'landslide',
  earthquakes: 'seismic',
  seaLakeIce: 'ice',
  snow: 'ice',
  dustHaze: 'dust',
  tempExtremes: 'temperature',
  manmade: 'manmade',
  waterColor: 'water',
}

export const nasaEonet: Source = {
  key: 'nasa_eonet',
  capability: 'world_events',
  passive: true,
  hosts: ['eonet.gsfc.nasa.gov'],
  minIntervalMs: 1500,
  async run(_input: SourceInput, ctx: SourceContext) {
    const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=10&limit=120'
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as EonetResponse | null
    const events = j?.events ?? []
    const out: Evidence[] = []
    for (const ev of events) {
      if (!ev.title) continue
      // The last geometry is the most recent observation of a moving event.
      const geometry = ev.geometry?.[ev.geometry.length - 1]
      const coord = eonetCoordinate(geometry)
      if (!coord) continue
      const categoryId = ev.categories?.[0]?.id ?? ''
      out.push({
        claim: ev.title.trim(),
        entity: { type: 'other', value: ev.title.trim() },
        sourceKey: 'nasa_eonet',
        // Prefer the reporting observatory over the API record when given.
        sourceUrl: ev.sources?.[0]?.url ?? ev.link,
        retrievedAt: geometry?.date ?? new Date().toISOString(),
        // Curated by NASA from official observing systems.
        admiralty: { source: 'A', info: 2 },
        confidence: 'confirmed',
        data: {
          lon: coord[0],
          lat: coord[1],
          category: EONET_CATEGORY[categoryId] ?? 'natural',
          categoryLabel: ev.categories?.[0]?.title ?? 'Natural event',
          magnitude: typeof geometry?.magnitudeValue === 'number' ? geometry.magnitudeValue : null,
          magnitudeUnit: geometry?.magnitudeUnit ?? null,
          eventId: ev.id ?? null,
          kind: 'world_event',
        },
      })
    }
    return out
  },
}

// ── USGS seismic (all M2.5+ in the past day) ─────────────────────────────────
// The news gateway carries only *significant* quakes of the past week. A live
// operations map wants the full recent picture, which is a different feed.
interface UsgsFeature {
  properties?: {
    mag?: number
    place?: string
    time?: number
    url?: string
    title?: string
    tsunami?: number
  }
  geometry?: { coordinates?: number[] }
}
interface UsgsResponse {
  features?: UsgsFeature[]
}

export const usgsRecentQuakes: Source = {
  key: 'usgs_recent',
  capability: 'world_events',
  passive: true,
  hosts: ['earthquake.usgs.gov'],
  minIntervalMs: 2000,
  async run(_input: SourceInput, ctx: SourceContext) {
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as UsgsResponse | null
    const features = j?.features ?? []
    const out: Evidence[] = []
    for (const f of features) {
      const p = f.properties
      const c = f.geometry?.coordinates
      if (!p?.title || !Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') {
        continue
      }
      out.push({
        claim: p.title.trim() + (p.tsunami ? ' · tsunami alert' : ''),
        entity: p.place ? { type: 'other', value: p.place } : undefined,
        sourceKey: 'usgs_recent',
        sourceUrl: p.url,
        retrievedAt: new Date(typeof p.time === 'number' ? p.time : Date.now()).toISOString(),
        // Instrument-measured by an authoritative agency.
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: {
          lon: c[0],
          lat: c[1],
          depthKm: typeof c[2] === 'number' ? c[2] : null,
          category: 'seismic',
          categoryLabel: 'Earthquake',
          magnitude: typeof p.mag === 'number' ? p.mag : null,
          magnitudeUnit: 'moment magnitude',
          place: p.place ?? null,
          tsunami: Boolean(p.tsunami),
          kind: 'world_event',
        },
      })
    }
    return out
  },
}

export const worldEventSources: Source[] = [nasaEonet, usgsRecentQuakes]
