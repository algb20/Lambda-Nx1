/**
 * Live broadcasts — what the world is putting on air right now.
 *
 * ## Why an intelligence platform carries this
 *
 * It looks like a radio directory and it is not one. Broadcast presence is a
 * public, passive, lawful signal about a place:
 *
 *  - **Which languages a territory actually broadcasts in** — a fact about the
 *    place that no gazetteer states and that a language census gets wrong.
 *  - **Whether a country's stations are reachable at all.** Streams going dark
 *    across a region is observable from outside it, and is one of the few
 *    signals that survives a communications blackout aimed at outbound
 *    reporting.
 *  - **What a population is being told, in its own language, unmediated** —
 *    without a wire service standing between the broadcast and the listener.
 *
 * The catalogue is Radio-Browser: 62,694 stations across 241 countries and 649
 * languages, community-maintained, keyless, and — the part that matters —
 * **continuously health-checked**, so it knows which streams answered and when.
 *
 * ## The honesty problem, and what actually solves it
 *
 * The obvious approach is to trust `lastcheckok`, the catalogue's own health
 * flag, and return only the streams it marks as answering. That is what the
 * first version did — and reading the raw data showed **every check timestamp
 * was 217 days old**. The catalogue's checker had stopped months earlier and
 * the flag it left behind was frozen at whatever it last saw. Presenting that
 * as "verified live" would have been the single most misleading thing this
 * gateway could do.
 *
 * The fix is not a caveat, it is a better signal. `clicktimestamp` records when
 * a listener last *opened* the stream, and those are minutes old. A human
 * successfully playing a stream a few minutes ago is stronger evidence that it
 * works than an automated check from January, so liveness is graded from the
 * freshest evidence available and **the row says which evidence it is**:
 *
 *  - `opened` — a listener played it recently. The strongest claim, and one we
 *    can make about a large share of the catalogue.
 *  - `checked` — the catalogue's own probe answered recently.
 *  - `stale` — the only evidence is old. Listed, labelled, never called live.
 *
 * No row ever says "live" without saying how that is known and how old the
 * knowing is.
 *
 * ## What this never does
 *
 * Never proxies, re-streams, records or transcribes. It publishes the
 * broadcaster's own public stream URL, which is what the broadcaster put on the
 * internet for anyone to open. Re-transmitting it would be a copyright matter
 * and a bandwidth one; recording it would be neither passive nor lawful in
 * several of these jurisdictions.
 */
import type { Evidence, Source } from '../types'
import { countryName } from '../../geo/edge-geo'

export interface BroadcastPoint {
  id: string
  name: string
  /** The broadcaster's own stream URL. Published, never proxied. */
  streamUrl: string
  homepage: string | null
  countryIso: string
  country: string
  /** Sub-national region, where the catalogue records one. */
  state: string | null
  /** Languages as the catalogue records them, already split. */
  languages: string[]
  tags: string[]
  codec: string | null
  /** kbps. 0 means the catalogue does not know, not that it is silent. */
  bitrate: number | null
  /** Whether this is an HLS stream rather than a plain audio one. */
  hls: boolean
  lat: number | null
  lon: number | null
  /** When the catalogue's own probe last saw it answer. Often very old. */
  lastCheckedAt: string | null
  /** When a listener last opened it. Usually the freshest evidence there is. */
  lastOpenedAt: string | null
  /** How many listeners opened it in the last day, as the catalogue counts. */
  clicks: number | null
  /**
   * How we know it works, and therefore how much to trust it.
   *
   * Never absent, so no caller can render a station without its provenance.
   */
  liveness: Liveness
}

export type LivenessBasis = 'opened' | 'checked' | 'stale'

export interface Liveness {
  basis: LivenessBasis
  /** Age in hours of the evidence the basis rests on. */
  ageHours: number
  /** The claim in words, with its age in it. */
  says: string
}

/** Beyond this, evidence of liveness is history rather than news. */
export const LIVE_WITHIN_HOURS = 24

/**
 * Grade how well we know a stream works.
 *
 * Freshest evidence wins, and a listener opening a stream outranks a probe: a
 * human successfully playing audio is a stronger signal than a HEAD request,
 * and in this catalogue it is very often the only recent evidence in existence.
 */
