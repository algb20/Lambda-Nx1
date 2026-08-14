/**
 * The blind-spot map.
 *
 * ## The failure this exists to fix
 *
 * Every platform in this field draws what it found. None draws where it cannot
 * see. So a region with no dots reads as a calm region, when the two states are
 * completely different things:
 *
 *  - **quiet** — sources cover this place and are reporting nothing;
 *  - **dark** — nothing covers this place, so nothing could be reported.
 *
 * A map that renders them identically is not merely incomplete, it is
 * misleading in the most consequential direction. The places with the thinnest
 * coverage are the places where international attention is scarcest, which are
 * disproportionately the places where a warning would matter most. A calm-looking
 * Sahel and a genuinely calm Scandinavia look the same on every competitor's
 * screen.
 *
 * ## What is measured
 *
 * Two different things, kept apart because they answer different questions:
 *
 *  - **Declared coverage** — how many independent origins *claim* this region,
 *    read from the catalogue. Structural: it changes when we add a source.
 *  - **Observed coverage** — how many independent origins actually reported
 *    from it in this window. Behavioural: it changes hour to hour.
 *
 * The gap between them is the finding. Ten sources claiming a region and none
 * reporting from it is not proof of quiet; it is a question worth asking, and
 * the whole point is to ask it on screen rather than let a reader assume.
 *
 * ## What this never does
 *
 * It never converts silence into an event. A dark region produces a *coverage*
 * warning, never a hazard. Manufacturing an event from an absence would be the
 * exact inversion of the rule that absence of evidence is not evidence.
 */
import type { CatalogSource } from '../engine/catalog/types'
import { independenceGroup } from '../engine/catalog/types'

/**
 * Coarse regions.
 *
 * Deliberately coarse. Country-level coverage claims would be mostly false —
 * few sources genuinely cover one country and no other — and a map of 195
 * mostly-empty cells would imply a precision the underlying data does not
 * support. These are the bands at which "who covers this part of the world"
 * is actually answerable.
 */
export type CoverageRegion =
  | 'north-america'
  | 'latin-america'
  | 'europe'
  | 'africa'
  | 'middle-east'
  | 'south-asia'
  | 'east-asia'
  | 'southeast-asia'
  | 'oceania'
  | 'polar'

export const REGION_LABELS: Record<CoverageRegion, string> = {
  'north-america': 'North America',
  'latin-america': 'Latin America & Caribbean',
  europe: 'Europe',
  africa: 'Africa',
  'middle-east': 'Middle East & North Africa',
  'south-asia': 'South Asia',
  'east-asia': 'East Asia',
  'southeast-asia': 'Southeast Asia',
  oceania: 'Oceania',
  polar: 'Polar',
}

/** A representative point per region, for drawing the overlay. */
export const REGION_CENTROIDS: Record<CoverageRegion, { lat: number; lon: number }> = {
  'north-america': { lat: 45, lon: -100 },
  'latin-america': { lat: -15, lon: -60 },
  europe: { lat: 50, lon: 15 },
  africa: { lat: 0, lon: 20 },
  'middle-east': { lat: 28, lon: 45 },
  'south-asia': { lat: 22, lon: 78 },
  'east-asia': { lat: 35, lon: 115 },
  'southeast-asia': { lat: 5, lon: 110 },
  oceania: { lat: -25, lon: 140 },
  polar: { lat: 75, lon: 0 },
}

/**
 * Which region a coordinate falls in.
 *
 * Rectangular bands rather than real borders. That is a real limitation and it
 * is stated rather than hidden: a point near a boundary may land in the
 * neighbouring band. It does not matter for this purpose, because the question
 * is "roughly which part of the world is dark", not "which country is this".
 */
export function regionOfPoint(lat: number, lon: number): CoverageRegion {
  if (lat > 66 || lat < -60) return 'polar'
  if (lon >= -170 && lon < -30) return lat > 12 ? 'north-america' : 'latin-america'
  if (lon >= -30 && lon < 40) {
    if (lat > 35) return 'europe'
    if (lat > 12 && lon > 20) return 'middle-east'
    if (lat > 20) return 'middle-east'
    return 'africa'
  }
  if (lon >= 40 && lon < 65) return 'middle-east'
  if (lon >= 65 && lon < 92) return 'south-asia'
  if (lon >= 92 && lon < 130) return lat > 22 ? 'east-asia' : 'southeast-asia'
  if (lon >= 130 && lon <= 180) return lat > 0 ? 'east-asia' : 'oceania'
  return 'oceania'
}

/**
 * ISO country codes mapped to regions, for reading a source's declared
 * coverage. Only the codes that appear in the catalogue — an exhaustive table
 * would be dead weight that drifts out of date.
 */
const COUNTRY_REGION: Record<string, CoverageRegion> = {
  US: 'north-america',
  CA: 'north-america',
  MX: 'north-america',
  GB: 'europe',
  IE: 'europe',
  FR: 'europe',
  DE: 'europe',
  ES: 'europe',
  IT: 'europe',
  NZ: 'oceania',
  AU: 'oceania',
  JP: 'east-asia',
  CN: 'east-asia',
  IN: 'south-asia',
}

