#!/usr/bin/env node
/**
 * Generates `lib/geo/places.ts` — the populated places the map labels.
 *
 * Source: Natural Earth `ne_50m_populated_places` (public domain, CC0), the
 * same publisher and the same licence as the country outlines in
 * `lib/geo/world-atlas.ts`. As there, we do not ship a vendor map SDK or call a
 * tile server at runtime: the places are reduced here, committed as plain
 * numbers, and drawn by our own canvas code. The map stays offline-capable,
 * dependency-free and portable (charter rule #3 and #4).
 *
 * ## Why 50m and not 110m
 *
 * Measured on both: 110m carries 243 places, almost all national capitals, and
 * costs 5 KB gzipped. 50m carries 1251 across 220 countries for 23 KB. The
 * smaller set answers "which country is this near"; the larger one answers
 * "which city", which is the question somebody looking at a marker actually
 * has. 23 KB against a `/api/world` payload measured at 6 MB is not a cost
 * worth optimising into a worse map.
 *
 * ## Why the output is sorted
 *
 * By importance — national capitals first, then population descending. A map
 * cannot draw 1251 labels without becoming unreadable, so the renderer takes a
 * prefix of this array and the order decides which places survive. Sorting once
 * here means the runtime never sorts 1251 rows on a pan.
 *
 * Usage: node scripts/build-places.mjs <path-to-ne_50m_populated_places.geojson>
 */
import { readFileSync, writeFileSync } from 'node:fs'

const input = process.argv[2]
if (!input) {
  console.error('usage: node scripts/build-places.mjs <ne_50m_populated_places.geojson>')
  process.exit(1)
}

const geo = JSON.parse(readFileSync(input, 'utf8'))
if (!Array.isArray(geo?.features)) {
  console.error('not a GeoJSON FeatureCollection')
  process.exit(1)
}

/** Three decimals is ~100 m — far finer than a label anchor needs, and half the bytes of six. */
const round = (n) => Math.round(n * 1000) / 1000

const places = []
for (const feature of geo.features) {
  const p = feature?.properties ?? {}
  const c = feature?.geometry?.coordinates
  if (!Array.isArray(c) || c.length < 2) continue
  const [lon, lat] = c
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

  /**
   * ASCII first, then the local name.
   *
   * `NAMEASCII` is the transliterated form and is what a label can render in
   * any font we ship. Where Natural Earth has no ASCII form the local `NAME` is
   * used rather than dropping the place — a city with a name we render
   * imperfectly is better than a city that is not on the map.
   */
  const name = (p.NAMEASCII || p.NAME || '').trim()
  if (!name) continue

  places.push({
    name,
    lat: round(lat),
    lon: round(lon),
    iso: (p.ISO_A2 || '').trim().toUpperCase(),
    pop: Number.isFinite(Number(p.POP_MAX)) ? Number(p.POP_MAX) : 0,
    capital: Number(p.ADM0CAP) === 1,
  })
}

// Capitals first, then by population. See the note above on why order matters.
places.sort((a, b) => {
  if (a.capital !== b.capital) return a.capital ? -1 : 1
  return b.pop - a.pop
})

const capitals = places.filter((p) => p.capital).length
const countries = new Set(places.map((p) => p.iso).filter(Boolean)).size

const rows = places
  .map(
    (p) =>
      `  { n: ${JSON.stringify(p.name)}, la: ${p.lat}, lo: ${p.lon}, i: ${JSON.stringify(p.iso)}, p: ${p.pop}, c: ${p.capital ? 1 : 0} },`,
  )
  .join('\n')

const out = `/**
 * Populated places the map labels — generated, do not edit by hand.
 *
 * Run \`node scripts/build-places.mjs <ne_50m_populated_places.geojson>\` to
 * regenerate. Source: Natural Earth 1:50m Populated Places (public domain,
 * CC0), the same publisher and licence as the country outlines.
 *
 * ${places.length} places · ${capitals} national capitals · ${countries} countries.
 *
 * Sorted by importance — capitals first, then population descending — because
 * the renderer draws a *prefix* of this array. A map cannot show 1251 labels
 * and stay readable, so this order is what decides which places survive at a
 * given density, and it is computed once here rather than on every pan.
 *
 * Field names are one or two characters because this array ships to the
 * browser: the long form costs 18 KB more over the wire for no reader's
 * benefit, and \`Place\` in \`./places\` gives them their real names in code.
 */

/** One populated place, in the compact shape that ships. */
export interface RawPlace {
  /** Name, ASCII-transliterated where Natural Earth provides one. */
  n: string
  /** Latitude, 3 decimal places (~100 m). */
  la: number
  /** Longitude, 3 decimal places. */
  lo: number
  /** ISO 3166-1 alpha-2 of the country, or '' where Natural Earth has none. */
  i: string
  /** Population of the wider urban area, 0 where unknown. */
  p: number
  /** 1 for a national capital. */
  c: 0 | 1
}

export const RAW_PLACES: RawPlace[] = [
${rows}
]
`

writeFileSync('lib/geo/places-data.ts', out)
console.log(
  `lib/geo/places-data.ts: ${places.length} places · ${capitals} capitals · ${countries} countries · ${(out.length / 1024).toFixed(0)} KB`,
)