export function assessLiveness(
  openedAt: string | null,
  checkedAt: string | null,
  now = Date.now(),
): Liveness {
  const ageOf = (iso: string | null): number | null => {
    if (!iso) return null
    const t = Date.parse(iso)
    return Number.isFinite(t) ? Math.max(0, (now - t) / 3_600_000) : null
  }
  const opened = ageOf(openedAt)
  const checked = ageOf(checkedAt)

  if (opened !== null && opened <= LIVE_WITHIN_HOURS) {
    return { basis: 'opened', ageHours: opened, says: `a listener opened it ${humanAge(opened)}` }
  }
  if (checked !== null && checked <= LIVE_WITHIN_HOURS) {
    return { basis: 'checked', ageHours: checked, says: `the catalogue's probe answered ${humanAge(checked)}` }
  }

  // Nothing recent. Report the freshest thing we do have, and call it stale.
  const best = [opened, checked].filter((n): n is number => n !== null).sort((a, b) => a - b)[0]
  if (best === undefined) {
    return { basis: 'stale', ageHours: Infinity, says: 'no evidence of when this last worked' }
  }
  const what = best === opened ? 'last opened by a listener' : 'last confirmed by a probe'
  return { basis: 'stale', ageHours: best, says: `${what} ${humanAge(best)} — not known to be working now` }
}

