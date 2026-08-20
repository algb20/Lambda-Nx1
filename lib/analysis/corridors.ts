/**
 * Critical corridors — the places where the world's traffic has no alternative.
 *
 * ## What the field ships, and what it costs
 *
 * The strongest comparable product tracks thirteen maritime chokepoints with
 * **live AIS vessel counts**, week-over-week transit change and density
 * anomalies against a rolling baseline. That is genuinely good, and it is built
 * on a commercial AIS feed behind an API key.
 *
 * We do not have that feed, and charter §2 rule 4 means we will not build a
 * headline capability on a key we cannot guarantee. So the choice is between
 * three options, and only one of them is honest:
 *
 *  1. Buy a key and depend on it — rejected, it is a single point of failure
 *     for a headline number.
 *  2. Show a "vessel count" derived from something else and let the reader
 *     assume it is AIS — this is fabrication, and the charter's entire point.
 *  3. **Watch the corridors with what we genuinely have, and say exactly what
 *     that is and is not.**
 *
 * This is the third. It answers a different question from theirs, and says so:
 * not *how many ships passed*, but **what is happening around this corridor
 * that could stop them** — conflict, weather, infrastructure failure, official
 * warnings, all from sources already in the catalogue, all keyless.
 *
 * ## Why this is worth having even beside a real AIS feed
 *
 * A vessel count tells you a corridor is *already* disrupted: traffic has
 * dropped, the event is in the past. The signals here — a conflict event on the
 * shore, a cyclone warning, a port authority notice — are the causes, and they
 * appear before the count moves. Neither replaces the other, and a reader told
 * plainly which they are looking at can use both.
 *
 * ## What it will never do
 *
 * Never assert that a corridor is closed, disrupted or safe. It reports what
 * was published near it, graded, with the distance from the corridor stated.
 * A corridor with no signals is reported as *unobserved*, never as *clear*.
 */

import { CATEGORY_BEARING, type CountrySignal } from './country-risk'

export interface Corridor {
  key: string
  name: string
  /** What actually passes through, so "critical" is a fact and not an adjective. */
  carries: string
  lat: number
  lon: number
  /**
   * Watch radius in kilometres.
   *
   * Per corridor, not one global constant: the Strait of Malacca is 800 km end
   * to end and the Bosphorus is 31. One radius would either miss half of the
   * first or sweep three countries into the second.
   */
  radiusKm: number
  /** Countries whose territory the corridor touches. */
  states: string[]
}

/**
 * The corridors, with coordinates at the narrowest point rather than the
 * centre of the named body of water — the narrows are what cannot be bypassed.
 */
