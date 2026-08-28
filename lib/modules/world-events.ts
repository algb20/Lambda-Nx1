/**
 * Live world events — the analysis layer behind the world surface.
 *
 * The globe used to be a decoration: a sphere with a graticule and a handful of
 * dots taken from whichever headlines happened to name a country. This module
 * makes it an operations picture. It composes two capabilities:
 *
 *  - `world_events` — measured events with a coordinate (NASA EONET hazards,
 *    USGS seismic). These are instrument or agency observations.
 *  - `news` — reported events (Wikipedia ITN, ReliefWeb, USGS significant).
 *    These carry a country at best, and often no location at all.
 *
 * and produces one graded, deduplicated, ranked picture. Three rules keep it
 * honest, and they are the whole point of the module:
 *
 *  1. **Severity is never invented.** It is derived only where a real measure
 *     exists (earthquake magnitude, fire area, a tsunami flag). Everything else
 *     scores zero and simply does not pulse on the map.
 *  2. **Unplaceable events are shown, not dropped.** A real event with no
 *     coordinate is listed beside the map rather than silently discarded or,
 *     worse, plotted at a guessed location.
 *  3. **Every event keeps its source link, timestamp and Admiralty rating**, so
 *     any dot on the map can be audited back to the agency that measured it.
 */
import { collect } from '../engine/orchestrator'
import {
  registerCatalogSources,
  registerNewsGateway,
  registerWorldEventsGateway,
} from '../engine/sources'
import type { Evidence } from '../engine/types'
import { countryAt, findCountry } from '../geo/atlas'
import { fuseEvents, fusionSummary, type Signal } from '../analysis/fusion'
import { coverageMap, coverageSummary } from '../analysis/blindspots'
import { buildTimeline } from '../analysis/timeline'
import { classifyHeadline } from '../analysis/topic'
import { activeSources } from '../engine/catalog'
import {
  CATEGORY_META,
  REGION_LABEL,
  dedupeEvents,
  believableObservation,
  newestObservation,
  operationalOrder,
  regionOf,
  severityOf,
  untimedCount,
  type EventCategory,
  type Region,
  type FusedEventSummary,
  type SourceHealth,
  type WorldEvent,
  type WorldEventsReport,
} from './world-events-shared'
import { FIRST_LIGHT, type SweepTier } from './first-light'
import { recordSweep } from './self-audit'
import { legibleTitle } from '@/lib/analysis/legible'

/** Worst first, so the states an operator must act on sort to the top. */
const STATUS_ORDER = { failed: 0, empty: 1, cached: 2, ok: 3 } as const

/**
 * How long a completed sweep is served again before another is run.
 *
 * ## Why this exists
 *
 * Every request to `/api/world` ran a fresh fan-out across 174 providers, and
 * every page load makes two of them. That was measurable: driving the browser
 * suite — fifty page visits across five viewports — saturated the server badly
 * enough that the world report stopped arriving inside thirty seconds, and the
 * first diagnosis was a layout bug. Fifty readers would do the same thing to a
 * deployment, and a hundred would do it to the providers.
 *
 * It is also a charter matter, not only a speed one. Section 3 requires us to
 * respect rate limits; asking a national weather service 174 times because 174
 * people opened a page in the same minute is exactly what that rule is about.
 * The per-source cache already spares most providers the actual request — that
 * is why refused sources return in 5ms — but the orchestration still runs, and
 * politeness that depends on every source having declared an interval is not
 * politeness we control.
 *
 * ## Why thirty seconds
 *
 * The browser refreshes every 120s, so a sweep is never asked for more often
 * than that by one reader. Thirty seconds collapses a *burst* — many readers
 * arriving together, or one reader's two-tier bootstrap — into one sweep, while
 * guaranteeing nobody is shown a picture more than half a minute staler than
 * the one they would have got. `generatedAt` is not rewritten, so the age a
 * reader sees is the true age of the sweep and not the age of the cache hit.
 */
export const SWEEP_CACHE_MS = 30_000

/** The last completed sweep per tier, and when it finished. */
const lastSweep = new Map<SweepTier, { at: number; report: WorldEventsReport }>()

/**
 * A sweep already running for this tier.
 *
 * Separate from the cache and just as necessary: without it, ten readers
 * arriving in the same second all miss the cache and all start a fan-out, which
 * is the exact stampede the cache exists to prevent. They share this instead.
 */
