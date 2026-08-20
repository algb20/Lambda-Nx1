/**
 * The parts of the world-events model that the browser needs.
 *
 * Split out of `world-events.ts` deliberately: that module imports the engine
 * orchestrator, which reaches `node:crypto` through the guardrail, and a client
 * component importing so much as a type from it drags the whole chain into the
 * browser bundle and fails the build. Everything here is pure — types, the
 * category palette, severity and region maths — so both sides can share it.
 */
import type { Admiralty, Confidence } from '../engine/types'
import type { Timeline } from '../analysis/timeline'
import { countBySource, rarityOf, rarityReason } from '../analysis/significance'

/**
 * What kind of thing an event is.
 *
 * ## Why this list grew
 *
 * It was written for a natural-hazard map, and it showed: fourteen of the
 * eighteen original members named a way the planet can hurt you, and every
 * human event in the world had to fit into `manmade` or `world`. The platform
 * meanwhile grew central banks, statistical agencies, cyber advisories,
 * sanctions, research publishers and eighty newsrooms — so on the live board
 * **`world` reached 54% of everything**, with `manmade` a distant second, and a
 * reader looking at the legend learned nothing.
 *
 * That is not a classifier failing. It is a vocabulary that has no word for
 * what the sources are actually publishing. A category you cannot express is
 * indistinguishable from one you cannot detect, and no amount of cleverness
 * downstream recovers it.
 *
 * The six added here — conflict, economy, cyber, energy, research, transport —
 * are each named by the catalogue's own `topics` on records we already carry.
 * Nothing speculative was added: if no source declares it, it is not here.
 *
 * `world` survives, and is meant to. A general political headline genuinely is
 * world news, and the goal was never to empty the bucket — it was to stop
 * earthquakes, outbreaks and armed conflict from hiding inside it.
 */
export type EventCategory =
  | 'seismic'
  | 'wildfire'
  | 'storm'
  | 'volcano'
  | 'flood'
  | 'drought'
  | 'landslide'
  | 'ice'
  | 'dust'
  | 'temperature'
  | 'manmade'
  | 'water'
  | 'natural'
  | 'tsunami'
  | 'health'
  | 'space'
  | 'humanitarian'
  | 'conflict'
  | 'economy'
  | 'cyber'
  | 'energy'
  | 'research'
  | 'transport'
  | 'infrastructure'
  | 'world'

/**
 * One place for a category's label and colour, so the legend, the filter chips
 * and the dots on the canvas can never disagree about what red means.
 *
 * The palette is not arbitrary. Geophysical hazards keep the warm end, water
 * and ice keep the blues, and the six human categories take hues that were
 * unused — so a reader who has learned that orange means earthquake does not
 * have to relearn it, and the new categories are separable from the old at a
 * glance rather than only in the legend.
 */
export const CATEGORY_META: Record<EventCategory, { label: string; color: string }> = {
  seismic: { label: 'Earthquake', color: '#f97316' },
  wildfire: { label: 'Wildfire', color: '#ef4444' },
  storm: { label: 'Severe storm', color: '#38bdf8' },
  volcano: { label: 'Volcano', color: '#dc2626' },
  flood: { label: 'Flood', color: '#3b82f6' },
  drought: { label: 'Drought', color: '#d97706' },
  landslide: { label: 'Landslide', color: '#a16207' },
  ice: { label: 'Ice & snow', color: '#7dd3fc' },
  dust: { label: 'Dust & haze', color: '#ca8a04' },
  temperature: { label: 'Temperature extreme', color: '#f43f5e' },
  manmade: { label: 'Man-made', color: '#94a3b8' },
  water: { label: 'Water', color: '#22d3ee' },
  natural: { label: 'Natural event', color: '#22c55e' },
  tsunami: { label: 'Tsunami', color: '#0ea5e9' },
  health: { label: 'Health emergency', color: '#14b8a6' },
  space: { label: 'Space', color: '#64748b' },
  humanitarian: { label: 'Humanitarian', color: '#eab308' },
  conflict: { label: 'Armed conflict', color: '#b91c1c' },
  economy: { label: 'Economy & markets', color: '#10b981' },
  cyber: { label: 'Cyber', color: '#8b5cf6' },
  energy: { label: 'Energy & power', color: '#fbbf24' },
  research: { label: 'Science & research', color: '#6366f1' },
  transport: { label: 'Transport', color: '#f472b6' },
  // Network reachability and routing: RIPE Atlas, OONI censorship measurement,
  // BGP announcements. Kept apart from `cyber` deliberately — an internet
  // outage is not an attack, and filing measurement data as a security event
  // would inflate the cyber picture with 110 routine observations.
  infrastructure: { label: 'Networks & infrastructure', color: '#0d9488' },
  world: { label: 'World news', color: '#cbd5e1' },
}