export const CORRIDORS: Corridor[] = [
  { key: 'hormuz', name: 'Strait of Hormuz', carries: 'Roughly a fifth of global oil and a third of seaborne LNG', lat: 26.57, lon: 56.25, radiusKm: 180, states: ['IR', 'OM', 'AE'] },
  { key: 'bab_el_mandeb', name: 'Bab el-Mandeb', carries: 'The Red Sea approach to Suez — Europe–Asia container and tanker traffic', lat: 12.58, lon: 43.33, radiusKm: 200, states: ['YE', 'DJ', 'ER'] },
  { key: 'suez', name: 'Suez Canal', carries: 'About 12% of world trade, with no sea-level alternative', lat: 30.42, lon: 32.35, radiusKm: 160, states: ['EG'] },
  { key: 'malacca', name: 'Strait of Malacca', carries: 'The main China–Middle East route; a quarter of traded goods', lat: 2.5, lon: 101.4, radiusKm: 400, states: ['MY', 'ID', 'SG'] },
  { key: 'taiwan', name: 'Taiwan Strait', carries: 'Over half of global container traffic passes through or near it', lat: 24.5, lon: 119.5, radiusKm: 300, states: ['TW', 'CN'] },
  { key: 'panama', name: 'Panama Canal', carries: 'Atlantic–Pacific shortcut; draft-limited by freshwater supply', lat: 9.08, lon: -79.68, radiusKm: 140, states: ['PA'] },
  { key: 'bosphorus', name: 'Bosphorus & Dardanelles', carries: 'The only outlet from the Black Sea — Ukrainian and Russian grain and oil', lat: 41.12, lon: 29.07, radiusKm: 130, states: ['TR'] },
  { key: 'gibraltar', name: 'Strait of Gibraltar', carries: 'The Mediterranean’s Atlantic gate, and dense subsea cable landings', lat: 35.95, lon: -5.6, radiusKm: 150, states: ['ES', 'MA'] },
  { key: 'danish_straits', name: 'Danish Straits', carries: 'Baltic export route for Russian crude', lat: 55.7, lon: 11.0, radiusKm: 180, states: ['DK', 'SE'] },
  { key: 'dover', name: 'Strait of Dover', carries: 'The world’s busiest shipping lane, plus power and data interconnectors', lat: 51.0, lon: 1.5, radiusKm: 110, states: ['GB', 'FR'] },
  { key: 'sunda_lombok', name: 'Sunda & Lombok Straits', carries: 'The deep-draft alternative when Malacca is unusable', lat: -8.4, lon: 115.9, radiusKm: 320, states: ['ID'] },
  { key: 'mozambique', name: 'Mozambique Channel', carries: 'The Cape route’s eastern leg when the Red Sea is avoided', lat: -18.0, lon: 41.5, radiusKm: 500, states: ['MZ', 'MG'] },
  { key: 'good_hope', name: 'Cape of Good Hope', carries: 'The fallback for Suez — longer, and beyond anyone’s control to close', lat: -34.36, lon: 18.47, radiusKm: 300, states: ['ZA'] },
  { key: 'kerch', name: 'Kerch Strait', carries: 'The Sea of Azov approach; contested and repeatedly interdicted', lat: 45.3, lon: 36.6, radiusKm: 120, states: ['UA', 'RU'] },
  { key: 'luzon', name: 'Luzon Strait', carries: 'Pacific cable corridor for most Asia–North America internet capacity', lat: 20.5, lon: 121.0, radiusKm: 280, states: ['PH', 'TW'] },
  { key: 'red_sea_cables', name: 'Red Sea cable corridor', carries: 'The majority of Europe–Asia internet capacity, in a narrow seabed lane', lat: 20.0, lon: 38.5, radiusKm: 450, states: ['SA', 'EG', 'SD'] },
]

/**
 * How much a category bears on whether a corridor keeps working.
 *
 * A different question from national stability, so a different table: a cyclone
 * closes a strait and says nothing about governance, while an economic
 * announcement moves a country's stability score and stops no ships.
 */
const TRANSIT_BEARING: Record<string, number> = {
  conflict: 1.0,
  infrastructure: 0.9,
  storm: 0.8,
  transport: 0.8,
  cyber: 0.6,
  energy: 0.6,
  manmade: 0.6,
  volcano: 0.5,
  tsunami: 0.5,
  seismic: 0.4,
  ice: 0.4,
  humanitarian: 0.35,
  flood: 0.3,
  drought: 0.3, // Panama's binding constraint, so never zero
  health: 0.2,
  water: 0.2,
  economy: 0.15,
  wildfire: 0.1,
  world: 0.1,
}

const HALF_LIFE_HOURS = 48

export interface CorridorSignal {
  title: string
  category: string
  categoryLabel: string
  distanceKm: number
  severity: number
  alertLevel: string | null
  at: string
  sourceKey: string
  sourceUrl: string | null
  independence: string | null
}

export interface CorridorWatch {
  corridor: Corridor
  /** 0–100: how much published activity near this corridor bears on transit. */
  pressure: number
  /** Independent origins reporting anything in the watch radius. */
  origins: number
  signals: CorridorSignal[]
  /** Always present. The AIS sentence lives here, on every corridor. */
  limits: string[]
  summary: string
}

