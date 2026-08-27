/**
 * Geospatial sources — passive, keyless public data.
 *  - Nominatim (OpenStreetMap): geocode a place name, or reverse-geocode "lat,lon".
 *  - OpenSky Network: live public flight state for an aircraft (ICAO24 hex).
 *
 * All are public, lawful, read-only. We respect each provider's usage policy
 * (descriptive User-Agent, low rate). No tracking of private individuals.
 */
import type { Evidence, Source } from '../types'
import { expectOk } from '../fetch-guard'

const ICAO24 = /^[0-9a-f]{6}$/i
const LATLON = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

const OSM_HEADERS = {
  Accept: 'application/json',
}

// ── Nominatim (capability: geo — places) ─────────────────────────────────────
interface NominatimPlace {
  lat?: string
  lon?: string
  display_name?: string
  type?: string
  class?: string
  osm_type?: string
  osm_id?: number
}

function osmUrl(p: NominatimPlace): string {
  if (p.osm_type && p.osm_id) {
    const t = p.osm_type[0].toUpperCase() // N/W/R
    return `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}#map=12/${p.lat}/${p.lon}`.replace('#', `?type=${t}#`)
  }
  return p.lat && p.lon ? `https://www.openstreetmap.org/#map=12/${p.lat}/${p.lon}` : 'https://www.openstreetmap.org'
}

export const nominatim: Source = {
  key: 'nominatim',
  capability: 'geo',
  passive: true,
  hosts: ['nominatim.openstreetmap.org'],
  minIntervalMs: 1100, // Nominatim asks for ≤ 1 req/s
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 2 || ICAO24.test(q)) return []
    const m = LATLON.exec(q)
    if (m) {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${m[1]}&lon=${m[2]}`
      const res = await ctx.fetch(url, { headers: OSM_HEADERS })
      expectOk('nominatim', res)
      const p = (await res.json().catch(() => null)) as NominatimPlace | null
      if (!p?.display_name) return []
      return [
        {
          claim: `Location: ${p.display_name}`,
          entity: { type: 'other', value: p.display_name },
          sourceKey: 'nominatim',
          sourceUrl: osmUrl(p),
          retrievedAt: new Date().toISOString(),
          admiralty: { source: 'A', info: 2 },
          confidence: 'probable',
          data: { lat: p.lat, lon: p.lon, type: p.type, class: p.class },
        },
      ]
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(q)}`
    const res = await ctx.fetch(url, { headers: OSM_HEADERS })
    expectOk('nominatim', res)
    const results = (await res.json().catch(() => null)) as NominatimPlace[] | null
    if (!Array.isArray(results)) return []
    return results.slice(0, 3).map<Evidence>((p) => ({
      claim: `Place: ${p.display_name ?? q}${p.type ? ` (${p.type})` : ''}`,
      entity: { type: 'other', value: p.display_name ?? q },
      sourceKey: 'nominatim',
      sourceUrl: osmUrl(p),
      retrievedAt: new Date().toISOString(),
      admiralty: { source: 'A', info: 2 },
      confidence: 'probable',
      data: { lat: p.lat, lon: p.lon, type: p.type, class: p.class },
    }))
  },
}

// ── OpenSky (capability: geo — live flights) ─────────────────────────────────
interface OpenSkyResponse {
  time?: number
  states?: Array<Array<string | number | boolean | null>>
}

export const opensky: Source = {
  key: 'opensky',
  capability: 'geo',
  passive: true,
  hosts: ['opensky-network.org'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const hex = input.value.trim().toLowerCase()
    if (!ICAO24.test(hex)) return []
    const url = `https://opensky-network.org/api/states/all?icao24=${hex}`
    const res = await ctx.fetch(url)
    expectOk('opensky', res)
    const j = (await res.json().catch(() => null)) as OpenSkyResponse | null
    const s = j?.states?.[0]
    if (!s) return []
    const callsign = String(s[1] ?? '').trim() || hex
    const country = String(s[2] ?? '')
    const lon = typeof s[5] === 'number' ? (s[5] as number) : null
    const lat = typeof s[6] === 'number' ? (s[6] as number) : null
    const alt = typeof s[7] === 'number' ? (s[7] as number) : null
    const onGround = Boolean(s[8])
    const velocity = typeof s[9] === 'number' ? (s[9] as number) : null
    return [
      {
        claim:
          `Flight ${callsign} (${country}): ` +
          (lat !== null && lon !== null ? `${lat.toFixed(3)}, ${lon.toFixed(3)}` : 'position unknown') +
          (alt !== null ? `, ${Math.round(alt)} m` : '') +
          (velocity !== null ? `, ${Math.round(velocity)} m/s` : '') +
          (onGround ? ' [on ground]' : ''),
        entity: { type: 'other', value: hex },
        sourceKey: 'opensky',
        sourceUrl: `https://opensky-network.org/aircraft-profile?icao24=${hex}`,
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: { callsign, country, lat, lon, alt, velocity, onGround },
      },
    ]
  },
}