export interface WorldEvent {
  id: string
  title: string
  category: EventCategory
  categoryLabel: string
  color: string
  lat: number | null
  lon: number | null
  country: string | null
  countryIso: string | null
  magnitude: number | null
  magnitudeUnit: string | null
  /** 0–1, from a real measurement or an agency's own alert level. 0 = neither. */
  severity: number
  /** The issuing agency's alert wording, where there was one ("Red", "Severe"). */
  alertLevel: string | null
  /** When we received it. Always known. */
  at: string
  /**
   * When the world event happened, if the source said so.
   *
   * Separate from `at` because they answer different questions and collapsing
   * them is how late detection in a thin region comes to look like a
   * fast-moving situation. Null means the source published no time — never
   * "now".
   */
  observedAt: string | null
  /**
   * The UTC offset the source itself stated, in minutes east of UTC.
   *
   * `+09:00` on a Japanese bulletin is not formatting — it is the agency saying
   * the event happened at that hour *where it happened*, which is the hour every
   * other account of it will use. `observedAt` normalises to an instant and
   * would otherwise throw that away. Null means the source stated no zone, and
   * the reader is shown their own, labelled as theirs; a zone guessed from a
   * country is wrong for every country wide enough to have more than one.
   */
  observedOffsetMinutes?: number | null
  sourceKey: string
  sourceUrl: string | null
  /**
   * The independence group this source belongs to. Fusion counts groups, not
   * sources, so a story carried by twenty outlets from one wire is one
   * confirmation. Null for sources that predate the catalogue.
   */
  independence: string | null
  admiralty: Admiralty | null
  confidence: Confidence
}

/**
 * What a feed actually did on this run.
 *
 * The distinction between the three states is the entire point, and getting it
 * wrong produced the worst bug this board has had: an `ok` flag that only meant
 * "the adapter did not throw". A provider that answered `200` with an empty
 * result set therefore showed **green** while contributing nothing — so the
 * globe rendered a bare sphere with every source reporting healthy and no
 * explanation anywhere on screen. The map looked broken and the diagnostics
 * insisted it was fine.
 *
 *  - `ok`      — fetched just now, and gave us events. The only state that
 *                earns green.
 *  - `cached`  — deliberately **not** fetched, because the publisher's minimum
 *                interval had not elapsed, and replaying the last answer it
 *                gave. Its own state rather than a shade of `ok`, because the
 *                two answer different questions and merging them would hide how
 *                much of a board is live — which is precisely what an operator
 *                opens this panel to find out.
 *  - `empty`   — answered, gave us nothing. Not a failure (a quiet hour is real)
 *                but not health either: it means this feed is contributing
 *                **no coverage right now**, and the operator must be told.
 *  - `failed`  — did not answer, or answered with an error.
 *
 * `empty` is the state that keeps us honest about blind spots: the absence of
 * events is never evidence that nothing happened.
 */
export type SourceStatus = 'ok' | 'cached' | 'empty' | 'failed'

