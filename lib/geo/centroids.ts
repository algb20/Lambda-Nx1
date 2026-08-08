/**
 * Turning signals into plottable points.
 *
 * Centroids are no longer a hand-typed table. They are derived from the country
 * outlines we ship (`lib/geo/atlas`), so every country the map can draw is also
 * a country we can plot a signal on — previously a signal from any of the ~110
 * countries missing from the hand-written list was silently dropped, which is
 * exactly the kind of quiet data loss an intelligence tool must not have.
 */
import { findCountry } from './atlas'

/** Look up a representative point for a country, by name or ISO-2 code. */
export function centroidOf(country: string): [number, number] | null {
  const shape = findCountry(country)
  return shape ? [shape.centroid.lat, shape.centroid.lon] : null
}

export interface GlobePoint {
  lat: number
  lon: number
  label: string
  weight: number
}

/**
 * Aggregate a list of country names into weighted points (one per country,
 * weight = occurrences). Names that resolve to the same country are merged, so
 * "USA", "United States" and "US" count together rather than competing.
 */
export function pointsFromCountries(countries: Array<string | null | undefined>): GlobePoint[] {
  const counts = new Map<string, { weight: number; lat: number; lon: number; label: string }>()
  for (const c of countries) {
    if (!c) continue
    const shape = findCountry(c)
    if (!shape) continue
    const key = shape.iso || shape.name
    const existing = counts.get(key)
    if (existing) existing.weight += 1
    else
      counts.set(key, {
        weight: 1,
        lat: shape.centroid.lat,
        lon: shape.centroid.lon,
        label: shape.name,
      })
  }
  return [...counts.values()]
}

/** An item that may carry exact coordinates and/or a country for plotting. */
export interface GeoLike {
  lat?: number | null
  lon?: number | null
  country?: string | null
  label?: string | null
}

/** Coordinates a renderer is allowed to trust. */
export function isPlottable(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  )
}

/**
 * Build points from evidence-like items, preferring exact coordinates when
 * present (one precise point each) and falling back to country centroids for the
 * rest. Items with neither are dropped — never invented.
 */
export function pointsFromEvidence(items: GeoLike[]): GlobePoint[] {
  const exact: GlobePoint[] = []
  const countryFallback: Array<string | null | undefined> = []
  for (const it of items) {
    if (isPlottable(it.lat, it.lon)) {
      exact.push({
        lat: it.lat as number,
        lon: it.lon as number,
        label: it.label?.trim() || 'Signal',
        weight: 1,
      })
    } else if (it.country) {
      countryFallback.push(it.country)
    }
  }
  return [...exact, ...pointsFromCountries(countryFallback)]
}
