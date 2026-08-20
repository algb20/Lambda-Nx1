/**
 * Trading venues — the module.
 *
 * Arranges what `lib/engine/sources/venues.ts` returns into the three groups a
 * reader actually distinguishes, and computes the one thing that makes this
 * more than a directory: **how much of the world's venue population we can see,
 * and how much of it can be traced to a legal owner.**
 *
 * ## Why the LEI coverage figure is on the report
 *
 * A venue with an LEI can be walked up its ownership chain through the GLEIF
 * data this platform already holds. A venue without one is a name on a list and
 * stops there. Stating the ratio tells a reader, before they start, how far the
 * question "who owns these" can actually be taken — which no venue directory in
 * the field does.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerVenues } from '../engine/sources'
import type { Evidence } from '../engine/types'
import type { VenueKind, VenuePoint } from '../engine/sources/venues'

export interface VenueGroup {
  key: VenueKind
  title: string
  /** What this group is, in one line. */
  note: string
  venues: VenuePoint[]
}

export interface VenuesReport {
  generatedAt: string
  query: string
  groups: VenueGroup[]
  findings: Evidence[]
  summary: {
    venues: number
    countries: number
    /** How many carry an LEI, and can therefore be traced to an owner. */
    withLei: number
    sourcesOk: number
    sourcesFailed: number
  }
  /** What this gateway does not tell you. Never empty. */
  limits: string[]
}

const GROUPS: Array<{ key: VenueKind; title: string; note: string }> = [
  {
    key: 'regulated',
    title: 'Regulated markets and trading facilities',
    note: 'Venues registered with an authority under a named market category — exchanges, MTFs, OTFs and designated contract markets.',
  },
  {
    key: 'crypto',
    title: 'Crypto venues',
    note: 'Registered crypto-asset service providers from the registry, plus the far larger unregistered population from a market index. The two are labelled separately and must not be read as equivalent.',
  },
  {
    key: 'other',
    title: 'Reporting and market infrastructure',
    note: 'Trade reporting facilities, publication arrangements, consolidated tape providers and venues the registry does not categorise.',
  },
]

export async function venuesReport(query: string): Promise<VenuesReport> {
  registerVenues()
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'venues', value: query }, { registry, mode: 'all' })

  const byKind = new Map<VenueKind, VenuePoint[]>()
  const countries = new Set<string>()
  let withLei = 0

  for (const e of r.evidence) {
    const point = e.data as unknown as VenuePoint | undefined
    if (!point?.mic || !point.name) continue
    const list = byKind.get(point.kind) ?? []
    list.push(point)
    byKind.set(point.kind, list)
    if (point.countryIso) countries.add(point.countryIso)
    if (point.lei) withLei += 1
  }

  const groups: VenueGroup[] = GROUPS.map((g) => ({
    ...g,
    venues: byKind.get(g.key) ?? [],
  })).filter((g) => g.venues.length > 0)

  const venues = groups.reduce((n, g) => n + g.venues.length, 0)

  return {
    generatedAt,
    query,
    groups,
    findings: r.evidence,
    summary: {
      venues,
      countries: countries.size,
      withLei,
      sourcesOk: r.results.filter((s) => s.ok).length,
      sourcesFailed: r.results.filter((s) => !s.ok).length,
    },
    limits: limitsFor(venues, withLei),
  }
}

/**
 * What a venue directory cannot tell you.
 *
 * The first line matters most and is the one a directory never prints: being in
 * the registry means a venue was *registered*, not that it is solvent, honest,
 * or trading today.
 */
function limitsFor(venues: number, withLei: number): string[] {
  const limits = [
    'Registration is not endorsement. A venue appears here because an authority assigned it a code, which says it exists and is registered — not that it is solvent, currently trading, or well run.',
  ]
  if (venues === 0) {
    limits.push('Nothing matched. That is a statement about this query, not about the world.')
    return limits
  }
  if (withLei < venues) {
    limits.push(
      `${venues - withLei} of ${venues} carry no LEI, so their ownership cannot be traced from here. An LEI is what makes "who ultimately controls this venue" answerable.`,
    )
  }
  limits.push(
    'Crypto venues from the market index are not registry entries and are labelled as such. Their presence means an aggregator lists them, and nothing more.',
  )
  return limits
}