export interface SourceHealth {
  sourceKey: string
  status: SourceStatus
  /** How many events this feed contributed before deduplication. */
  count: number
  error: string | null
  /** Age of the replayed answer in ms, when `status` is `cached`. */
  cacheAgeMs?: number | null
  /**
   * Kept for callers written against the old shape. It is deliberately *not*
   * the same as `status === 'ok'`: a feed that answered empty reports
   * `ok: true` here (it did answer) and `status: 'empty'` there (it gave
   * nothing). New code should read `status`.
   */
  ok: boolean
}

/**
 * A fused event as the browser sees it.
 *
 * Structurally the subset of `FusedEvent` the interface renders. Declared here
 * rather than imported so a client component can read a report without pulling
 * the fusion engine — and therefore `node:crypto` — into the bundle.
 */
export interface FusedEventSummary {
  id: string
  title: string
  lat: number | null
  lon: number | null
  observedAt: string | null
  lastReceivedAt: string
  magnitude: number | null
  independentSources: number
  origins: string[]
  contradictions: Array<{ field: string; detail: string; between: string[] }>
  /**
   * Every report behind the event, with everything needed to audit it.
   *
   * The interface used to receive only a source key here, which threw away the
   * entire reason fusion is worth doing: a reader who cannot see *who* reported
   * an event, how well each is rated and when each said it, is being asked to
   * take the corroboration count on trust. `id` is the underlying event id, so
   * a dot on the map can be matched to the cluster that contains it.
   */
  signals: Array<{
    id: string
    title: string
    sourceKey: string
    sourceUrl: string | null
    independence: string
    admiralty: Admiralty | null
    observedAt: string | null
    receivedAt: string
    magnitude: number | null
  }>
  /** Why these reports were joined — stated, never hidden. */
  basis: 'single' | 'coordinate' | 'identifier'
}

/**
 * Every event id mapped to the fused cluster that contains its report.
 *
 * The map is keyed by the *signal* id — the id of an individual event on the
 * board — because that is what a reader clicks. One cluster is therefore the
 * value for each of its members, which is the point: clicking any report of an
 * earthquake shows all of them.
 */
export function fusedByEventId(fused: FusedEventSummary[]): Map<string, FusedEventSummary> {
  const index = new Map<string, FusedEventSummary>()
  for (const event of fused) {
    for (const signal of event.signals) index.set(signal.id, event)
  }
  return index
}

/**
 * A region's coverage as the browser sees it. Declared here rather than
 * imported so a client component can read a report without pulling the
 * analysis modules into the bundle.
 */
export interface RegionCoverageSummary {
  region: string
  label: string
  lat: number
  lon: number
  declared: number
  observed: number
  reports: number
  status: 'dark' | 'thin' | 'quiet' | 'active'
  explanation: string
}

