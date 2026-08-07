/**
 * The atlas layer — everything the globe and the flat map need from the country
 * outlines, computed from the geometry itself.
 *
 * Why this exists: the outlines are a flat number soup optimised for size. This
 * module turns them into the things a renderer actually asks for — bounding
 * boxes for culling, representative points for plotting, and a point-in-country
 * test for "what did the user just click on" — without any of it being typed by
 * hand. `COUNTRY_CENTROIDS` used to be a hand-maintained list of ~65 countries,
 * so a signal from anywhere else was silently dropped; here every country in the
 * atlas gets a centroid derived from its own polygon.
 */
import { WORLD_COUNTRIES, type AtlasCountry } from './world-atlas'

export interface Ring {
  /** Flat [lon, lat, …] as stored in the atlas. */
  coords: number[]
  minLon: number
  maxLon: number
  minLat: number
  maxLat: number
}

export interface AtlasShape {
  iso: string
  name: string
  rings: Ring[]
  /** Representative interior-ish point (lat, lon) for labels and plotting. */
  centroid: { lat: number; lon: number }
}

function boundsOf(coords: number[]): Omit<Ring, 'coords'> {
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (let i = 0; i < coords.length; i += 2) {
    const lon = coords[i]
    const lat = coords[i + 1]
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { minLon, maxLon, minLat, maxLat }
}

/** Signed shoelace area in square degrees. Sign is unused; magnitude ranks rings. */
export function ringArea(coords: number[]): number {
  let sum = 0
  const n = coords.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = coords[i * 2]
    const yi = coords[i * 2 + 1]
    const xj = coords[j * 2]
    const yj = coords[j * 2 + 1]
    sum += (xj + xi) * (yj - yi)
  }
  return Math.abs(sum / 2)
}

/**
 * Area-weighted centroid of a ring. For a country this lands inside the landmass
 * for the overwhelming majority of shapes; crescent-shaped outliers are nudged
 * back inside by `representativePoint`.
 */
export function ringCentroid(coords: number[]): { lat: number; lon: number } {
  let twiceArea = 0
  let x = 0
  let y = 0
  const n = coords.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = coords[i * 2]
    const yi = coords[i * 2 + 1]
    const xj = coords[j * 2]
    const yj = coords[j * 2 + 1]
    const f = xj * yi - xi * yj
    twiceArea += f
    x += (xj + xi) * f
    y += (yj + yi) * f
  }
  if (Math.abs(twiceArea) < 1e-9) {
    // Degenerate sliver: fall back to the plain average of its vertices.
    let sx = 0
    let sy = 0
    for (let i = 0; i < n; i++) {
      sx += coords[i * 2]
      sy += coords[i * 2 + 1]
    }
    return { lat: sy / n, lon: sx / n }
  }
  const f = twiceArea * 3
  return { lat: y / f, lon: x / f }
}

/** Even-odd point-in-polygon on a flat [lon, lat, …] ring. */
export function pointInRing(lat: number, lon: number, coords: number[]): boolean {
  let inside = false
  const n = coords.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = coords[i * 2]
    const yi = coords[i * 2 + 1]
    const xj = coords[j * 2]
    const yj = coords[j * 2 + 1]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * A point guaranteed to sit inside the ring. Starts from the area centroid and,
 * if that falls outside (concave shapes such as Croatia or Norway), scans the
 * ring's own horizontal mid-line for the widest interior span and takes its
 * middle — the same idea as a pole-of-inaccessibility, cheap enough to run for
 * every country at module load.
 */
export function representativePoint(coords: number[]): { lat: number; lon: number } {
  const c = ringCentroid(coords)
  if (pointInRing(c.lat, c.lon, coords)) return c

  const b = boundsOf(coords)
  let best: { lat: number; lon: number; span: number } | null = null
  for (let step = 1; step <= 7; step++) {
    const lat = b.minLat + ((b.maxLat - b.minLat) * step) / 8
    // Collect crossings of this latitude line, then take the widest inside span.
    const xs: number[] = []
    const n = coords.length / 2
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = coords[i * 2]
      const yi = coords[i * 2 + 1]
      const xj = coords[j * 2]
      const yj = coords[j * 2 + 1]
      if (yi > lat !== yj > lat) xs.push(((xj - xi) * (lat - yi)) / (yj - yi) + xi)
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const span = xs[k + 1] - xs[k]
      if (!best || span > best.span) best = { lat, lon: (xs[k] + xs[k + 1]) / 2, span }
    }
  }
  return best ? { lat: best.lat, lon: best.lon } : c
}

