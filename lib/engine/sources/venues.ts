/**
 * Trading venues — every exchange on earth, and who legally owns it.
 *
 * ## The gap this fills
 *
 * The platform carried a markets board with twenty-six instruments and no
 * concept of a **venue**: no answer to "which exchanges exist in Nigeria", "who
 * owns the Warsaw Stock Exchange", or "is this crypto exchange a registered
 * venue anywhere". Every comparable product either sells venue reference data
 * behind a licence or does not carry it at all.
 *
 * ## The sources, and why these
 *
 * **1. ISO 10383 (the MIC registry).** The registry itself, published by the
 * registration authority. Every exchange, MTF, dark pool, clearing venue and
 * crypto-asset service provider that has ever been assigned a Market
 * Identifier Code — 2,293 active entries across 149 countries at the time of
 * writing. It is the list; there is no more authoritative one to have.
 *
 * **2. CoinGecko's exchange index** for crypto venues, which the MIC registry
 * covers only where a venue has registered under MiCA or an equivalent regime.
 * The two together are the honest picture: regulated venues from the registry,
 * and the far larger unregulated population from a market index that says so.
 *
 * ## The pivot nobody else offers
 *
 * The MIC registry carries the venue's **LEI**, and this platform already holds
 * GLEIF — 2.6 million legal entities with their parent relationships. So a
 * venue here is not a name on a list: it is an entity that can be walked up its
 * ownership chain. "Which exchanges does this group ultimately control" is a
 * question the field answers with a sales call, and it is two joins here.
 *
 * ## What is deliberately not claimed
 *
 * The registry says a venue *exists and is registered*. It does not say the
 * venue is solvent, honest, or currently trading, and this module never implies
 * otherwise. A `CASP` entry means a crypto firm registered under a regime — not
 * that anyone vouched for it.
 */
import type { Evidence, Source } from '../types'
import { countryName } from '../../geo/edge-geo'

export type VenueKind = 'regulated' | 'crypto' | 'other'

export interface VenuePoint {
  /** Market Identifier Code — the venue's globally unique handle. */
  mic: string
  /** The operating MIC, when this entry is a segment of a larger venue. */
  operatingMic: string | null
  name: string
  legalEntity: string | null
  /** Legal Entity Identifier — the join into GLEIF ownership. */
  lei: string | null
  countryIso: string
  city: string | null
  website: string | null
  /** ISO's own category code, e.g. RMKT (regulated market), MLTF (MTF), CASP. */
  categoryCode: string | null
  categoryLabel: string
  kind: VenueKind
  /** Reported 24h volume in BTC, for crypto venues only. */
  volumeBtc: number | null
  /** CoinGecko's own trust grade, 1–10, for crypto venues only. */
  trustScore: number | null
  established: number | null
}

/**
 * ISO's market category codes, in words.
 *
 * The codes are four letters and mean nothing to a reader; carrying the label
 * is the difference between a table and a lookup exercise. Only the categories
 * that actually appear are listed, and an unknown code falls through to itself
 * rather than to "Other" — a category we cannot name is a fact worth showing.
 */
const CATEGORY_LABELS: Record<string, string> = {
  RMKT: 'Regulated market',
  MLTF: 'Multilateral trading facility',
  OTFS: 'Organised trading facility',
  SINT: 'Systematic internaliser',
  ATSS: 'Alternative trading system',
  CASP: 'Crypto-asset service provider',
  DCMS: 'Designated contract market',
  SEFS: 'Swap execution facility',
  IDQS: 'Inter-dealer quotation system',
  RMOS: 'Recognised market operator',
  TRFS: 'Trade reporting facility',
  APPA: 'Approved publication arrangement',
  ARMS: 'Approved reporting mechanism',
  CTPS: 'Consolidated tape provider',
  NSPD: 'Not specified',
  OTHR: 'Other',
}

function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code] ?? code
}

function kindOf(code: string): VenueKind {
  if (code === 'CASP') return 'crypto'
  if (['RMKT', 'MLTF', 'OTFS', 'DCMS', 'SEFS', 'ATSS', 'RMOS'].includes(code)) return 'regulated'
  return 'other'
}