export interface RegionCoverage {
  region: CoverageRegion
  label: string
  lat: number
  lon: number
  /** Independent origins that claim to cover this region. */
  declared: number
  /** Independent origins that actually reported from it in this window. */
  observed: number
  /** Reports received, before independence grouping. */
  reports: number
  /**
   * What the two numbers together mean. This is the finding, not the counts.
   */
  status: CoverageStatus
  /** A sentence for the operator. */
  explanation: string
}

/**
 * The four states, and why each is separate.
 *
 *  - `dark`     — nothing covers this region. Silence here means nothing at all.
 *  - `thin`     — one or two origins. A single outage blinds us completely.
 *  - `quiet`    — well covered and reporting nothing. Silence here is evidence.
 *  - `active`   — well covered and reporting.
 *
 * The distinction between `dark` and `quiet` is the entire purpose of this
 * module: they render identically on every other platform in the field.
 */
export type CoverageStatus = 'dark' | 'thin' | 'quiet' | 'active'

/** A source's declared regions, from its catalogue coverage field. */
export function declaredRegions(source: CatalogSource): CoverageRegion[] {
  if (source.coverage === 'global') return Object.keys(REGION_LABELS) as CoverageRegion[]
  return [
    ...new Set(
      source.coverage
        .map((iso) => COUNTRY_REGION[iso.toUpperCase()])
        .filter((r): r is CoverageRegion => Boolean(r)),
    ),
  ]
}

/** An event as this module needs it — only what coverage depends on. */
export interface CoverageObservation {
  lat: number | null
  lon: number | null
  independence: string | null
  sourceKey: string
}

/**
 * Build the coverage picture.
 *
 * `sources` supplies the structural half, `observations` the behavioural half.
 * Both are required: declared coverage alone would call a region covered while
 * every source in it silently failed, and observed coverage alone could not
 * distinguish a quiet hour from a permanent hole.
 */
export function coverageMap(
  sources: CatalogSource[],
  observations: CoverageObservation[],
): RegionCoverage[] {
  const declaredBy = new Map<CoverageRegion, Set<string>>()
  const observedBy = new Map<CoverageRegion, Set<string>>()
  const reportCount = new Map<CoverageRegion, number>()

  for (const region of Object.keys(REGION_LABELS) as CoverageRegion[]) {
    declaredBy.set(region, new Set())
    observedBy.set(region, new Set())
    reportCount.set(region, 0)
  }

  for (const source of sources) {
    const group = independenceGroup(source)
    for (const region of declaredRegions(source)) declaredBy.get(region)?.add(group)
  }

  for (const obs of observations) {
    if (obs.lat == null || obs.lon == null) continue
    const region = regionOfPoint(obs.lat, obs.lon)
    observedBy.get(region)?.add(obs.independence ?? obs.sourceKey)
    reportCount.set(region, (reportCount.get(region) ?? 0) + 1)
  }

  return (Object.keys(REGION_LABELS) as CoverageRegion[])
    .map((region) => {
      const declared = declaredBy.get(region)?.size ?? 0
      const observed = observedBy.get(region)?.size ?? 0
      const reports = reportCount.get(region) ?? 0
      const status = classify(declared, observed)

      return {
        region,
        label: REGION_LABELS[region],
        lat: REGION_CENTROIDS[region].lat,
        lon: REGION_CENTROIDS[region].lon,
        declared,
        observed,
        reports,
        status,
        explanation: explainCoverage(REGION_LABELS[region], declared, observed, status),
      }
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.declared - b.declared)
}

/** Worst first: the regions an operator must not trust appear at the top. */
const STATUS_ORDER: Record<CoverageStatus, number> = { dark: 0, thin: 1, quiet: 2, active: 3 }

/** Below this, one source failing takes the whole region with it. */
const THIN_THRESHOLD = 3

function classify(declared: number, observed: number): CoverageStatus {
  if (declared === 0) return 'dark'
  if (declared < THIN_THRESHOLD) return 'thin'
  return observed > 0 ? 'active' : 'quiet'
}

function explainCoverage(
  label: string,
  declared: number,
  observed: number,
  status: CoverageStatus,
): string {
  switch (status) {
    case 'dark':
      // The sentence that separates this product from the field.
      return `No source in the catalogue covers ${label}. Silence here is not evidence that nothing is happening.`
    case 'thin':
      return `Only ${declared} independent ${declared === 1 ? 'origin' : 'origins'} cover ${label}. One outage would blind us here entirely.`
    case 'quiet':
      return `${declared} independent origins cover ${label} and none reported in this window. Here, silence is evidence.`
    case 'active':
      return `${observed} of ${declared} independent origins reported from ${label} in this window.`
  }
}

/** Headline figures for the map legend. */
export function coverageSummary(map: RegionCoverage[]) {
  return {
    dark: map.filter((r) => r.status === 'dark').length,
    thin: map.filter((r) => r.status === 'thin').length,
    quiet: map.filter((r) => r.status === 'quiet').length,
    active: map.filter((r) => r.status === 'active').length,
    /**
     * The share of the world we can make a defensible statement about. A single
     * honest number to set against a competitor's source count — and the one a
     * reader should actually weigh.
     */
    trustworthyRegions: map.filter((r) => r.status === 'active' || r.status === 'quiet').length,
    totalRegions: map.length,
  }
}