function toShape(c: AtlasCountry): AtlasShape {
  const rings: Ring[] = c.rings.map((coords) => ({ coords, ...boundsOf(coords) }))
  let largest = rings[0]
  let largestArea = -1
  for (const r of rings) {
    const a = ringArea(r.coords)
    if (a > largestArea) {
      largestArea = a
      largest = r
    }
  }
  return { iso: c.iso, name: c.name, rings, centroid: representativePoint(largest.coords) }
}

/** Every country, prepared for rendering and hit-testing. Computed once. */
export const ATLAS: AtlasShape[] = WORLD_COUNTRIES.map(toShape)

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\bthe\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Names that real feeds use but Natural Earth does not. Kept deliberately small:
 * anything the atlas already spells correctly must NOT be listed here, so the
 * table stays a list of exceptions rather than a second source of truth.
 */
const NAME_ALIASES: Record<string, string> = {
  usa: 'united states of america',
  us: 'united states of america',
  'united states': 'united states of america',
  uk: 'united kingdom',
  'great britain': 'united kingdom',
  britain: 'united kingdom',
  england: 'united kingdom',
  scotland: 'united kingdom',
  wales: 'united kingdom',
  'northern ireland': 'united kingdom',
  uae: 'united arab emirates',
  turkiye: 'turkey',
  'czech republic': 'czechia',
  holland: 'netherlands',
  burma: 'myanmar',
  'republic of korea': 'south korea',
  'korea republic of': 'south korea',
  "korea democratic people's republic of": 'north korea',
  'russian federation': 'russia',
  'ivory coast': "côte d'ivoire",
  swaziland: 'eswatini',
  macedonia: 'north macedonia',
  'east timor': 'timor leste',
  'democratic republic of the congo': 'dem rep congo',
  drc: 'dem rep congo',
  'dr congo': 'dem rep congo',
  'congo kinshasa': 'dem rep congo',
  'congo brazzaville': 'congo',
  'republic of the congo': 'congo',
  'central african republic': 'central african rep',
  'dominican republic': 'dominican rep',
  'equatorial guinea': 'eq guinea',
  'south sudan': 's sudan',
  'western sahara': 'w sahara',
  'northern cyprus': 'n cyprus',
  'falkland islands': 'falkland is',
  'solomon islands': 'solomon is',
  'occupied palestinian territory': 'palestine',
  'palestinian territory': 'palestine',
  'west bank and gaza': 'palestine',
}

const BY_KEY = new Map<string, AtlasShape>()
for (const shape of ATLAS) {
  BY_KEY.set(normalize(shape.name), shape)
  if (shape.iso) BY_KEY.set(shape.iso.toLowerCase(), shape)
}
// Aliases are normalized on the way in, so a caller's spelling and the table's
// spelling are compared the same way ("Republic of *the* Congo" included).
for (const [alias, target] of Object.entries(NAME_ALIASES)) {
  const shape = BY_KEY.get(normalize(target))
  if (shape) BY_KEY.set(normalize(alias), shape)
}

/** Resolve a country by ISO-2 code or (loosely matched) name. */
export function findCountry(value: string): AtlasShape | null {
  if (!value) return null
  const key = normalize(value)
  const direct = BY_KEY.get(key)
  if (direct) return direct
  // Natural Earth abbreviates a handful of long names ("Dem. Rep. Congo",
  // "Bosnia and Herz."). Match on the leading words so feeds that spell them out
  // still resolve, without accepting a one-word prefix that could hit the wrong
  // country.
  if (key.length >= 6) {
    for (const shape of ATLAS) {
      const n = normalize(shape.name)
      if (n.length >= 6 && (n.startsWith(key.slice(0, 6)) || key.startsWith(n.slice(0, 6)))) {
        return shape
      }
    }
  }
  return null
}

/** Which country contains this coordinate, if any. */
export function countryAt(lat: number, lon: number): AtlasShape | null {
  for (const shape of ATLAS) {
    for (const ring of shape.rings) {
      if (lat < ring.minLat || lat > ring.maxLat || lon < ring.minLon || lon > ring.maxLon) continue
      if (pointInRing(lat, lon, ring.coords)) return shape
    }
  }
  return null
}
