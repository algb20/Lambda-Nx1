/**
 * Geospatial gateway. Answers "where is this?" from public data: geocode a place
 * name, reverse-geocode coordinates, or read a public live flight state.
 * Passive and lawful — public geospatial data only, no private-individual tracking.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerGeoGateway } from '../engine/sources'
import type { Evidence } from '../engine/types'

const ICAO24 = /^[0-9a-f]{6}$/i
const LATLON = /^\s*-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?\s*$/

export type GeoKind = 'flight' | 'coordinates' | 'place'

/**
 * Said plainly rather than answered with an empty result. An empty list would
 * read as "no such aircraft"; the truth is that we do not ask, because the only
 * public flight source we have requires an agreement we do not hold.
 */
export const FLIGHTS_WITHHELD =
  'Live flight lookup is withheld: OpenSky\'s terms require a prior agreement for commercial use, and Lambda NX does not hold one yet.'

export function classifyGeo(value: string): GeoKind {
  const v = value.trim()
  if (ICAO24.test(v)) return 'flight'
  if (LATLON.test(v)) return 'coordinates'
  return 'place'
}

export interface GeoReport {
  subject: string
  kind: GeoKind
  generatedAt: string
  findings: Evidence[]
  summary: { matches: number; sourcesOk: number; sourcesFailed: number }
}

export async function investigateGeo(input: string): Promise<GeoReport> {
  registerGeoGateway()
  const subject = input.trim()
  if (subject.length < 2) throw new Error('Enter a place or a "lat,lon" pair')
  if (classifyGeo(subject) === 'flight') throw new Error(FLIGHTS_WITHHELD)
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'geo', value: subject }, { registry, mode: 'all' })
  return {
    subject,
    kind: classifyGeo(subject),
    generatedAt,
    findings: r.evidence,
    summary: {
      matches: r.evidence.length,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}