function venueEvidence(point: VenuePoint, sourceKey: string, sourceUrl: string): Evidence {
  const where = [point.city, point.countryIso].filter(Boolean).join(', ')
  return {
    // The MIC is in the claim, not only in the payload: it is the venue's
    // globally unique handle and the thing a reader takes to any other system.
    claim: `${point.name} (${point.mic}) — ${point.categoryLabel}${where ? ` · ${where}` : ''}`,
    entity: { type: 'organization', value: point.legalEntity ?? point.name },
    sourceKey,
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    /**
     * A registry publishing its own register is A/1. The crypto index is not a
     * registry and does not get the same grade — it is a market aggregator's
     * list, which is B/2 at best, and the caller passes that in.
     */
    admiralty: { source: sourceKey === 'iso_mic_registry' ? 'A' : 'B', info: sourceKey === 'iso_mic_registry' ? 1 : 2 },
    confidence: sourceKey === 'iso_mic_registry' ? 'confirmed' : 'probable',
    data: point as unknown as Record<string, unknown>,
  }
}

/**
 * A CSV line reader that respects quoted fields.
 *
 * The registry quotes every field and several legal entity names contain
 * commas — "EURONEXT LONDON LIMITED, BRANCH" — so a `split(',')` silently
 * shifts every subsequent column on exactly the rows that matter most.
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      out.push(field)
      field = ''
    } else field += c
  }
  out.push(field)
  return out
}

/** Split a CSV body into rows, tolerating CRLF and a trailing newline. */
export function parseCsv(body: string): string[][] {
  return body
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine)
}

/**
 * Whether a venue matches a typed query.
 *
 * Substring matching everywhere is wrong for the **country code**, and a test
 * caught it: a two-letter code is short enough to appear inside ordinary words,
 * so searching `ng` matched every venue with "excha**ng**e" in its name — which
 * is most of them. A code is an identifier, not a fragment, so an exact
 * two-letter query is compared against the code and the MIC as whole values.
 * Everything longer is a substring search, which is what a person typing a
 * name or a city expects.
 */
/**
 * How well a venue answers the query — the kinds of match, ranked.
 *
 * `venueMatches` decides *whether* a row is a hit and is deliberately generous,
 * which is right for a filter and useless for an order. Pooling every kind of
 * hit and then sorting alphabetically is what put dealer desks above the
 * exchange they trade on: the venue *named* Tokyo and a venue that merely sits
 * in Tokyo are not equally good answers to "Tokyo".
 *
 * Zero means "matched by something weaker than any of these", which still
 * ranks — below all of them.
 */
export function venueRelevance(v: VenuePoint, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const name = v.name.toLowerCase()
  const legal = (v.legalEntity ?? '').toLowerCase()

  // An exact identifier is not a guess, so nothing outranks it.
  if (v.mic.toLowerCase() === q) return 100
  // A two-letter query is a country code — the rule `venueMatches` already
  // applies — and every hit is then equally a country hit.
  if (/^[a-z]{2}$/.test(q)) return 80
  if (name.startsWith(q)) return 70
  if (legal.startsWith(q)) return 60
  // A whole word beats an accidental substring: "NASDAQ COPENHAGEN" over a
  // company whose name merely contains those letters.
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(name)) return 50
  if (name.includes(q) || legal.includes(q)) return 20
  return 0
}

export function venueMatches(v: VenuePoint, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  if (/^[a-z]{2}$/.test(q)) {
    return v.countryIso.toLowerCase() === q || v.mic.toLowerCase() === q
  }

  return [v.mic, v.name, v.legalEntity, v.countryIso, countryName(v.countryIso), v.city]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q)
}