const running = new Map<SweepTier, Promise<WorldEventsReport>>()

/** Test seam: forget the memo, so a case can observe a real sweep. */
export function resetSweepCache(): void {
  lastSweep.clear()
  running.clear()
}

// Re-exported so existing importers keep one obvious entry point.
export * from './world-events-shared'

interface RawData {
  lat?: unknown
  lon?: unknown
  country?: unknown
  place?: unknown
  category?: unknown
  categoryLabel?: unknown
  magnitude?: unknown
  magnitudeUnit?: unknown
  tsunami?: unknown
  kind?: unknown
  topics?: unknown
  assignedSeverity?: unknown
  alertLevel?: unknown
  observedAt?: unknown
  statedOffsetMinutes?: unknown
  independence?: unknown
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * A catalogue topic, as an event category.
 *
 * Only the topics that name a *kind of event* appear here. `official`, `news`
 * and `technology` describe where a report came from rather than what happened,
 * and mapping them onto a category would put a central-bank statement and a
 * volcanic eruption in the same bucket — which is roughly what the board was
 * doing before this table existed.
 */
const TOPIC_CATEGORY: Partial<Record<string, EventCategory>> = {
  earthquake: 'seismic',
  volcano: 'volcano',
  wildfire: 'wildfire',
  flood: 'flood',
  storm: 'storm',
  tsunami: 'tsunami',
  drought: 'drought',
  weather: 'storm',
  'air-quality': 'health',
  'space-weather': 'space',
  space: 'space',
  health: 'health',
  displacement: 'humanitarian',
  humanitarian: 'humanitarian',
  // These six used to collapse into `manmade` and `water` because the category
  // list had no word for them. Now that it does, the catalogue's own topics —
  // which have declared them accurately all along — reach the right bucket.
  conflict: 'conflict',
  'cyber-advisory': 'cyber',
  vulnerability: 'cyber',
  malware: 'cyber',
  energy: 'energy',
  // Not `cyber`. RIPE Atlas anchors, OONI measurements and BGP announcements
  // are reachability data; calling 110 routine observations security events
  // would inflate the cyber picture with exactly the noise it must not carry.
  connectivity: 'infrastructure',
  aviation: 'transport',
  // Not `transport` either: the only source declaring `maritime` is NOAA's
  // tide-gauge network, which measures water, not shipping.
  maritime: 'water',
  rail: 'transport',
  economy: 'economy',
  markets: 'economy',
  sanctions: 'economy',
  research: 'research',
  technology: 'research',
}

/**
 * What kind of event this is.
 *
 * ## The bug this replaces
 *
 * The category used to come from `data.category` alone, and almost no source
 * sets it — so **2744 of 2850 events on the live board were filed as `world`**,
 * 96% of everything. The wildfires, the health alerts and the floods were all
 * in there too, invisible behind a single grey bucket, and the board looked
 * like a product that had one category and a rounding error.
 *
 * The information was never missing. Every catalogue record declares its
 * `topics`, and the adapter has been carrying them through in `data.topics` the
 * whole time. Nothing read them.
 *
 * ## Why the *first* matching topic wins
 *
 * A source can declare several — a hazard feed is plausibly `flood`, `storm`
 * and `weather` at once — and the records are written most-specific-first,
 * because that is the order a person naturally lists them in. Taking the first
 * match therefore prefers `flood` over the `weather` that follows it, which is
 * what a reader wants. Sorting or scoring them would be a worse answer arrived
 * at more expensively.
 */
function categorize(e: Evidence, data: RawData): EventCategory {
  const declared = str(data.category)
  if (declared && declared in CATEGORY_META) return declared as EventCategory

  const topics = (Array.isArray(data.topics) ? (data.topics as unknown[]) : []).filter(
    (t): t is string => typeof t === 'string',
  )

  /**
   * The source's declared beat — the first topic that names a kind of event.
   *
   * Written most-specific-first in the records, because that is the order a
   * person naturally lists them in, so the first match is the most informative.
   */
  let beat: EventCategory | undefined
  for (const topic of topics) {
    beat = TOPIC_CATEGORY[topic]
    if (beat) break
  }

  /**
   * Whether the source is a general newsroom, decided by topic **order**.
   *
   * Ten records declare `news` alongside a specific topic, and they are two
   * different kinds of publication that the order already tells apart, because
   * the records are written most-specific-first:
   *
   *  - `['news', 'conflict']` — Middle East Eye, RFE/RL, the Kyiv Independent.
   *    A general newsroom **with a beat**. The beat describes the outlet, not
   *    the item: Middle East Eye publishes conflict reporting and also "Trump
   *    urges Americans to accept higher oil prices", which the beat rule filed
   *    as Armed conflict.
   *  - `['cyber-advisory', 'news']` — Krebs, BleepingComputer, The Hacker News.
   *    A single-subject publication that happens to publish news. Its topic is
   *    authoritative for every item, and an advisory whose headline names no
   *    keyword is still an advisory.
   *
   * So `news` in first position means the headline decides and there is no beat
   * to fall back on — an item a newsroom published that the classifier cannot
   * place is general reporting, and `world` says that honestly. Anywhere else,
   * the declared topic wins and a word in a title must never overrule it.
   */
  const isGeneralNewsroom = topics[0] === 'news'
  const headline = () => classifyHeadline(e.claim ?? '')?.category

  if (isGeneralNewsroom) {
    const read = headline()
    if (read) return read
  } else if (beat) {
    return beat
  }

  // Kept because these two predate the catalogue and carry no topics at all.
  if (e.sourceKey === 'reliefweb') return 'humanitarian'
  if (e.sourceKey.includes('quake')) return 'seismic'

  /**
   * The general newsroom with nothing declared but `news`.
   *
   * Roughly eighty sources are in exactly that position, because that is what
   * they are: one feed carrying an earthquake, a rate decision and a football
   * result. Source-level categorisation has nothing left to say about them, and
   * filing all of it as `world` put 1,512 items — 52% of the board — into one
   * grey bucket with real seismic and health reporting inside it.
   */
  const read = headline()
  if (read) return read

  // Genuinely general reporting. A real category, not a failure — a political
  // headline from a national newsroom *is* world news.
  return 'world'
}

/**
 * Map a source's evidence onto our event shape without inventing anything.
 *
 * Exported for its tests. The mapping is where the engine's vocabulary meets
 * the board's, and the one defect that made every dot on the live map
 * undateable lived exactly here — on one line, invisible from either side.
 */
export function toEvent(e: Evidence, index: number): WorldEvent | null {
  const title = e.claim?.trim()
  if (!title) return null
  const data = (e.data ?? {}) as RawData

  const category = categorize(e, data)

  const lat = num(data.lat)
  const lon = num(data.lon)
  const plottable =
    lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null

  // Resolve the country from the coordinate when we have one (authoritative),
  // and from the source's own country tag otherwise.
  const shape = plottable
    ? countryAt(plottable.lat, plottable.lon)
    : str(data.country)
      ? findCountry(str(data.country)!)
      : null

  const magnitude = num(data.magnitude)
  const unit = str(data.magnitudeUnit)

  // An official alert level is a severity a responsible agency assigned. It
  // outranks anything we could derive, and it is the only severity available for
  // hazards that have no numeric magnitude at all.
  const assigned = num(data.assignedSeverity)
  const severity =
    assigned !== null && assigned > 0
      ? assigned
      : severityOf(category, magnitude, unit, data.tsunami === true)

  /**
   * The headline a reader can act on.
   *
   * Applied here, at the one place every board's title comes from, rather than
   * in four surfaces that would drift. It only ever restates what this record
   * already carries — the category and the measurement — so `八丈島東方沖`
   * becomes "Earthquake M4.7 — 八丈島東方沖" and `CME` becomes "Coronal mass
   * ejection (CME)". The publisher's own words are always kept.
   *
   * The **id** is deliberately still built from the raw `title`: it is an
   * identity, and rewriting it would break every reference to an event whose
   * headline we later learned to expand.
   */
  const readable = legibleTitle({
    title,
    category,
    magnitude,
    magnitudeUnit: unit,
    sourceKey: e.sourceKey,
  })

  return {
    id: `${e.sourceKey}:${index}:${title.slice(0, 60)}`,
    title: readable,
    category,
    categoryLabel: str(data.categoryLabel) ?? CATEGORY_META[category].label,
    color: CATEGORY_META[category].color,
    lat: plottable?.lat ?? null,
    lon: plottable?.lon ?? null,
    country: shape?.name ?? str(data.country),
    countryIso: shape?.iso || null,
    magnitude,
    magnitudeUnit: unit,
    severity,
    alertLevel: str(data.alertLevel),
    at: e.retrievedAt,
    /**
     * Never defaulted to the retrieval time: a feed that published no date
     * yields an event we cannot age, and saying so is the honest answer.
     *
     * `publishedAt` is the canonical field and the only one any source sets
     * today. `data.observedAt` is read after it because the catalogue carried
     * the time in the payload bag for a while, and an archived record replayed
     * from that era must not silently lose its date.
     */
    observedAt: believableObservation(
      str(e.publishedAt) ?? str(data.observedAt),
      Date.parse(e.retrievedAt) || Date.now(),
    )
      ? (str(e.publishedAt) ?? str(data.observedAt))
      : null,
    // Carried from the source's own string by the adapter and the feed parser.
    // Null where a feed stated no zone at all, which is common and honest — the
    // reader is then shown their own time, labelled as theirs.
    observedOffsetMinutes: num(data.statedOffsetMinutes),
    sourceKey: e.sourceKey,
    sourceUrl: e.sourceUrl ?? null,
    independence: str(data.independence),
    admiralty: e.admiralty ?? null,
    confidence: e.confidence,
  }
}

/**
 * A world event as a fusion signal.
 *
 * The independence group is what fusion counts, and it travels on the evidence
 * from the catalogue record. Falling back to the source key is correct rather
 * than lossy: a source that declares no group **is** its own group.
 */
function toSignal(event: WorldEvent): Signal {
  return {
    id: event.id,
    title: event.title,
    independence: event.independence ?? event.sourceKey,
    sourceKey: event.sourceKey,
    sourceUrl: event.sourceUrl,
    admiralty: event.admiralty,
    lat: event.lat,
    lon: event.lon,
    observedAt: event.observedAt ?? null,
    receivedAt: event.at,
    magnitude: event.magnitude,
    topic: event.category,
  }
}

/**
 * Build the live picture. Returns whatever the reachable sources gave us.
 *
 * `tier` chooses how much of the world to read before answering:
 *
 * - **`full`** (the default) reads all 174 feeds. Profiled here at ~2.5s for
 *   the measured half and ~0.6s for news, run concurrently.
 * - **`first-light`** reads the fourteen worldwide hazard authorities only —
 *   see `first-light.ts` for why those fourteen and not the other 121. It is
 *   for the first paint, and the report it returns says so on the wire.
 *
 * The two tiers run the *same* code, so a first-light report is a smaller
 * picture and never a differently-shaped one: the same fusion, the same
 * coverage model, the same honesty about what refused. That mattered more than
 * any speed: a bootstrap path that took a shortcut through the analysis would
 * put a picture on screen that the full sweep then contradicts.
 */
export async function getWorldEvents(
  opts: { tier?: SweepTier } = {},
): Promise<WorldEventsReport> {
  const tier: SweepTier = opts.tier ?? 'full'

  const cached = lastSweep.get(tier)
  if (cached && Date.now() - cached.at < SWEEP_CACHE_MS) return cached.report

  const already = running.get(tier)
  if (already) return already

  const run = runSweep(tier)
    .then((report) => {
      // Recorded only on success. Caching a thrown sweep would turn one bad
      // minute into thirty seconds of guaranteed failure for everyone.
      lastSweep.set(tier, { at: Date.now(), report })
      return report
    })
    .finally(() => running.delete(tier))
  running.set(tier, run)
  return run
}

/** One sweep, with no caching of its own. Everything above decides when to call it. */
async function runSweep(tier: SweepTier): Promise<WorldEventsReport> {
  registerWorldEventsGateway()
  registerNewsGateway()
  // The declarative catalogue: dozens of official hazard, health and advisory
  // feeds that would otherwise each need a module of their own.
  registerCatalogSources()

  /**
   * Two capabilities, run concurrently.
   *
   * The comment here used to say a slow news provider must not delay the
   * measured layer the map depends on. That is the right concern and the
   * profile puts it the other way round — 135 measured feeds at 2,491ms against
   * 39 news feeds at 565ms — so concurrency protects *news* from the map, not
   * the map from news. Stated correctly because the wrong version nearly bought
   * a bootstrap tier that would have saved nothing.
   *
   * On the first-light pass the news half is skipped outright rather than
   * filtered: nothing in it is a global feed with a coordinate, so it can
   * contribute no mark to the first map, and asking anyway would spend 565ms to
   * add rows a reader has not scrolled to yet.
   */
  const [measured, reported] = await Promise.all([
    collect(
      { capability: 'world_events', value: '' },
      { mode: 'all', ...(tier === 'first-light' ? { only: FIRST_LIGHT } : {}) },
    ),
    tier === 'first-light'
      ? Promise.resolve({ capability: 'news' as const, value: '', evidence: [], results: [] })
      : collect({ capability: 'news', value: '' }, { mode: 'all' }),
  ])

  const results = [...measured.results, ...reported.results]
  const all = [...measured.evidence, ...reported.evidence]
    .map(toEvent)
    .filter((e): e is WorldEvent => e !== null)

  /**
   * Fusion, then deduplication.
   *
   * `dedupeEvents` removes byte-identical repeats — the same feed read twice.
   * Fusion does the harder thing: it recognises that a USGS solution, an EMSC
   * solution and three wire stories describe **one** earthquake, and presents
   * them as one event carrying five pieces of evidence.
   *
   * The order matters. Fusing first would waste work on exact duplicates;
   * deduplicating first leaves fusion the real question — which distinct
   * reports are the same event.
   */
  const deduped = dedupeEvents(all)
  const signals = deduped.map(toSignal)
  const fused = fuseEvents(signals)
  const fusion = fusionSummary(signals, fused)

  /**
   * The fused picture as the browser receives it.
   *
   * Mapped field by field rather than passed straight through, so the wire
   * contract is a decision rather than an accident of the engine's internals.
   * What travels is exactly what an audit needs: who reported it, which
   * independence group they belong to, how they are rated, and both times. What
   * does not travel is the engine's own working — per-signal coordinates and
   * topics that the interface never reads and that would double the payload of
   * the busiest response the app makes.
   */
  const fusedSummaries: FusedEventSummary[] = fused.map((f) => ({
    id: f.id,
    title: f.title,
    lat: f.lat,
    lon: f.lon,
    observedAt: f.observedAt,
    lastReceivedAt: f.lastReceivedAt,
    magnitude: f.magnitude,
    independentSources: f.independentSources,
    origins: f.origins,
    contradictions: f.contradictions,
    signals: f.signals.map((s) => ({
      id: s.id,
      title: s.title,
      sourceKey: s.sourceKey,
      sourceUrl: s.sourceUrl ?? null,
      independence: s.independence,
      admiralty: s.admiralty ?? null,
      observedAt: s.observedAt ?? null,
      receivedAt: s.receivedAt,
      magnitude: s.magnitude ?? null,
    })),
    basis: f.basis,
  }))

  /**
   * Where we cannot see.
   *
   * Built from the catalogue's declared coverage and this run's observations
   * together, because neither alone is enough: declared coverage would call a
   * region covered while every source in it silently failed, and observed
   * coverage could not tell a quiet hour from a permanent hole.
   */
  const coverage = coverageMap(
    activeSources(),
    deduped.map((e) => ({
      lat: e.lat,
      lon: e.lon,
      independence: e.independence,
      sourceKey: e.sourceKey,
    })),
  )
  const events = deduped.filter((e) => e.lat !== null && e.lon !== null).sort(operationalOrder)
  const unplaceable = deduped.filter((e) => e.lat === null || e.lon === null).sort(operationalOrder)

  const counts = new Map<EventCategory, number>()
  for (const e of deduped) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
  const categories = [...counts.entries()]
    .map(([category, count]) => ({
      category,
      label: CATEGORY_META[category].label,
      color: CATEGORY_META[category].color,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  const byCountry = new Map<string, { country: string; iso: string; count: number }>()
  for (const e of deduped) {
    if (!e.country) continue
    const key = e.countryIso || e.country
    const existing = byCountry.get(key)
    if (existing) existing.count += 1
    else byCountry.set(key, { country: e.country, iso: e.countryIso ?? '', count: 1 })
  }
  const hotspots = [...byCountry.values()]
    .map((c) => {
      const shape = findCountry(c.iso || c.country)
      return shape ? { ...c, lat: shape.centroid.lat, lon: shape.centroid.lon } : null
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const regionCounts = new Map<Region, number>()
  for (const e of events) {
    const r = regionOf(e.lat as number, e.lon as number)
    regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1)
  }
  const regions = [...regionCounts.entries()]
    .map(([region, count]) => ({ region, label: REGION_LABEL[region], count }))
    .sort((a, b) => b.count - a.count)

  // Per-source health. A board that quietly loses a feed is worse than one that
  // says it lost it — an operator has to know the map is incomplete.
  //
  // The count is what makes this honest. `r.ok` only means the adapter did not
  // throw, so a provider answering 200 with an empty result set used to report
  // green while contributing nothing: the globe drew a bare sphere with every
  // source healthy and no explanation on screen. Answering and contributing are
  // different facts and are now reported as different states.
  const contributed = new Map<string, number>()
  for (const r of results) contributed.set(r.sourceKey, 0)
  for (const e of [...events, ...unplaceable]) {
    contributed.set(e.sourceKey, (contributed.get(e.sourceKey) ?? 0) + 1)
  }
  const sourceHealth: SourceHealth[] = results
    .map((r) => {
      const count = contributed.get(r.sourceKey) ?? 0
      return {
        sourceKey: r.sourceKey,
        status: !r.ok
          ? ('failed' as const)
          : count === 0
            ? ('empty' as const)
            : // Contributed, but from the last answer rather than a fresh fetch.
              r.cached
              ? ('cached' as const)
              : ('ok' as const),
        count,
        error: r.error ?? null,
        cacheAgeMs: r.cacheAgeMs ?? null,
        durationMs: r.durationMs ?? null,
        ok: r.ok,
      }
    })
    // Worst first: failures need attention, then the quiet feeds, then the
    // healthy ones nobody has to look at.
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.sourceKey.localeCompare(b.sourceKey),
    )

  /**
   * The newest thing a **publisher** said happened — not the newest thing we
   * fetched.
   *
   * This reduced over `e.at` until it was measured on a running board. `at` is
   * `retrievedAt`, our own clock stamped on the record as it arrived, so the
   * figure was arithmetically incapable of being anything but the present
   * moment. Every surface reading it — the board header, the pinned gateways,
   * the standing brief's "Newest", and the live-edge figure in the KPI strip —
   * printed a confident **just now** over a run whose freshest item was three
   * hours old and whose oldest was from the previous day.
   *
   * The field's own documentation says it answers "is this live?". Read from
   * the retrieval clock it answered nothing: it restated that we had just made
   * a request, which is never in doubt.
   *
   * Both figures live in `world-events-shared` so they can be tested without
   * running a sweep — an inlined reducer is exactly how the wrong field went
   * unnoticed.
   */
  const newestAt = newestObservation(deduped)
  const untimed = untimedCount(deduped)

  // The sweep's own outcome, written to the platform's record of itself. Not
  // awaited: this is bookkeeping about a sweep, and it must never be able to
  // delay or fail the sweep's actual result. See lib/modules/self-audit.ts —
  // over months, this is what lets a source's declared rating be checked
  // against what it has really done.
  void recordSweep(sourceHealth).catch(() => {
    // Deliberately silent. A failed observation write is a gap in our own
    // record, which the audit already reports as such; escalating it here
    // would put a bookkeeping error in front of an operator watching a map.
  })

  return {
    generatedAt: new Date().toISOString(),
    tier,
    events,
    unplaceable,
    categories,
    regions,
    hotspots,
    sourceHealth,
    /**
     * The fused picture: distinct events rather than distinct reports.
     *
     * Reported alongside the raw events rather than replacing them, because a
     * reader auditing a claim needs the individual reports, and an operator
     * reading the map needs the events. Both are true; they answer different
     * questions.
     */
    fused: fusedSummaries,
    fusion,
    coverage,
    coverageSummary: coverageSummary(coverage),
    /**
     * The board's own history: is this week worse than last?
     *
     * Built from the deduplicated events rather than the raw reports, so a
     * story carried by twenty feeds is one bar-unit and not twenty. Plotting
     * reports would make a busy news cycle indistinguishable from a busy world.
     */
    timeline: buildTimeline(deduped),
    summary: {
      total: deduped.length,
      placed: events.length,
      /**
       * The newest time a *publisher* stated, or null when nobody stated one.
       * Never our retrieval clock — see the reducer above for what that cost.
       */
      newestAt,
      untimed,
      sources: results.map((r) => r.sourceKey),
      // Counted from the graded health, so "ok" means contributed — not merely
      // "did not throw". A summary that counts empty feeds as healthy is how an
      // empty map ends up reporting that everything is fine.
      sourcesOk: sourceHealth.filter((s) => s.status === 'ok').length,
      sourcesEmpty: sourceHealth.filter((s) => s.status === 'empty').length,
      sourcesFailed: sourceHealth.filter((s) => s.status === 'failed').length,
    },
  }
}
