/**
 * Live broadcasts — the module.
 *
 * Groups verified-live streams by country and computes the figure that makes
 * this an intelligence surface rather than a radio directory: **how many
 * distinct languages a place is broadcasting in right now.**
 *
 * That number is not in any gazetteer. A language census reports what people
 * say they speak; this reports what is actually being transmitted, today, and
 * the two differ in exactly the places where the difference matters.
 *
 * ## Which makes the count worth getting right, and it was not
 *
 * Walked in a real browser against Saudi Arabia, this said **seven** languages
 * and listed `ar · arabi · arabic · العربية · english · filipino · kurdish`.
 * Four of the seven are Arabic. Lowercasing the publisher's string is not the
 * same as identifying a language, and a headline figure built that way is the
 * charter's §2a mistake one level down: a spelling is not a language, exactly
 * as a mirror is not an independent source. `distinctLanguages` decides it now,
 * and the honest answer for that query is four.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerBroadcasts } from '../engine/sources'
import type { Evidence } from '../engine/types'
import type { BroadcastPoint } from '../engine/sources/broadcasts'
import { distinctLanguages } from '../engine/languages'

export interface BroadcastCountry {
  countryIso: string
  country: string
  stations: BroadcastPoint[]
  /** Distinct languages on air from this country in this result. */
  languages: string[]
}

export interface BroadcastsReport {
  generatedAt: string
  query: string
  countries: BroadcastCountry[]
  findings: Evidence[]
  summary: {
    stations: number
    countries: number
    languages: number
    /** How many carry a coordinate, and can therefore be plotted. */
    located: number
    /** How many a listener actually opened in the last day. */
    recentlyOpened: number
    /** How many rest only on evidence older than a day. */
    stale: number
    sourcesOk: number
    sourcesFailed: number
  }
  limits: string[]
}

export async function broadcastsReport(query: string): Promise<BroadcastsReport> {
  registerBroadcasts()
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'broadcasts', value: query }, { registry, mode: 'all' })

  const byCountry = new Map<string, BroadcastPoint[]>()
  const allLanguages = new Set<string>()
  let located = 0
  let recentlyOpened = 0
  let stale = 0

  for (const e of r.evidence) {
    const point = e.data as unknown as BroadcastPoint | undefined
    if (!point?.streamUrl) continue
    const list = byCountry.get(point.countryIso) ?? []
    list.push(point)
    byCountry.set(point.countryIso, list)
    for (const l of distinctLanguages(point.languages)) allLanguages.add(l)
    if (point.lat !== null && point.lon !== null) located += 1
    if (point.liveness.basis === 'opened') recentlyOpened += 1
    if (point.liveness.basis === 'stale') stale += 1
  }

  const countries: BroadcastCountry[] = [...byCountry.entries()]
    .map(([iso, stations]) => ({
      countryIso: iso,
      country: stations[0]?.country ?? iso,
      stations,
      languages: distinctLanguages(stations.flatMap((s) => s.languages)),
    }))
    .sort((a, b) => b.stations.length - a.stations.length)

  const stations = countries.reduce((n, c) => n + c.stations.length, 0)

  return {
    generatedAt,
    query,
    countries,
    findings: r.evidence,
    summary: {
      stations,
      countries: countries.length,
      languages: allLanguages.size,
      located,
      recentlyOpened,
      stale,
      sourcesOk: r.results.filter((s) => s.ok).length,
      sourcesFailed: r.results.filter((s) => !s.ok).length,
    },
    limits: limitsFor(stations, located, recentlyOpened, stale),
  }
}

function limitsFor(
  stations: number,
  located: number,
  recentlyOpened: number,
  stale: number,
): string[] {
  const limits = [
    'Nothing is proxied, recorded or transcribed — these are the broadcasters’ own public URLs, published as they published them.',
    /**
     * The correction that matters most here. The catalogue's own health flag
     * looked authoritative and its timestamps proved to be 217 days old, so
     * "verified live" would have been a claim about January presented as now.
     */
    `Liveness is graded, never assumed: ${recentlyOpened} of ${stations} were opened by a listener within the last day, which is the strongest evidence available. The catalogue's own automated probe has not run recently, so its health flag is used only to exclude known-dead entries — never as proof a stream is up.`,
  ]
  if (stale > 0) {
    limits.push(
      `${stale} rest only on evidence older than a day. They are listed last, labelled with when they last worked, and are not claimed to be on air now.`,
    )
  }
  if (stations === 0) {
    limits.push(
      'Nothing matched, or nothing that matched was verified live. Both are statements about this query and the catalogue, not about whether the place broadcasts.',
    )
    return limits
  }
  if (located < stations) {
    limits.push(
      `${stations - located} of ${stations} carry no coordinate, so they are listed but cannot be plotted. The catalogue records location per station and many stations do not supply one.`,
    )
  }
  limits.push(
    'A community-maintained catalogue. Coverage is uneven by design — a country with few entries may be under-catalogued rather than quiet, and absence here is never evidence a place is off air.',
  )
  return limits
}