/** Turn the registry's rows into venues, keeping only what is currently active. */
export function readMicRegistry(body: string, query: string): VenuePoint[] {
  const rows = parseCsv(body)
  if (rows.length < 2) return []
  const header = rows[0].map((h) => h.trim().toUpperCase())
  const at = (row: string[], name: string): string => {
    const i = header.indexOf(name)
    return i >= 0 ? (row[i] ?? '').trim() : ''
  }

  const q = query.trim().toLowerCase()
  const out: VenuePoint[] = []

  for (const row of rows.slice(1)) {
    // Expired and suspended venues are history, not the market as it stands.
    if (at(row, 'STATUS') !== 'ACTIVE') continue

    const mic = at(row, 'MIC')
    if (!mic) continue
    const name = at(row, 'MARKET NAME-INSTITUTION DESCRIPTION')
    const country = at(row, 'ISO COUNTRY CODE (ISO 3166)')
    const city = at(row, 'CITY')
    const legalEntity = at(row, 'LEGAL ENTITY NAME')

    const categoryCode = at(row, 'MARKET CATEGORY CODE')
    const operatingMic = at(row, 'OPERATING MIC')
    const website = at(row, 'WEBSITE')

    const point: VenuePoint = {
      mic,
      // Only meaningful when it differs — otherwise it is the venue itself.
      operatingMic: operatingMic && operatingMic !== mic ? operatingMic : null,
      name: name || mic,
      legalEntity: legalEntity || null,
      lei: at(row, 'LEI') || null,
      countryIso: country,
      city: city || null,
      // The registry stores bare hostnames in upper case.
      website: website ? `https://${website.toLowerCase().replace(/^https?:\/\//, '')}` : null,
      categoryCode: categoryCode || null,
      categoryLabel: categoryLabel(categoryCode),
      kind: kindOf(categoryCode),
      volumeBtc: null,
      trustScore: null,
      established: null,
    }
    // Built first, then matched: `venueMatches` needs the resolved country name.
    if (venueMatches(point, q)) out.push(point)
  }
  return out
}

/**
 * The parsed registry, held in memory for the life of the process.
 *
 * ## Why this cache exists, and the bug that demanded it
 *
 * The first version set `minIntervalMs: 60_000` and re-fetched per query. That
 * looked reasonable for a file republished monthly and was badly wrong for an
 * interactive gateway: the *first* search fetched and worked, and **every
 * search in the next sixty seconds got nothing at all** — the orchestrator
 * skipped the fetch to honour the interval, and the source dutifully returned
 * an empty list. Searching "nigeria" then "saudi arabia" gave two venues and
 * then zero, from the same registry, seconds apart.
 *
 * A 590 KB file that changes monthly should be fetched once and held, not
 * re-fetched and rate-limited. So it is: one network read per process, and
 * every query after that is a filter over memory. The interval drops to
 * something small because it now guards a cache miss rather than every query.
 */
let registryCache: { at: number; venues: VenuePoint[] } | null = null

/** How long the parsed registry stays good. It is republished monthly. */
export const REGISTRY_TTL_MS = 6 * 60 * 60 * 1000

/** Test seam. Never called in production. */
export function resetRegistryCache(): void {
  registryCache = null
}

/**
 * The registry, from the registration authority itself.
 *
 * One 590 KB file rather than a per-query API, because there is no per-query
 * API — and one fetch that answers every question about every venue on earth is
 * a better bargain than a hundred that each answer one.
 */