function humanAge(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} minutes ago`
  if (hours < 48) return `${Math.round(hours)} hours ago`
  return `${Math.round(hours / 24)} days ago`
}

interface RawStation {
  stationuuid?: string
  name?: string
  url_resolved?: string
  url?: string
  homepage?: string
  countrycode?: string
  country?: string
  state?: string
  language?: string
  tags?: string
  codec?: string
  bitrate?: number
  hls?: number | boolean
  geo_lat?: number | null
  geo_long?: number | null
  lastcheckok?: number
  lastcheckoktime_iso8601?: string | null
  lastchecktime_iso8601?: string | null
  clicktimestamp_iso8601?: string | null
  clickcount?: number
}

/** Split the catalogue's comma-joined fields, dropping blanks. */
function splitList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Turn catalogue rows into broadcasts, each carrying how we know it works.
 *
 * A station the catalogue has recorded as failing is dropped — a dead entry
 * costs the reader a click to discover. Everything kept is graded rather than
 * asserted: the row says whether a listener opened it minutes ago, a probe
 * answered recently, or the only evidence is months old.
 */
export function readStations(rows: unknown, now = Date.now()): BroadcastPoint[] {
  if (!Array.isArray(rows)) return []
  const out: BroadcastPoint[] = []

  for (const raw of rows as RawStation[]) {
    // Known-failing entries are dropped. This flag is *not* used as evidence of
    // liveness — see the header: its timestamps proved to be 217 days old.
    if (raw.lastcheckok !== 1) continue

    const streamUrl = (raw.url_resolved || raw.url || '').trim()
    const name = (raw.name ?? '').trim()
    if (!streamUrl || !name) continue
    // Only http(s). The catalogue carries the occasional legacy scheme, and a
    // link a browser cannot open is a link that fails in the reader's hands.
    if (!/^https?:\/\//i.test(streamUrl)) continue

    const iso = (raw.countrycode ?? '').trim().toUpperCase()
    const lastCheckedAt = raw.lastcheckoktime_iso8601 ?? raw.lastchecktime_iso8601 ?? null
    const lastOpenedAt = raw.clicktimestamp_iso8601 ?? null
    const liveness = assessLiveness(lastOpenedAt, lastCheckedAt, now)
    // No evidence at all of when it last worked. Not listable as a stream
    // someone might open.
    if (liveness.ageHours === Infinity) continue

    out.push({
      id: raw.stationuuid ?? `${iso}:${name}`,
      name,
      streamUrl,
      homepage: raw.homepage?.trim() || null,
      countryIso: iso,
      country: raw.country?.trim() || countryName(iso) || iso,
      state: raw.state?.trim() || null,
      languages: splitList(raw.language),
      tags: splitList(raw.tags).slice(0, 8),
      codec: raw.codec?.trim() || null,
      // The catalogue writes 0 for "unknown", which is not the same as silent.
      bitrate: typeof raw.bitrate === 'number' && raw.bitrate > 0 ? raw.bitrate : null,
      hls: raw.hls === 1 || raw.hls === true,
      // 0/0 is the catalogue's "no location", and plotting it puts a station in
      // the Gulf of Guinea. Treated as unknown, which is what it is.
      lat: typeof raw.geo_lat === 'number' && raw.geo_lat !== 0 ? raw.geo_lat : null,
      lon: typeof raw.geo_long === 'number' && raw.geo_long !== 0 ? raw.geo_long : null,
      lastCheckedAt,
      lastOpenedAt,
      clicks: typeof raw.clickcount === 'number' ? raw.clickcount : null,
      liveness,
    })
  }

  /**
   * Best-evidenced first, then most-opened.
   *
   * A station a listener played ten minutes ago belongs above one whose only
   * evidence is from January, however popular the second once was. Within a
   * band, listener count is the only ranking signal the catalogue carries that
   * a station cannot self-report.
   */
  const rank: Record<LivenessBasis, number> = { opened: 0, checked: 1, stale: 2 }
  out.sort(
    (a, b) => rank[a.liveness.basis] - rank[b.liveness.basis] || (b.clicks ?? 0) - (a.clicks ?? 0),
  )
  return out
}

/**
 * Which catalogue endpoint answers this query.
 *
 * A two-letter query is a country code, and asking the country endpoint is both
 * faster and more accurate than a name search that would match "GB" inside
 * "Radio GBH". Everything else is a name search, which the catalogue does well.
 */
export function endpointFor(query: string, limit: number): string {
  const q = query.trim()
  const base = 'https://de1.api.radio-browser.info/json/stations'
  const suffix = `?limit=${limit}&hidebroken=true&order=clickcount&reverse=true`

  if (!q) return `${base}/topclick/${limit}`
  if (/^[A-Za-z]{2}$/.test(q)) return `${base}/bycountrycodeexact/${q.toUpperCase()}${suffix}`
  return `${base}/byname/${encodeURIComponent(q)}${suffix}`
}

export const HOW_MANY = 120

export const broadcastsSource: Source = {
  key: 'radio_browser',
  capability: 'broadcasts',
  passive: true,
  hosts: ['de1.api.radio-browser.info'],
  minIntervalMs: 1_000,
  async run(input, ctx) {
    const res = await ctx.fetch(endpointFor(input.value, HOW_MANY), {
      // The catalogue asks callers to identify themselves so it can attribute
      // load. Ours names the product, which is the arrangement they request.
      headers: { 'User-Agent': 'LambdaNX/1.0 (contact@lambdanx.app)' },
    })
    if (!res.ok) throw new Error(`Radio-Browser answered ${res.status}`)

    const stations = readStations(await res.json())
    return stations.map(broadcastEvidence)
  },
}

function broadcastEvidence(b: BroadcastPoint): Evidence {
  const langs = b.languages.length ? ` · ${b.languages.slice(0, 3).join(', ')}` : ''
  return {
    // How we know it works is part of the claim, not a footnote below it.
    claim: `${b.name} — ${b.country}${langs} · ${b.liveness.says}`,
    entity: { type: 'url', value: b.streamUrl },
    sourceKey: 'radio_browser',
    sourceUrl: b.homepage ?? b.streamUrl,
    retrievedAt: new Date().toISOString(),
    /**
     * The freshest evidence that this stream works — which is a listener
     * opening it, far more often than a probe answering. Never the time we read
     * the catalogue.
     */
    publishedAt: b.lastOpenedAt ?? b.lastCheckedAt,
    // A community-maintained catalogue. The grade follows the evidence: a
    // stream someone just played is corroborated by use; one resting on a
    // months-old probe is not, and must not carry the same confidence.
    admiralty: { source: 'B', info: b.liveness.basis === 'stale' ? 4 : 2 },
    confidence: b.liveness.basis === 'stale' ? 'unconfirmed' : 'probable',
    data: b as unknown as Record<string, unknown>,
  }
}

export const BROADCAST_SOURCES: Source[] = [broadcastsSource]
