/**
 * First light — the handful of feeds that can put a true world on screen while
 * the other hundred and sixty are still being read.
 *
 * ## The measurement
 *
 * Profiled on this machine, the world sweep divides like this:
 *
 * | phase | sources | time |
 * |---|---|---|
 * | registering the catalogue | — | 2ms |
 * | `world_events` fan-out | 135 | **2,491ms** |
 * | `news` fan-out | 39 | 565ms |
 *
 * The two run concurrently, so the sweep costs `max(2491, 565)` and the
 * measured layer is the long pole. That corrected a guess written down first —
 * that the *news* half was holding the map hostage, on the strength of a
 * comment in `world-events.ts` saying a slow news provider must not delay the
 * measured layer. The comment describes a real concern and the numbers put it
 * the other way round, so splitting news out would have bought nothing.
 *
 * And note what the 2.5s is *not*: in this environment almost every source is
 * refused, and the slowest single response was 335ms with a median of 26ms.
 * The 2.5s is 135 requests contending with each other over DNS, TLS and
 * parsing — the same self-contention the orchestrator's own concurrency note
 * measured. A shorter list is therefore faster in a way that a faster network
 * would not fix.
 *
 * ## What the split actually buys, measured both ways
 *
 * In process, with module loading already paid, over two runs each:
 *
 * | tier | sources | run 1 | run 2 |
 * |---|---|---|---|
 * | `first-light` | 14 | **365ms** | **773ms** |
 * | `full` | 174 | 2,923ms | 1,999ms |
 *
 * Over HTTP against a freshly started server, each tier measured on its own
 * server so neither pays for the other:
 *
 * | tier | cold | warm |
 * |---|---|---|
 * | `first-light` | **1.76s** | 0.05s |
 * | `full` | 2.43s | 0.10s |
 *
 * The two tables disagree because a cold HTTP request also pays Next.js route
 * compilation and module loading — roughly 1.3s here — which the fast pass
 * cannot avoid. So the honest claim is a **28% faster cold first paint on this
 * machine**, and a 3–5× faster sweep once the process is warm.
 *
 * What this environment cannot tell us is the production figure, and no number
 * is claimed for it. Here almost every source is refused in milliseconds, so
 * the fan-out is a *small* share of a cold request; in production it is 174
 * real providers over a real network and the fan-out is the dominant term,
 * which is the case this list helps most. That is a reasoned expectation, not
 * a measurement, and it stays labelled as one until a deployment says otherwise.
 *
 * ## Why these fourteen
 *
 * The rule is not "the fast ones" — speed is a property of a network on a day,
 * and a list tuned to it would need retuning forever. The rule is **global
 * scope plus a coordinate**: a feed that covers the whole world and publishes
 * where the thing happened.
 *
 * That is what the map is for, and it is what the other 121 cannot give:
 *
 * - **39 are `meteoalarm_*`** — one per European country. Together they are
 *   thorough and individually each is one country's weather warnings, so the
 *   first fourteen marks on a world map should not be thirty-nine requests to
 *   Europe.
 * - **Most of the rest are national or non-geographic** — `bls_us`,
 *   `census_us`, `boj_japan`, `ietf_rfc`, `arxiv_cs`. They belong in the
 *   picture and they do not belong in the first second of it, because they
 *   place nothing on a globe.
 *
 * So this list is the authoritative worldwide hazard record: seismic from four
 * networks, natural events from NASA, disaster alerts from the EU's own
 * aggregator, tropical cyclones from both basins, tsunami, volcano and outbreak.
 *
 * ## What keeps it honest
 *
 * A first-light report is a *partial* report and says so: `tier: 'first-light'`
 * travels on the wire, the KPI strip reads it, and the feed count it shows is
 * the real one — `14 of 174`, not a rounded-up claim of completeness. The full
 * sweep replaces it a second or two later and the count climbs. A two-stage
 * load that hid its first stage would be the same dishonesty as an empty board
 * reporting itself healthy, one layer up.
 */

/**
 * Feeds read in the first pass.
 *
 * Every entry is global in coverage and publishes a coordinate. Adding a
 * regional feed here would slow the first pass without widening the picture,
 * which is the one trade this list exists to refuse.
 */
export const FIRST_LIGHT: ReadonlySet<string> = new Set([
  // Natural events worldwide — fires, storms, floods, volcanoes, ice.
  'nasa_eonet',
  // Seismic, four independent networks. Earthquakes are the events most likely
  // to matter in the first second, and the ones most reliably located.
  'usgs_recent',
  'usgs_quakes_hour',
  'usgs_quakes_day_m25',
  'usgs_quakes_week_significant',
  'emsc_quakes',
  // Disaster alerts, worldwide, with an agency's own severity attached.
  'gdacs',
  'gdacs_alerts',
  // Tropical cyclones, both basins the NHC covers.
  'nhc_atlantic',
  'nhc_pacific',
  // Tsunami warnings — rare, and the single most time-critical thing here.
  'tsunami_gov',
  // Volcanic activity, worldwide weekly report.
  'si_volcano_weekly',
  // Disease outbreaks, worldwide.
  'who_outbreaks',
  // The one national feed in the list, and it earns its place on volume: NWS
  // issues county-level warnings continuously, so it is usually the difference
  // between a first-light map with marks on it and one without.
  'nws_alerts',
])

/** Which pass a report came from. Travels on the wire; the KPI strip reads it. */
export type SweepTier = 'first-light' | 'full'

/**
 * Whether this source belongs in the first pass.
 *
 * A function rather than exposing the set directly, so the orchestrator filter
 * and any future rule (a catalogue flag, say) have one place to change.
 */
export function inFirstLight(sourceKey: string): boolean {
  return FIRST_LIGHT.has(sourceKey)
}