export const micRegistrySource: Source = {
  key: 'iso_mic_registry',
  capability: 'venues',
  passive: true,
  hosts: ['www.iso20022.org'],
  // Guards a cache miss, not a query: the parsed registry is held in memory.
  minIntervalMs: 1_000,
  async run(input, ctx) {
    const fresh = registryCache && Date.now() - registryCache.at < REGISTRY_TTL_MS
    if (!fresh) {
      const res = await ctx.fetch(
        'https://www.iso20022.org/sites/default/files/ISO10383_MIC/ISO10383_MIC.csv',
      )
      /**
       * Thrown, not swallowed.
       *
       * Returning `[]` here made a blocked or failing fetch indistinguishable
       * from "the registry lists nothing" — the source reported `ok` while
       * contributing no coverage, which is precisely the `empty`-versus-`failed`
       * dishonesty this engine documents at length elsewhere. A source that
       * cannot reach its provider has failed and must say so.
       */
      if (!res.ok) {
        throw new Error(`ISO 10383 registry answered ${res.status}`)
      }
      const body = await res.text()
      if (!body.trim()) throw new Error('ISO 10383 registry returned an empty body')
      registryCache = { at: Date.now(), venues: readMicRegistry(body, '') }
    }

    const q = input.value.trim().toLowerCase()
    const held = registryCache?.venues ?? []
    // The same rule the registry parser uses — one definition, no drift.
    const venues = q ? held.filter((v) => venueMatches(v, q)) : held
    /**
     * Operating venues before their own segments — a reader searching
     * "Euronext" wants the exchange, not its forty order books — and, before
     * that, the venue the query actually names.
     *
     * The second rule was missing, and it showed on the real register:
     * searching **"TOKYO"** returned three Bank of America dealer desks above
     * the **Tokyo Stock Exchange**, because all four sit in Tokyo, all four
     * matched, and `B` sorts before `T`. Alphabetical order is not relevance;
     * it only looks like it when the first answer happens to be right.
     */
    venues.sort((a, b) => {
      const relevance = venueRelevance(b, q) - venueRelevance(a, q)
      if (relevance) return relevance
      if ((a.operatingMic === null) !== (b.operatingMic === null)) return a.operatingMic === null ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return venues
      .slice(0, 300)
      .map((v) =>
        venueEvidence(v, 'iso_mic_registry', 'https://www.iso20022.org/market-identifier-codes'),
      )
  },
}

interface CoinGeckoExchange {
  id?: string
  name?: string
  year_established?: number | null
  country?: string | null
  url?: string
  trust_score?: number | null
  trade_volume_24h_btc?: number | null
}

/**
 * Crypto venues, which the MIC registry only sees once they register.
 *
 * Carried separately and labelled as a market index rather than a registry,
 * because that is what it is: presence here means an aggregator lists the
 * venue, not that any authority has registered or approved it. Conflating the
 * two would be the exact dishonesty the MIC half exists to avoid.
 */
export const cryptoVenuesSource: Source = {
  key: 'coingecko_exchanges',
  capability: 'venues',
  passive: true,
  hosts: ['api.coingecko.com'],
  minIntervalMs: 2_000,
  async run(input, ctx) {
    const res = await ctx.fetch('https://api.coingecko.com/api/v3/exchanges?per_page=100&page=1')
    if (!res.ok) return []
    const rows = (await res.json().catch(() => null)) as CoinGeckoExchange[] | null
    if (!Array.isArray(rows)) return []

    const q = input.value.trim().toLowerCase()
    const out: Evidence[] = []
    for (const row of rows) {
      const name = row.name?.trim()
      if (!name) continue

      const point: VenuePoint = {
        // No MIC: these are not registry entries and must not look like it.
        mic: (row.id ?? name).toUpperCase(),
        operatingMic: null,
        name,
        legalEntity: null,
        lei: null,
        countryIso: row.country ?? '',
        city: null,
        website: row.url ?? null,
        categoryCode: null,
        categoryLabel: 'Crypto exchange (market index, not a registry)',
        kind: 'crypto',
        volumeBtc: typeof row.trade_volume_24h_btc === 'number' ? row.trade_volume_24h_btc : null,
        trustScore: typeof row.trust_score === 'number' ? row.trust_score : null,
        established: typeof row.year_established === 'number' ? row.year_established : null,
      }

      /**
       * The same matching rule the registry half uses.
       *
       * This source had its own substring filter, and a live check caught what
       * that costs: searching `NG` returned sixteen venues across nine
       * countries, because "NG" appears inside plenty of exchange names. One
       * rule for both halves, or the gateway answers the same question two
       * different ways depending on which source replies.
       */
      if (!venueMatches(point, q)) continue

      out.push(
        venueEvidence(point, 'coingecko_exchanges', row.url ?? 'https://www.coingecko.com/en/exchanges'),
      )
    }
    return out
  },
}

export const VENUE_SOURCES: Source[] = [micRegistrySource, cryptoVenuesSource]
