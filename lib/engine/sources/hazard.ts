/**
 * Hazard & alert sources — the second layer of the live world surface.
 *
 * EONET and USGS answer "what has the planet done". These answer "who has been
 * warned about it": official alert systems run by the agencies whose job is to
 * tell people to move. They are a different kind of fact, and they carry a
 * severity the agency itself assigned, which is exactly the sort of severity we
 * are allowed to draw (we never invent one).
 *
 * All keyless, passive, read-only public endpoints.
 */
import type { Evidence, Source, SourceContext, SourceInput } from '../types'
import { expectJson } from '../fetch-guard'
import { publicationTime } from '../observed'

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/** A coordinate we are willing to plot. */
function coord(lon: unknown, lat: unknown): [number, number] | null {
  const lo = num(lon)
  const la = num(lat)
  if (lo === null || la === null) return null
  if (Math.abs(lo) > 180 || Math.abs(la) > 90) return null
  return [lo, la]
}

// ── GDACS — Global Disaster Alert and Coordination System ────────────────────
// Run jointly by the UN and the European Commission. Every event carries an
// official alert level (green / orange / red), which is a real, assigned
// severity rather than one we computed.
interface GdacsProps {
  eventtype?: string
  eventname?: string
  name?: string
  description?: string
  htmldescription?: string
  alertlevel?: string
  severitydata?: { severity?: number; severitytext?: string }
  fromdate?: string
  todate?: string
  country?: string
  url?: { report?: string; details?: string }
  episodealertlevel?: string
}
interface GdacsFeature {
  properties?: GdacsProps
  geometry?: { type?: string; coordinates?: unknown }
}
interface GdacsResponse {
  features?: GdacsFeature[]
}

/** GDACS event-type codes → our categories. */
const GDACS_TYPE: Record<string, string> = {
  EQ: 'seismic',
  TC: 'storm',
  FL: 'flood',
  VO: 'volcano',
  DR: 'drought',
  WF: 'wildfire',
  TS: 'tsunami',
}

/** Official alert level → the 0–1 severity the map draws. */
export function gdacsSeverity(alertLevel: string | null | undefined): number {
  switch ((alertLevel ?? '').toLowerCase()) {
    case 'red':
      return 1
    case 'orange':
      return 0.66
    case 'green':
      return 0.33
    default:
      return 0
  }
}

export const gdacsAlerts: Source = {
  key: 'gdacs',
  capability: 'world_events',
  passive: true,
  hosts: ['www.gdacs.org', 'gdacs.org'],
  minIntervalMs: 2000,
  async run(_input: SourceInput, ctx: SourceContext) {
    const url =
      'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?alertlevel=Green;Orange;Red'
    const j = await expectJson<GdacsResponse>('gdacs', await ctx.fetch(url))
    const features = j?.features ?? []
    const retrievedAt = new Date().toISOString()
    const out: Evidence[] = []
    for (const f of features) {
      const p = f.properties
      if (!p) continue
      const c = Array.isArray(f.geometry?.coordinates)
        ? coord((f.geometry.coordinates as unknown[])[0], (f.geometry.coordinates as unknown[])[1])
        : null
      if (!c) continue
      const title = (p.eventname || p.name || p.description || '').trim()
      if (!title) continue
      const level = p.alertlevel ?? p.episodealertlevel ?? null
      out.push({
        claim: level ? `${title} — ${level} alert` : title,
        entity: p.country ? { type: 'other', value: p.country } : undefined,
        sourceKey: 'gdacs',
        sourceUrl: p.url?.report ?? p.url?.details,
        retrievedAt,
        // When the disaster began, per GDACS. `todate` is deliberately not used
        // as a fallback: it is when the alert *ends*, often in the future, and
        // an event dated by its own expiry would sort as tomorrow's news.
        publishedAt: publicationTime(p.fromdate),
        // A joint UN / European Commission alert system — official and reliable.
        admiralty: { source: 'A', info: 2 },
        confidence: 'confirmed',
        data: {
          lon: c[0],
          lat: c[1],
          category: GDACS_TYPE[(p.eventtype ?? '').toUpperCase()] ?? 'natural',
          categoryLabel: p.eventtype ? `GDACS ${p.eventtype}` : 'Disaster alert',
          country: p.country ?? null,
          alertLevel: level,
          // The agency's own severity, passed straight through.
          assignedSeverity: gdacsSeverity(level),
          magnitude: num(p.severitydata?.severity),
          magnitudeUnit: p.severitydata?.severitytext ?? null,
          kind: 'world_event',
        },
      })
    }
    return out
  },
}