/** Great-circle distance in kilometres. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Signals near one corridor, graded for what they mean for transit. */
export function watchCorridor(
  events: Array<CountrySignal & { lat: number | null; lon: number | null }>,
  corridor: Corridor,
  now = Date.now(),
): CorridorWatch {
  const signals: CorridorSignal[] = []
  let raw = 0

  for (const e of events) {
    if (e.lat === null || e.lon === null) continue
    const distanceKm = haversineKm(e.lat, e.lon, corridor.lat, corridor.lon)
    if (distanceKm > corridor.radiusKm) continue

    const bearing = TRANSIT_BEARING[e.category] ?? 0.2
    if (bearing === 0) continue
    const strength = e.severity > 0 ? e.severity : 0.25
    const stamp = Date.parse(e.observedAt ?? e.at)
    const hours = Number.isFinite(stamp) ? (now - stamp) / 3_600_000 : HALF_LIFE_HOURS
    // Nearer matters more, but never to zero at the rim: an event just outside
    // the narrows still closes them.
    const proximity = 1 - 0.5 * (distanceKm / corridor.radiusKm)
    raw += bearing * strength * proximity * Math.pow(0.5, Math.max(0, hours) / HALF_LIFE_HOURS)

    signals.push({
      title: e.title,
      category: e.category,
      categoryLabel: e.categoryLabel,
      distanceKm: Math.round(distanceKm),
      severity: e.severity,
      alertLevel: e.alertLevel,
      at: e.observedAt ?? e.at,
      sourceKey: e.sourceKey,
      sourceUrl: e.sourceUrl,
      independence: e.independence,
    })
  }

  signals.sort((a, b) => b.severity - a.severity || a.distanceKm - b.distanceKm)
  const origins = new Set(signals.map((s) => s.independence ?? `ungrouped:${s.sourceKey}`)).size
  const pressure = Math.round(Math.min(100, 100 * (1 - Math.exp(-raw / 4))))

  return {
    corridor,
    pressure,
    origins,
    signals: signals.slice(0, 25),
    limits: limitsFor(signals.length, origins),
    summary: summarise(pressure, signals.length, origins),
  }
}

/**
 * What this watch cannot tell you.
 *
 * The AIS sentence appears on every corridor without exception, including the
 * quiet ones — a limit disclosed only when it bites is a limit disclosed too
 * late.
 */
function limitsFor(count: number, origins: number): string[] {
  const limits = [
    'No vessel data. We do not carry AIS, so this is not a transit count and never becomes one — it is published activity near the corridor that could affect transit. A corridor can be badly disrupted with nothing here, and busy with signals while shipping runs normally.',
  ]
  if (count === 0) {
    limits.push(
      'Nothing was reported inside the watch radius in this window. Read that as unobserved, not as clear.',
    )
  } else if (origins < 2) {
    limits.push(
      'A single independent origin. One account of a corridor is a lead to check, not a picture of it.',
    )
  }
  return limits
}

function summarise(pressure: number, count: number, origins: number): string {
  if (count === 0) return 'No published activity in the watch radius during this window.'
  if (pressure >= 60) {
    return `Substantial activity bearing on transit — ${count} report${count === 1 ? '' : 's'} from ${origins} independent origin${origins === 1 ? '' : 's'} inside the radius.`
  }
  if (pressure >= 25) {
    return `Some activity that could bear on transit: ${count} report${count === 1 ? '' : 's'} near the corridor.`
  }
  return `Low-level activity near the corridor — ${count} report${count === 1 ? '' : 's'}, none of it strongly transit-bearing.`
}

/** Every corridor, most pressured first. */
export function watchAllCorridors(
  events: Array<CountrySignal & { lat: number | null; lon: number | null }>,
  now = Date.now(),
): CorridorWatch[] {
  return CORRIDORS.map((c) => watchCorridor(events, c, now)).sort((a, b) => b.pressure - a.pressure)
}

/** Re-exported so callers can weight national and transit bearing side by side. */
export { CATEGORY_BEARING }