export interface WorldEventsReport {
  generatedAt: string
  /** Events with a coordinate — these are what the map draws. */
  events: WorldEvent[]
  /** Real events with no location. Listed, never plotted at a guess. */
  unplaceable: WorldEvent[]
  categories: Array<{ category: EventCategory; label: string; color: string; count: number }>
  /** Plotted events grouped into coarse regions, for the region filter. */
  regions: Array<{ region: Region; label: string; count: number }>
  /** Countries with the most activity right now. */
  hotspots: Array<{ country: string; iso: string; count: number; lat: number; lon: number }>
  /** Per-feed health — a board that quietly loses a source is a lying board. */
  sourceHealth: SourceHealth[]
  /**
   * Daily severity history over the last week.
   *
   * Six bands rather than the five every comparable board shows, because the
   * sixth — `unscored` — is a fact this engine can express and they cannot: an
   * event for which no real measurement existed. Folding those into "low" would
   * draw a calm week out of a week nobody measured.
   */
  timeline: Timeline
  /**
   * The fused picture: distinct **events**, each carrying every report of it.
   *
   * Alongside `events` rather than replacing it, because the two answer
   * different questions. An operator reading the map wants events; a reader
   * auditing a claim wants the individual reports behind one. Typed loosely
   * here so the browser bundle does not have to import the fusion engine to
   * read a report — see `lib/analysis/fusion.ts` for the real shape.
   */
  fused: FusedEventSummary[]
  fusion: {
    signals: number
    events: number
    corroborated: number
    contested: number
    duplicatesRemoved: number
  }
  /**
   * Where we cannot see — the layer no comparable platform draws.
   *
   * A region with no events may be quiet (covered, reporting nothing) or dark
   * (nothing covers it, so nothing could be reported). Every other map renders
   * those identically, which is misleading in the most consequential
   * direction: the thinnest coverage is where international attention is
   * scarcest, which is disproportionately where a warning matters most.
   */
  coverage: RegionCoverageSummary[]
  coverageSummary: {
    dark: number
    thin: number
    quiet: number
    active: number
    trustworthyRegions: number
    totalRegions: number
  }
  summary: {
    total: number
    placed: number
    /** Timestamp of the newest event held, or null. Answers "is this live?". */
    newestAt: string | null
    sources: string[]
    /** Feeds that answered **and contributed** events. */
    sourcesOk: number
    /** Feeds that answered but contributed nothing — coverage gaps, not health. */
    sourcesEmpty: number
    sourcesFailed: number
  }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * Severity from a real measurement, or zero.
 *
 * Earthquakes use moment magnitude on its own logarithmic scale: M2.5 is the
 * feed's floor and M7.5 saturates the display. Fires use burnt area, also
 * logarithmic, saturating around a million acres. A tsunami flag floors the
 * severity high regardless of magnitude, because that is what makes a quake
 * dangerous to people rather than to instruments.
 */
export function severityOf(
  category: EventCategory,
  magnitude: number | null,
  unit: string | null,
  tsunami = false,
): number {
  let severity = 0
  if (category === 'seismic' && typeof magnitude === 'number') {
    severity = clamp01((magnitude - 2.5) / 5)
  } else if (category === 'wildfire' && typeof magnitude === 'number' && magnitude > 0) {
    const acres = unit?.toLowerCase().includes('km') ? magnitude * 247.1 : magnitude
    severity = clamp01(Math.log10(acres + 1) / 6)
  }
  if (tsunami) severity = Math.max(severity, 0.9)
  return Number(severity.toFixed(3))
}

/**
 * Collapse the same real-world event reported by more than one feed. Two events
 * match when they share a category and sit within ~1 km of each other, or when
 * their titles are identical. The survivor is the one with the stronger
 * Admiralty source rating — a sensor reading beats a headline about it.
 */
export function dedupeEvents(events: WorldEvent[]): WorldEvent[] {
  const rank = (e: WorldEvent) => (e.admiralty ? 'FEDCBA'.indexOf(e.admiralty.source) : -1)
  const byKey = new Map<string, WorldEvent>()
  for (const event of events) {
    const key =
      event.lat !== null && event.lon !== null
        ? `${event.category}@${event.lat.toFixed(2)},${event.lon.toFixed(2)}`
        : `title:${event.title.toLowerCase()}`
    const existing = byKey.get(key)
    if (!existing || rank(event) > rank(existing)) byKey.set(key, event)
  }
  return [...byKey.values()]
}

/**
 * The best time we have for an event: when it happened, else when it reached us.
 *
 * The two are kept apart on the record (`observedAt` vs `at`) precisely so they
 * are never confused, but anything that has to place an event on a timeline
 * needs a single number, and "when it happened" is the one that answers an
 * operator's question. Falling back to receipt is not a guess — it is a
 * different, weaker fact, and every surface that uses this fallback says so.
 *
 * Returns NaN when neither parses, so callers can tell "no time" from "epoch".
 */
export function eventTimeMs(event: Pick<WorldEvent, 'observedAt' | 'at'>): number {
  const observed = event.observedAt ? Date.parse(event.observedAt) : Number.NaN
  if (Number.isFinite(observed)) return observed
  return Date.parse(event.at)
}

/** True when the only time we have is our own receipt, not the source's. */
export function timedByReceipt(event: Pick<WorldEvent, 'observedAt' | 'at'>): boolean {
  return !(event.observedAt && Number.isFinite(Date.parse(event.observedAt)))
}

/**
 * Ranking for an operations board.
 *
 * Severity alone is wrong: a red alert from last week outranks a live one, and
 * the board stops looking live. So severity decays with age over a 72-hour
 * half-life. A major quake stays near the top for a day and then makes room, on
 * its own, without anything being deleted.
 *
 * Age is measured from when the event *happened* where the source said so, not
 * from when we received it. Ageing by receipt flatters a slow feed: a bulletin
 * describing a three-day-old flood would arrive scored as brand new and outrank
 * a quake measured an hour ago. Where no observation time was published, receipt
 * is all we have and is used — the honest weaker answer.
 */
export function operationalScore(event: WorldEvent, now = Date.now()): number {
  const ageHours = Math.max(0, (now - eventTimeMs(event)) / 3_600_000)
  const decay = Number.isFinite(ageHours) ? Math.pow(0.5, ageHours / 72) : 0.5
  // The floor keeps a zero-severity but very recent event on the board.
  return (event.severity + 0.05) * decay
}

export function operationalOrder(a: WorldEvent, b: WorldEvent): number {
  const diff = operationalScore(b) - operationalScore(a)
  if (Math.abs(diff) > 1e-9) return diff
  return eventTimeMs(b) - eventTimeMs(a)
}

/** Coarse regions, matching how an operator filters a world board. */
export type Region = 'americas' | 'europe' | 'africa' | 'middle-east' | 'asia-pacific' | 'polar'

export const REGION_LABEL: Record<Region, string> = {
  americas: 'Americas',
  europe: 'Europe',
  africa: 'Africa',
  'middle-east': 'Middle East',
  'asia-pacific': 'Asia Pacific',
  polar: 'Polar',
}

/**
 * Which region a coordinate belongs to. Deliberately simple boxes rather than
 * political boundaries: the filter's job is to cut a busy board down to the part
 * of the world someone is watching, not to adjudicate borders.
 */
export function regionOf(lat: number, lon: number): Region {
  if (lat > 66 || lat < -60) return 'polar'
  if (lon >= -170 && lon < -25) return 'americas'
  if (lon >= 25 && lon <= 63 && lat >= 12 && lat <= 42) return 'middle-east'
  if (lon >= -25 && lon < 40 && lat < 37) return 'africa'
  if (lon >= -25 && lon < 40) return 'europe'
  return 'asia-pacific'
}

// ── The time dimension ──────────────────────────────────────────────────────
//
// A board that only ever shows "now" cannot answer the question an operator
// actually has, which is *how did this get here*. Three reports of an
// earthquake, a flood warning and an evacuation bulletin are one situation
// developing over eighteen hours, and a static snapshot presents them as three
// unrelated dots that happen to share a coastline.
//
// So the surface carries a cursor and a trailing window, and events outside it
// are **removed**, not faded. Dimming is the wrong answer: a dimmed dot still
// occupies its pixels, still catches the eye at the edge of vision, and still
// has to be mentally subtracted by the reader. If an event is outside the
// window under examination it is not part of the picture, and the honest way to
// say that is to not draw it.

/**
 * What slice of time the board is showing.
 *
 * `hours: null` is not "zero hours" — it is the filter switched off, which is
 * the default state. A board that silently hides events the moment it loads
 * would be worse than one with no time control at all.
 */
export interface TimeWindow {
  /** The cursor: the latest moment included, in ms. */
  endMs: number
  /** Length of the trailing window in hours, or null for no time filter. */
  hours: number | null
  /** The newest moment the data reaches, so "now" can be recognised. */
  liveEdgeMs: number
}

/** How far the cursor may be dragged back. Matches the playback span offered. */
export const PLAYBACK_HOURS = 72

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * A timestamp an operator can read, always in UTC.
 *
 * Formatted by hand rather than through `toLocaleString`, because the server and
 * the browser resolve locales differently and a board whose clock changes
 * between render passes is a board nobody can quote in a report. UTC because
 * that is what every agency in the feed publishes in.
 */
export function utcStamp(ms: number): string {
  if (!Number.isFinite(ms)) return 'unknown'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

/** A duration in the words a person would use. Never rounded up into a lie. */
export function humanHours(hours: number): string {
  if (!Number.isFinite(hours)) return 'unknown'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`
  if (hours < 48) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}

/** Is this event inside the window? Events we cannot time are never inside it. */
export function withinWindow(event: Pick<WorldEvent, 'observedAt' | 'at'>, window: TimeWindow): boolean {
  if (window.hours === null) return true
  const t = eventTimeMs(event)
  if (!Number.isFinite(t)) return false
  return t <= window.endMs && t >= window.endMs - window.hours * 3_600_000
}

/** The window in words, so nobody has to infer it from a slider position. */
export function describeWindow(window: TimeWindow): string {
  if (window.hours === null) {
    return 'Every event held, whatever its age — the time filter is off.'
  }
  const live = window.endMs >= window.liveEdgeMs - 60_000
  const span = `${window.hours} hours`
  if (live) return `Events from the ${span} up to now (${utcStamp(window.endMs)}).`
  const behind = humanHours((window.liveEdgeMs - window.endMs) / 3_600_000)
  return `Events from the ${span} up to ${utcStamp(window.endMs)} — ${behind} behind the live edge.`
}

/** Oldest and newest event times held, or null when nothing can be timed. */
export function timeExtent(
  events: Array<Pick<WorldEvent, 'observedAt' | 'at'>>,
): { oldestMs: number; newestMs: number } | null {
  let oldest = Infinity
  let newest = -Infinity
  for (const event of events) {
    const t = eventTimeMs(event)
    if (!Number.isFinite(t)) continue
    if (t < oldest) oldest = t
    if (t > newest) newest = t
  }
  return Number.isFinite(oldest) && Number.isFinite(newest) ? { oldestMs: oldest, newestMs: newest } : null
}

/**
 * Counts per equal slice of a span — the shape of activity over time.
 *
 * Drawn behind the scrub control so the cursor is not dragged blind: a reader
 * can see where in the last three days the reports actually are and go
 * straight there. Counts, not a smoothed curve: every bar is a number of real
 * reports and nothing is interpolated between them.
 */
export function timeHistogram(
  events: Array<Pick<WorldEvent, 'observedAt' | 'at'>>,
  startMs: number,
  endMs: number,
  buckets: number,
): number[] {
  const count = Math.max(1, Math.floor(buckets))
  const out = new Array<number>(count).fill(0)
  const span = endMs - startMs
  if (!Number.isFinite(span) || span <= 0) return out
  for (const event of events) {
    const t = eventTimeMs(event)
    if (!Number.isFinite(t) || t < startMs || t > endMs) continue
    const index = Math.min(count - 1, Math.floor(((t - startMs) / span) * count))
    out[index] += 1
  }
  return out
}

// ── Detection latency ───────────────────────────────────────────────────────
//
// The gap between when the world moved and when we saw it. We hold both times
// for every event, and nothing in this field draws the difference — yet it is
// the single most useful measure of how much a silence is worth. A region whose
// reports habitually arrive six hours late is a region where "nothing reported
// in the last hour" means nothing at all.
//
// It is a measure of *our* pipeline and the source's, never of the event.

/**
 * Minutes between the source's observation time and our receipt.
 *
 * Null where the source published no observation time — the gap is unmeasurable
 * then, and assuming zero would flatter every feed that publishes no dates.
 * Also null where receipt precedes observation: that is a clock disagreement or
 * a forecast timestamp, and a negative latency is not a measurement we can
 * defend.
 */
export function detectionLagMinutes(event: Pick<WorldEvent, 'observedAt' | 'at'>): number | null {
  if (!event.observedAt) return null
  const observed = Date.parse(event.observedAt)
  const received = Date.parse(event.at)
  if (!Number.isFinite(observed) || !Number.isFinite(received)) return null
  const minutes = (received - observed) / 60_000
  return minutes >= 0 ? minutes : null
}

/**
 * The latency bands, with their colours in one place for the same reason
 * `CATEGORY_META` exists: the legend and the dots must never disagree.
 */
export const LAG_BANDS = [
  { key: 'immediate', label: 'Under 15 min', maxMinutes: 15, color: '#22c55e' },
  { key: 'fast', label: '15 min to 1 h', maxMinutes: 60, color: '#a3e635' },
  { key: 'slow', label: '1 to 6 h', maxMinutes: 360, color: '#f59e0b' },
  { key: 'late', label: 'Over 6 h', maxMinutes: Infinity, color: '#ef4444' },
] as const

export type LagBand = (typeof LAG_BANDS)[number]

export function lagBandOf(minutes: number): LagBand {
  return LAG_BANDS.find((band) => minutes < band.maxMinutes) ?? LAG_BANDS[LAG_BANDS.length - 1]
}

export interface LatencyProfile {
  /** Events whose source published an observation time, so the gap is real. */
  timed: number
  /** Events we cannot time — counted and named, never quietly dropped. */
  untimed: number
  medianMinutes: number | null
  bands: Array<{ key: LagBand['key']; label: string; color: string; count: number }>
}

/** The latency layer's own summary. Median, not mean: one very late bulletin
 *  should not describe the whole feed. */
export function latencyProfile(events: Array<Pick<WorldEvent, 'observedAt' | 'at'>>): LatencyProfile {
  const lags: number[] = []
  let untimed = 0
  const counts = new Map<LagBand['key'], number>()
  for (const event of events) {
    const lag = detectionLagMinutes(event)
    if (lag === null) {
      untimed += 1
      continue
    }
    lags.push(lag)
    const band = lagBandOf(lag)
    counts.set(band.key, (counts.get(band.key) ?? 0) + 1)
  }
  lags.sort((a, b) => a - b)
  const median =
    lags.length === 0
      ? null
      : lags.length % 2 === 1
        ? lags[(lags.length - 1) / 2]
        : (lags[lags.length / 2 - 1] + lags[lags.length / 2]) / 2
  return {
    timed: lags.length,
    untimed,
    medianMinutes: median,
    bands: LAG_BANDS.map((band) => ({
      key: band.key,
      label: band.label,
      color: band.color,
      count: counts.get(band.key) ?? 0,
    })),
  }
}

// ── Corroboration ───────────────────────────────────────────────────────────

/**
 * How many independent origins reported an event, as a band with a colour.
 *
 * Counted in origins rather than sources, per §2a: twenty outlets carrying one
 * wire are one confirmation. Contested outranks every count — an event three
 * origins disagree about is not a well-corroborated event, it is an open
 * question, and it must not be drawn in the colour that means "settled".
 */
export const CORROBORATION_BANDS = [
  { key: 'contested', label: 'Origins disagree', color: '#f59e0b' },
  { key: 'strong', label: 'Three or more origins', color: '#22c55e' },
  { key: 'corroborated', label: 'Two independent origins', color: '#38bdf8' },
  { key: 'single', label: 'One origin only', color: '#94a3b8' },
] as const

export type CorroborationBand = (typeof CORROBORATION_BANDS)[number]

export function corroborationBandOf(origins: number, contested: boolean): CorroborationBand {
  if (contested) return CORROBORATION_BANDS[0]
  if (origins >= 3) return CORROBORATION_BANDS[1]
  if (origins === 2) return CORROBORATION_BANDS[2]
  return CORROBORATION_BANDS[3]
}

/**
 * How much corroboration may lift an event's rank.
 *
 * Capped deliberately. Agreement between independent origins raises how much
 * attention a report deserves, but it is not a severity: a minor story carried
 * by five origins must never displace a magnitude 6.5 that only the seismic
 * network has published yet. Four origins is the ceiling, worth +60%, which is
 * less than the difference severity itself makes.
 */
export function corroborationFactor(origins: number): number {
  return 1 + 0.2 * Math.min(3, Math.max(0, origins - 1))
}

// ── The ranked board ────────────────────────────────────────────────────────

export interface RankedEvent {
  event: WorldEvent
  score: number
  /** Hours between when the event happened and the cursor. Null if untimeable. */
  ageHours: number | null
  /** True when that age is measured from our receipt, not the source's clock. */
  byReceipt: boolean
  /** Independent origins that reported it — 1 when only one did. */
  origins: number
  contested: boolean
  /**
   * Why it sits where it sits, in the order the factors contributed. Shown, not
   * kept: an ordering an operator cannot interrogate is an ordering they have
   * to take on faith, and this product exists to be the opposite of that.
   */
  reasons: string[]
}

/**
 * Rank the board.
 *
 * `now` is the **cursor**, not the wall clock. When the reader has scrubbed back
 * to yesterday afternoon, the ranking has to be the ranking as it stood then —
 * decaying against the real present would sink everything on screen uniformly
 * and reorder nothing, which would make playback a slideshow rather than a
 * reconstruction.
 */
export function rankEvents(
  events: WorldEvent[],
  options: { now?: number; fused?: Map<string, FusedEventSummary> } = {},
): RankedEvent[] {
  const now = options.now ?? Date.now()
  /**
   * How much each publisher contributed to *this* run.
   *
   * The correction for a measured failure: 17 of the top 20 rows were one
   * publisher, because NWS issues county-level warnings continuously and each
   * grades to the same 0.75 severity. A source sending forty reports is doing
   * its routine job; a source sending one is saying something it does not say
   * often. See lib/analysis/significance.ts for the full argument.
   */
  const perSource = countBySource(events)

  return events
    .map((event) => {
      const cluster = options.fused?.get(event.id)
      const origins = cluster ? Math.max(1, cluster.independentSources) : 1
      const contested = (cluster?.contradictions.length ?? 0) > 0
      const t = eventTimeMs(event)
      const ageHours = Number.isFinite(t) ? Math.max(0, (now - t) / 3_600_000) : null
      const byReceipt = timedByReceipt(event)

      const reasons: string[] = []
      if (event.alertLevel) reasons.push(`${event.alertLevel} alert from the source`)
      else if (event.magnitude !== null) {
        reasons.push(
          `${event.magnitude}${event.magnitudeUnit ? ` ${event.magnitudeUnit}` : ''} measured`,
        )
      } else if (event.severity > 0) reasons.push(`severity ${event.severity.toFixed(2)} as graded`)
      else reasons.push('no severity graded')

      if (ageHours !== null) {
        reasons.push(byReceipt ? `${humanHours(ageHours)} old by receipt` : `${humanHours(ageHours)} old`)
      } else reasons.push('no usable time')

      if (origins >= 2) reasons.push(`${origins} independent origins agree`)
      else reasons.push('single origin')
      if (contested) reasons.push('origins disagree')

      const fromSource = perSource.get(event.sourceKey) ?? 1
      // Stated on the row: a reader must be able to see that a report sits low
      // because its publisher sent forty of them, not because we judged it
      // unimportant.
      if (fromSource > 3) reasons.push(rarityReason(event.sourceKey, fromSource))

      return {
        event,
        score:
          operationalScore(event, now) * corroborationFactor(origins) * rarityOf(fromSource),
        ageHours,
        byReceipt,
        origins,
        contested,
        reasons,
      }
    })
    .sort((a, b) => {
      const diff = b.score - a.score
      if (Math.abs(diff) > 1e-9) return diff
      // Deterministic tie-breaks: a refresh must not reshuffle the lead event.
      const t = eventTimeMs(b.event) - eventTimeMs(a.event)
      if (Number.isFinite(t) && t !== 0) return t
      return a.event.id.localeCompare(b.event.id)
    })
}