// ── NOAA / US National Weather Service — active alerts ───────────────────────
// Keyless, and the only feed here that publishes a machine-readable urgency and
// severity per alert. US-only by nature; labelled as such rather than presented
// as global coverage.
interface NwsFeature {
  properties?: {
    event?: string
    headline?: string
    severity?: string
    urgency?: string
    certainty?: string
    areaDesc?: string
    effective?: string
    ends?: string
    '@id'?: string
  }
  geometry?: { type?: string; coordinates?: unknown } | null
}
interface NwsResponse {
  features?: NwsFeature[]
}

/** The NWS severity vocabulary → 0–1. */
export function nwsSeverity(severity: string | null | undefined): number {
  switch ((severity ?? '').toLowerCase()) {
    case 'extreme':
      return 1
    case 'severe':
      return 0.75
    case 'moderate':
      return 0.5
    case 'minor':
      return 0.25
    default:
      return 0
  }
}

/**
 * An alert's area is a polygon (or several). Reduce it to one representative
 * point, or nothing — an alert we cannot place is better dropped than pinned to
 * the wrong state.
 */
export function nwsCentroid(geometry: NwsFeature['geometry']): [number, number] | null {
  const coords = geometry?.coordinates
  if (!Array.isArray(coords)) return null
  let ring: unknown = coords
  while (Array.isArray(ring) && Array.isArray(ring[0]) && Array.isArray(ring[0][0])) ring = ring[0]
  if (Array.isArray(ring) && typeof ring[0] === 'number') return coord(ring[0], ring[1])
  if (!Array.isArray(ring)) return null
  let sx = 0
  let sy = 0
  let n = 0
  for (const pair of ring) {
    if (!Array.isArray(pair)) continue
    const c = coord(pair[0], pair[1])
    if (!c) continue
    sx += c[0]
    sy += c[1]
    n++
  }
  return n > 0 ? [sx / n, sy / n] : null
}

export const nwsAlerts: Source = {
  key: 'nws_alerts',
  capability: 'world_events',
  passive: true,
  hosts: ['api.weather.gov'],
  minIntervalMs: 1500,
  async run(_input: SourceInput, ctx: SourceContext) {
    const url = 'https://api.weather.gov/alerts/active?severity=Extreme,Severe&limit=100'
    const res = await ctx.fetch(url, {
      headers: {
        // The NWS asks every client to identify itself.
        'User-Agent': 'Lambda NX OSINT (research; contact via app)',
        Accept: 'application/geo+json',
      },
    })
    const j = await expectJson<NwsResponse>('nws_alerts', res)
    const features = j?.features ?? []
    const retrievedAt = new Date().toISOString()
    const out: Evidence[] = []
    for (const f of features) {
      const p = f.properties
      if (!p?.event) continue
      const c = nwsCentroid(f.geometry)
      if (!c) continue
      out.push({
        claim: (p.headline ?? `${p.event} — ${p.areaDesc ?? ''}`).trim(),
        entity: { type: 'other', value: 'United States of America' },
        sourceKey: 'nws_alerts',
        sourceUrl: p['@id'],
        retrievedAt,
        // When the warning took effect. A warning may legitimately be issued for
        // a time a few hours ahead, which is why the plausibility window in
        // `publicationTime` allows a bounded amount of future.
        publishedAt: publicationTime(p.effective),
        // A national meteorological agency issuing a warning.
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: {
          lon: c[0],
          lat: c[1],
          category: 'storm',
          categoryLabel: p.event,
          country: 'United States of America',
          alertLevel: p.severity ?? null,
          assignedSeverity: nwsSeverity(p.severity),
          urgency: p.urgency ?? null,
          area: p.areaDesc ?? null,
          kind: 'world_event',
        },
      })
    }
    return out
  },
}

