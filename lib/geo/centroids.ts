/**
 * Rough country centroids (lat, lon) for plotting aggregated signals on the 3D
 * globe. Not survey-grade — a representative point per country is all the globe
 * needs. Keys are lowercase; common aliases included (matches GDELT names).
 */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  'united states': [39.8, -98.6], usa: [39.8, -98.6], 'united states of america': [39.8, -98.6],
  'united kingdom': [54, -2.4], uk: [54, -2.4], england: [52.5, -1.5],
  canada: [56.1, -106.3], mexico: [23.6, -102.5], brazil: [-14.2, -51.9], argentina: [-38.4, -63.6],
  france: [46.2, 2.2], germany: [51.2, 10.4], spain: [40.4, -3.7], italy: [41.9, 12.6],
  netherlands: [52.1, 5.3], belgium: [50.5, 4.5], switzerland: [46.8, 8.2], sweden: [60.1, 18.6],
  norway: [60.5, 8.5], poland: [51.9, 19.1], ukraine: [48.4, 31.2], russia: [61.5, 105.3],
  turkey: [38.9, 35.2], turkiye: [38.9, 35.2], greece: [39.1, 21.8], portugal: [39.4, -8.2],
  ireland: [53.4, -8.2], austria: [47.5, 14.6], 'czech republic': [49.8, 15.5], romania: [45.9, 24.9],
  china: [35.9, 104.2], japan: [36.2, 138.3], 'south korea': [35.9, 127.8], india: [20.6, 79],
  pakistan: [30.4, 69.3], indonesia: [-0.8, 113.9], thailand: [15.9, 100.9], vietnam: [14.1, 108.3],
  malaysia: [4.2, 101.9], singapore: [1.35, 103.8], philippines: [12.9, 121.8], bangladesh: [23.7, 90.4],
  'saudi arabia': [23.9, 45.1], 'united arab emirates': [23.4, 53.8], uae: [23.4, 53.8], qatar: [25.3, 51.2],
  israel: [31, 34.9], iran: [32.4, 53.7], iraq: [33.2, 43.7], egypt: [26.8, 30.8], jordan: [30.6, 36.2],
  'south africa': [-30.6, 22.9], nigeria: [9.1, 8.7], kenya: [-0.02, 37.9], morocco: [31.8, -7.1],
  ethiopia: [9.1, 40.5], ghana: [7.9, -1], algeria: [28, 1.7], australia: [-25.3, 133.8],
  'new zealand': [-40.9, 174.9], chile: [-35.7, -71.5], colombia: [4.6, -74.3], peru: [-9.2, -75],
  venezuela: [6.4, -66.6], finland: [61.9, 25.7], denmark: [56.3, 9.5], hungary: [47.2, 19.5],
}

/** Look up a country centroid by (loosely-matched) name. */
export function centroidOf(country: string): [number, number] | null {
  const key = country.trim().toLowerCase()
  return COUNTRY_CENTROIDS[key] ?? null
}

export interface GlobePoint {
  lat: number
  lon: number
  label: string
  weight: number
}

/**
 * Aggregate a list of country names into weighted globe points (one per country,
 * weight = occurrences). Unknown countries are dropped.
 */
export function pointsFromCountries(countries: Array<string | null | undefined>): GlobePoint[] {
  const counts = new Map<string, number>()
  for (const c of countries) {
    if (!c) continue
    const key = c.trim().toLowerCase()
    if (!COUNTRY_CENTROIDS[key]) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([key, weight]) => {
    const [lat, lon] = COUNTRY_CENTROIDS[key]
    return { lat, lon, label: key.replace(/\b\w/g, (m) => m.toUpperCase()), weight }
  })
}

/** An item that may carry exact coordinates and/or a country for globe plotting. */
export interface GeoLike {
  lat?: number | null
  lon?: number | null
  country?: string | null
  label?: string | null
}

/**
 * Build globe points from evidence-like items, preferring exact coordinates when
 * present (one precise point each) and falling back to country centroids for the
 * rest. This lets precise sources (e.g. USGS epicentres) plot exactly while
 * country-level signals still aggregate. Items with neither are dropped.
 */
export function pointsFromEvidence(items: GeoLike[]): GlobePoint[] {
  const exact: GlobePoint[] = []
  const countryFallback: Array<string | null | undefined> = []
  for (const it of items) {
    if (
      typeof it.lat === 'number' &&
      typeof it.lon === 'number' &&
      Number.isFinite(it.lat) &&
      Number.isFinite(it.lon) &&
      Math.abs(it.lat) <= 90 &&
      Math.abs(it.lon) <= 180
    ) {
      exact.push({ lat: it.lat, lon: it.lon, label: it.label?.trim() || 'Signal', weight: 1 })
    } else if (it.country) {
      countryFallback.push(it.country)
    }
  }
  return [...exact, ...pointsFromCountries(countryFallback)]
}
