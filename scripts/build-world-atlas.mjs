#!/usr/bin/env node
/**
 * Generates lib/geo/world-atlas.ts — the country outlines the globe and the flat
 * map both draw from.
 *
 * Source: Natural Earth `ne_110m_admin_0_countries` (public domain, CC0). We do
 * not ship a vendor map SDK or call a tile server at runtime: the outlines are
 * simplified here, committed as plain numbers, and rendered by our own canvas
 * code. That keeps the map offline-capable, dependency-free and portable.
 *
 * Usage: node scripts/build-world-atlas.mjs <path-to.geojson>
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** Perpendicular distance from p to the segment a→b, in degrees. */
function segDistance(p, a, b) {
  let x = a[0]
  let y = a[1]
  let dx = b[0] - x
  let dy = b[1] - y
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
    if (t > 1) {
      x = b[0]
      y = b[1]
    } else if (t > 0) {
      x += dx * t
      y += dy * t
    }
  }
  dx = p[0] - x
  dy = p[1] - y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Ramer–Douglas–Peucker, iterative so deep rings cannot blow the stack. */
function simplify(ring, tolerance) {
  if (ring.length <= 3) return ring
  const keep = new Uint8Array(ring.length)
  keep[0] = 1
  keep[ring.length - 1] = 1
  const stack = [[0, ring.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop()
    let maxDist = 0
    let index = -1
    for (let i = first + 1; i < last; i++) {
      const d = segDistance(ring[i], ring[first], ring[last])
      if (d > maxDist) {
        maxDist = d
        index = i
      }
    }
    if (maxDist > tolerance && index > 0) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }
  return ring.filter((_, i) => keep[i] === 1)
}

/** Shoelace area in square degrees — used to drop specks, not for geodesy. */
function ringArea(ring) {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return Math.abs(sum / 2)
}

/**
 * A ring that crosses the antimeridian arrives with longitudes jumping ±360.
 * Splitting there keeps every emitted ring inside one hemisphere-safe span, so
 * neither projection has to draw a stripe across the whole map.
 */
function splitAtAntimeridian(ring) {
  const parts = []
  let current = [ring[0]]
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) {
      parts.push(current)
      current = []
    }
    current.push(ring[i])
  }
  parts.push(current)
  return parts.filter((p) => p.length >= 3)
}

const TOLERANCE = 0.28
const MIN_AREA = 1.2
const PRECISION = 2

function ringsOf(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
  return []
}

function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('usage: node scripts/build-world-atlas.mjs <geojson>')
    process.exit(1)
  }
  const fc = JSON.parse(readFileSync(input, 'utf8'))
  const countries = []

  for (const feature of fc.features) {
    const props = feature.properties ?? {}
    const name = props.NAME ?? props.ADMIN ?? props.name
    const isoRaw = props.ISO_A2_EH ?? props.ISO_A2 ?? props.iso_a2 ?? ''
    const iso = isoRaw && isoRaw !== '-99' ? isoRaw.toUpperCase() : ''
    if (!name) continue

    const raw = ringsOf(feature.geometry)
    const rings = []
    for (const ring of raw) {
      for (const part of splitAtAntimeridian(ring)) {
        const simplified = simplify(part, TOLERANCE)
        if (simplified.length < 3) continue
        if (ringArea(simplified) < MIN_AREA) continue
        rings.push(
          simplified.flatMap(([lon, lat]) => [
            Number(lon.toFixed(PRECISION)),
            Number(lat.toFixed(PRECISION)),
          ]),
        )
      }
    }
    // A country whose every ring fell under MIN_AREA (micro-states, atolls) keeps
    // its single largest ring so it never silently vanishes from the map.
    if (rings.length === 0) {
      let best = null
      for (const ring of raw) {
        for (const part of splitAtAntimeridian(ring)) {
          const s = simplify(part, TOLERANCE / 2)
          if (s.length < 3) continue
          if (!best || ringArea(s) > ringArea(best)) best = s
        }
      }
      if (!best) continue
      rings.push(
        best.flatMap(([lon, lat]) => [
          Number(lon.toFixed(PRECISION)),
          Number(lat.toFixed(PRECISION)),
        ]),
      )
    }
    countries.push({ iso, name, rings })
  }

  countries.sort((a, b) => a.name.localeCompare(b.name))

  const body = countries
    .map((c) => {
      const rings = c.rings.map((r) => `[${r.join(',')}]`).join(',')
      return `  { iso: ${JSON.stringify(c.iso)}, name: ${JSON.stringify(c.name)}, rings: [${rings}] },`
    })
    .join('\n')

  const totalPoints = countries.reduce(
    (n, c) => n + c.rings.reduce((m, r) => m + r.length / 2, 0),
    0,
  )

  const out = `/**
 * World country outlines — generated, do not edit by hand.
 *
 * Run \`node scripts/build-world-atlas.mjs <ne_110m_admin_0_countries.geojson>\`
 * to regenerate. Source: Natural Earth 1:110m Admin 0 Countries (public domain,
 * CC0). Simplified with Ramer–Douglas–Peucker at ${TOLERANCE}° and rounded to
 * ${PRECISION} decimals (~1 km) — accurate enough to recognise every country at
 * screen scale, small enough to ship in the bundle and draw offline.
 *
 * ${countries.length} countries · ${totalPoints} points.
 *
 * Each ring is a flat [lon, lat, lon, lat, …] array. Rings that crossed the
 * antimeridian were split, so no ring ever spans more than 180° of longitude.
 */

export interface AtlasCountry {
  /** ISO 3166-1 alpha-2, or '' where Natural Earth has no code (disputed areas). */
  iso: string
  name: string
  rings: number[][]
}

export const WORLD_COUNTRIES: AtlasCountry[] = [
${body}
]

/** Total outline points — used by tests to catch a truncated regeneration. */
export const WORLD_ATLAS_POINTS = ${totalPoints}
`
  writeFileSync('lib/geo/world-atlas.ts', out)
  console.log(
    `wrote lib/geo/world-atlas.ts — ${countries.length} countries, ${totalPoints} points, ${(out.length / 1024).toFixed(0)} KB`,
  )
}

main()
