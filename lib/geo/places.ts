import { clusterByScreenDistance, type PlottedPoint } from './cluster'
import { RAW_PLACES, type RawPlace } from './places-data'
import type { Density } from '@/lib/prefs/density'

/**
 * The permanent world under the events.
 *
 * ## What this is for
 *
 * Every layer the map had was a view of the *event set* — events, corroboration,
 * latency, coverage, liquidity. All five answer "what arrived in this sweep",
 * and all five vanish when a sweep is quiet. Nothing on the canvas said where
 * anything *is*.
 *
 * That is a real gap in an intelligence surface, not a decoration. A marker at
 * 34.05, -118.24 is a dot near a coastline; the same marker beside the word
 * "Los Angeles" is a fact a reader can act on. Country outlines already ship
 * (`./world-atlas`) and answer at the scale of a nation. This answers at the
 * scale a person actually thinks in.
 *
 * ## Why the labels are chosen, not filtered
 *
 * 1251 places cannot all be drawn. The naive approach — take everything above a
 * population threshold — produces a map that is empty across most of Africa and
 * unreadable across the Rhine, because population is distributed unevenly and a
 * single global threshold cannot be right in both places.
 *
 * So selection is *spatial*: places are considered in importance order and
 * merged by screen distance, and each cluster contributes its lead. The most
 * important place in a crowded region wins, a sparse region keeps a small city
 * that a global threshold would have dropped, and the density is even because
 * it is enforced in pixels rather than in people.
 *
 * That is exactly what `./cluster` already does for events, in the same greedy,
 * deterministic, input-order way — so it is the same function, not a second
 * implementation of the same idea (charter rule #6).
 */

/** A populated place, with the names its compact stored form does not carry. */
export interface Place {
  name: string
  lat: number
  lon: number
  /** ISO 3166-1 alpha-2 of the country, or '' where Natural Earth has none. */
  countryIso: string
  /** Population of the wider urban area; 0 where unknown. */
  population: number
  isCapital: boolean
}

const expand = (r: RawPlace): Place => ({
  name: r.n,
  lat: r.la,
  lon: r.lo,
  countryIso: r.i,
  population: r.p,
  isCapital: r.c === 1,
})

/**
 * Every place, in importance order: national capitals first, then population
 * descending. The order is the selection rule — see the note above — and it is
 * computed by `scripts/build-places.mjs`, not here.
 */
export const PLACES: Place[] = RAW_PLACES.map(expand)

/**
 * How many labels each density level is willing to show.
 *
 * `minimal` is zero, and that is the whole of what `minimal` means: a reader who
 * asked for the least possible chrome did not ask for a thousand city names.
 * The other three rise steeply because the separation radius below is doing most
 * of the work — the budget is a ceiling for a wide viewport, not the usual
 * limit.
 *
 * These are not arbitrary. On a laptop map pane measured at roughly 700×500, the
 * canvas holds about 40 labels before they start reading as texture rather than
 * as words; `balanced` sits under that, `intelligence` accepts a denser page
 * because that is what the level is for, and `extreme` is the level whose job is
 * "show me everything".
 */
export const LABEL_BUDGET: Record<Density, number> = {
  minimal: 0,
  balanced: 30,
  intelligence: 70,
  extreme: 140,
}

/**
 * How far apart two labels must be, in screen pixels.
 *
 * A label is roughly 7 px per character and 11 px tall, so two anchors closer
 * than this overlap as drawn text even though their points are distinct. Larger
 * than the event cluster radius on purpose: an event mark is a dot and a place
 * is a word, and a word needs the room its letters occupy.
 */
export const LABEL_SEPARATION_PX = 48

export interface PlacePick {
  place: Place
  x: number
  y: number
  /** How many other places this one stands for. Never drawn; used by tests and tooling. */
  represents: number
}

/**
 * Choose which places to label, given where they landed on screen.
 *
 * Takes points that are **already projected**, like `./cluster` and for the same
 * reason: the same function then serves the globe and the flat map, and can be
 * tested without a canvas.
 *
 * A caller passes only the places currently on screen — a place behind the globe
 * or outside the viewport is not projected at all — so this never spends effort
 * on labels nobody could see.
 */
export function chooseLabels(
  projected: Array<PlottedPoint<Place>>,
  options: { budget: number; separationPx?: number } = { budget: LABEL_BUDGET.balanced },
): PlacePick[] {
  const budget = Math.max(0, Math.floor(options.budget))
  if (budget === 0 || projected.length === 0) return []

  const clusters = clusterByScreenDistance(projected, options.separationPx ?? LABEL_SEPARATION_PX)
  /**
   * The clusterer preserves input order, and the input is importance order, so
   * taking a prefix here takes the most important surviving places. No second
   * sort: sorting the clusters by population would undo the spatial evenness
   * that clustering just bought.
   */
  return clusters.slice(0, budget).map((c) => ({
    place: c.lead,
    x: c.x,
    y: c.y,
    represents: c.items.length,
  }))
}

/**
 * The nearest labelled place to a coordinate, within `maxDegrees`.
 *
 * For naming an event's location in text — a briefing, an export, a tooltip —
 * where there is no screen to cluster against. Distance is measured on the
 * sphere rather than in raw degrees, because a degree of longitude is 111 km at
 * the equator and 19 km at Reykjavík, and the naive version names the wrong city
 * for everything north of the Baltic.
 */
export function nearestPlace(
  lat: number,
  lon: number,
  maxDegrees = 3,
  places: Place[] = PLACES,
): Place | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const maxKm = maxDegrees * 111
  let best: Place | null = null
  let bestKm = Infinity
  for (const p of places) {
    const km = haversineKm(lat, lon, p.lat, p.lon)
    if (km < bestKm) {
      bestKm = km
      best = p
    }
  }
  return bestKm <= maxKm ? best : null
}

/** Great-circle distance in kilometres. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