// ── WHO — Disease Outbreak News ──────────────────────────────────────────────
// The authoritative record of verified outbreaks. Country-level, so it plots on
// a country centroid rather than a coordinate, and is graded accordingly.
interface WhoItem {
  Title?: string
  ItemDefaultUrl?: string
  FormattedDate?: string
  PublicationDateAndTime?: string
  Regions?: string[]
}
interface WhoResponse {
  value?: WhoItem[]
}

export const whoOutbreaks: Source = {
  key: 'who_outbreaks',
  capability: 'world_events',
  passive: true,
  hosts: ['www.who.int'],
  minIntervalMs: 2000,
  async run(_input: SourceInput, ctx: SourceContext) {
    const url =
      'https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDateAndTime%20desc&$top=20'
    const j = await expectJson<WhoResponse>(
      'who_outbreaks',
      await ctx.fetch(url, { headers: { Accept: 'application/json' } }),
    )
    const items = j?.value ?? []
    const retrievedAt = new Date().toISOString()
    return items
      .filter((it) => it.Title)
      .map<Evidence>((it) => ({
        claim: it.Title!.trim(),
        sourceKey: 'who_outbreaks',
        sourceUrl: it.ItemDefaultUrl
          ? `https://www.who.int${it.ItemDefaultUrl}`
          : 'https://www.who.int/emergencies/disease-outbreak-news',
        retrievedAt,
        // WHO publishes both a machine timestamp and a display string; only the
        // former is parsed, because `FormattedDate` is prose in the reader's
        // locale and guessing at it would invent a date.
        publishedAt: publicationTime(it.PublicationDateAndTime),
        // The UN's health agency confirming an outbreak.
        admiralty: { source: 'A', info: 2 },
        confidence: 'confirmed',
        data: {
          category: 'health',
          categoryLabel: 'Disease outbreak',
          // The title normally names the country; the module resolves it.
          country: null,
          kind: 'world_event',
        },
      }))
  },
}

// ── CelesTrak — where the International Space Station is right now ───────────
// A two-line element set is the canonical description of an orbit. Propagating
// it properly needs SGP4; we deliberately do not approximate an orbit and call
// it a position. Instead we read the ISS position endpoint, which publishes the
// sub-satellite point directly — a real measurement, not our arithmetic.
export const issPosition: Source = {
  key: 'iss_position',
  capability: 'world_events',
  passive: true,
  hosts: ['api.wheretheiss.at'],
  minIntervalMs: 3000,
  async run(_input: SourceInput, ctx: SourceContext) {
    const j = await expectJson<{
      latitude?: number
      longitude?: number
      altitude?: number
      velocity?: number
      /** Epoch **seconds** — the instant this sub-satellite point is valid for. */
      timestamp?: number
    }>('iss_position', await ctx.fetch('https://api.wheretheiss.at/v1/satellites/25544'))
    const c = coord(j?.longitude, j?.latitude)
    if (!c) return []
    const altitude = num(j?.altitude)
    return [
      {
        claim:
          `International Space Station overhead` +
          (altitude !== null ? ` at ${Math.round(altitude)} km` : ''),
        entity: { type: 'other', value: 'ISS (ZARYA)' },
        sourceKey: 'iss_position',
        sourceUrl: 'https://www.n2yo.com/satellite/?s=25544',
        retrievedAt: new Date().toISOString(),
        // The epoch the position is valid for. It is close to the fetch time by
        // construction, but they are not the same fact: the station moves ~7.7
        // km every second, so which one a reader is looking at matters.
        publishedAt: publicationTime(j?.timestamp),
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: {
          lon: c[0],
          lat: c[1],
          category: 'space',
          categoryLabel: 'Space station',
          magnitude: altitude,
          magnitudeUnit: altitude !== null ? 'km altitude' : null,
          velocity: num(j?.velocity),
          kind: 'world_event',
        },
      },
    ]
  },
}

export const hazardSources: Source[] = [gdacsAlerts, nwsAlerts, whoOutbreaks, issPosition]
