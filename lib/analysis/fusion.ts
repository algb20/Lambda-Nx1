/**
 * The Event Fusion Engine.
 *
 * ## The problem it solves
 *
 * Thirty reports of one earthquake are not thirty events. Every platform in
 * this field renders them as thirty, because each arrived from a different
 * source and nothing downstream knows they are the same thing. The user is left
 * to do the fusing by eye — which is precisely the work they came to be spared.
 *
 * Worse, the count itself misleads. A screen showing thirty entries reads as
 * thirty times more activity than one showing one, when the underlying world is
 * identical. Volume becomes a false severity signal.
 *
 * ## What fusion is, and what it is not
 *
 * It is **clustering with a stated basis**. Signals join one event when they
 * agree on place and time closely enough that no other reading is plausible.
 * The rules are arithmetic, written down, and testable; nothing here is a
 * judgement a model made.
 *
 * It is deliberately **not** semantic matching of headlines. Two reports of
 * "explosion in the capital" on the same day are not evidence of one explosion,
 * and merging them would manufacture a single confident event out of two
 * unrelated ones — a far worse failure than leaving them apart. Where we cannot
 * establish identity, the signals stay separate and say so.
 *
 * ## Why merging is conservative
 *
 * A wrong merge destroys information irreversibly: two events become one, and
 * the second is gone from the picture entirely. A missed merge merely leaves
 * duplicates, which are visible and can be fixed later. So every threshold here
 * errs towards *not* merging, and the asymmetry is the design.
 */
import type { Admiralty } from '../engine/types'

/** One report from one source, before fusion. */
export interface Signal {
  id: string
  title: string
  /** The independence group, not the source key — see `catalog/types.ts`. */
  independence: string
  sourceKey: string
  sourceUrl?: string | null
  publisher?: string
  admiralty?: Admiralty | null
  lat?: number | null
  lon?: number | null
  /** When the world event happened, if the source said. */
  observedAt?: string | null
  /** When we received it. Always known. */
  receivedAt: string
  magnitude?: number | null
  topic?: string
}

/** Signals judged to describe one event. */
export interface FusedEvent {
  /** Stable across runs for the same cluster — see `fusedId`. */
  id: string
  title: string
  lat: number | null
  lon: number | null
  /** Earliest observation: when the world moved, not when we noticed. */
  observedAt: string | null
  /** Latest receipt: when our picture last changed. */
  lastReceivedAt: string
  magnitude: number | null
  signals: Signal[]
  /** How many genuinely independent origins reported it. */
  independentSources: number
  /** Every origin, so a reader can see who agreed. */
  origins: string[]
  contradictions: Contradiction[]
  /** Why these signals were joined — shown to the user, not hidden. */
  basis: FusionBasis
}

export type FusionBasis =
  | 'single' // nothing to fuse
  | 'coordinate' // agreed in space and time
  | 'identifier' // shared an explicit upstream identifier

export interface Contradiction {
  field: 'location' | 'magnitude' | 'time'
  detail: string
  /** The origins that disagree, so the reader can weigh them. */
  between: string[]
}

// ── Thresholds, each with a reason ──────────────────────────────────────────

/**
 * How far apart two reports of one event may be, in kilometres.
 *
 * 100 km is chosen from how location is actually reported rather than from
 * instrument precision: agencies name the nearest settlement, and two agencies
 * naming different settlements for the same earthquake routinely differ by
 * tens of kilometres. Tighter than this and real duplicates survive; much
 * looser and two genuinely separate events in one populated region merge into
 * one — which is the unrecoverable failure.
 */
const MAX_DISTANCE_KM = 100

/**
 * How far apart in time, in minutes.
 *
 * Wide enough for slow reporters — a humanitarian bulletin may describe an
 * event six hours after a seismic network measured it — and narrow enough that
 * two separate events a day apart never merge.
 */
const MAX_TIME_MINUTES = 6 * 60

/** Magnitudes differing by more than this are a contradiction, not noise. */
const MAGNITUDE_DISAGREEMENT = 0.5

/** Great-circle distance in kilometres. */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The best time we have for a signal: what happened, else what we received. */
export function signalTime(signal: Signal): number {
  const observed = signal.observedAt ? Date.parse(signal.observedAt) : NaN
  if (Number.isFinite(observed)) return observed
  return Date.parse(signal.receivedAt)
}

/**
 * Could these two signals be the same event?
 *
 * Requires **both** a coordinate and a time agreement. A signal with no
 * coordinate is never fused on time alone: "something happened somewhere in the
 * last six hours" describes most of the news, and fusing on it would collapse
 * unrelated events into one confident-looking cluster.
 */
export function couldBeSameEvent(a: Signal, b: Signal): boolean {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return false

  const minutesApart = Math.abs(signalTime(a) - signalTime(b)) / 60_000
  if (!Number.isFinite(minutesApart) || minutesApart > MAX_TIME_MINUTES) return false

  return haversineKm(a.lat, a.lon, b.lat, b.lon) <= MAX_DISTANCE_KM
}

/**
 * A stable identifier for a fused event.
 *
 * Derived from where and roughly when it happened, so the *same* real event
 * gets the *same* id on the next run even as new signals arrive. An id that
 * changed run to run would make it impossible to say "this is the event you
 * were already watching", which is what an alert needs to know before it
 * decides whether to fire again.
 *
 * The coordinate is rounded to about a kilometre and the time to the hour: the
 * precision at which two reports of one event agree, rather than the precision
 * at which they are stated.
 */
export function fusedId(lat: number | null, lon: number | null, timeMs: number): string {
  const grid = (n: number) => Math.round(n * 100) / 100
  const hour = Math.floor(timeMs / 3_600_000)
  if (lat == null || lon == null) return `evt:unplaced:${hour}`
  return `evt:${grid(lat)},${grid(lon)}:${hour}`
}

/** Which signal's version of the event to present. */
function bestSignal(signals: Signal[]): Signal {
  // The best-rated source wins, and among equals the one that measured a
  // magnitude — because a source carrying a number observed something, while a
  // source carrying only prose repeated something.
  return [...signals].sort((a, b) => {
    const rank = (s: Signal) => s.admiralty?.source ?? 'F'
    if (rank(a) !== rank(b)) return rank(a) < rank(b) ? -1 : 1
    const hasMag = (s: Signal) => (s.magnitude != null ? 0 : 1)
    if (hasMag(a) !== hasMag(b)) return hasMag(a) - hasMag(b)
    return signalTime(a) - signalTime(b)
  })[0]
}

/**
 * Disagreements between signals in one cluster.
 *
 * Surfaced rather than resolved. Where five sources place an event in one spot
 * and a sixth places it 80 km away, silently taking the majority hides the one
 * fact a reader most needs: that the location is not settled. A platform that
 * quietly picks a winner is making an editorial decision and presenting it as
 * an observation.
 */
export function findContradictions(signals: Signal[]): Contradiction[] {
  const out: Contradiction[] = []
  if (signals.length < 2) return out

  const placed = signals.filter((s) => s.lat != null && s.lon != null)
  if (placed.length >= 2) {
    let worst = 0
    let pair: [Signal, Signal] | null = null
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const d = haversineKm(
          placed[i].lat as number,
          placed[i].lon as number,
          placed[j].lat as number,
          placed[j].lon as number,
        )
        if (d > worst) {
          worst = d
          pair = [placed[i], placed[j]]
        }
      }
    }
    // Half the merge radius: far enough apart to be worth saying, close enough
    // that they were still judged one event.
    if (pair && worst > MAX_DISTANCE_KM / 2) {
      out.push({
        field: 'location',
        detail: `Reported locations differ by ${Math.round(worst)} km`,
        between: [...new Set([pair[0].independence, pair[1].independence])],
      })
    }
  }

  const measured = signals.filter((s) => s.magnitude != null)
  if (measured.length >= 2) {
    const values = measured.map((s) => s.magnitude as number)
    const spread = Math.max(...values) - Math.min(...values)
    if (spread > MAGNITUDE_DISAGREEMENT) {
      out.push({
        field: 'magnitude',
        detail: `Reported magnitudes range from ${Math.min(...values)} to ${Math.max(...values)}`,
        between: [...new Set(measured.map((s) => s.independence))],
      })
    }
  }

  return out
}

/**
 * Fuse signals into events.
 *
 * Single-link clustering: a signal joins a cluster if it could be the same
 * event as **any** member. That is the right shape here because reports of one
 * event form a chain — an agency 60 km from a second, the second 60 km from a
 * third — and requiring agreement with every member would split one real event
 * into fragments.
 *
 * The cost is chaining: a long enough chain of near-misses could in principle
 * link two distant events. The time bound is what makes that acceptable in
 * practice, since a chain must also stay inside one six-hour window.
 */
export function fuseEvents(signals: Signal[]): FusedEvent[] {
  const clusters: Signal[][] = []

  for (const signal of signals) {
    const joined = clusters.find((cluster) => cluster.some((member) => couldBeSameEvent(member, signal)))
    if (joined) joined.push(signal)
    else clusters.push([signal])
  }

  return clusters
    .map((cluster) => {
      const lead = bestSignal(cluster)
      const times = cluster.map(signalTime).filter(Number.isFinite)
      const observedTimes = cluster
        .map((s) => (s.observedAt ? Date.parse(s.observedAt) : NaN))
        .filter(Number.isFinite)

      const origins = [...new Set(cluster.map((s) => s.independence))].sort()

      return {
        // The earliest *observation* names the event, because an event is
        // identified by when it happened, not by when we heard.
        id: fusedId(lead.lat ?? null, lead.lon ?? null, Math.min(...times)),
        title: lead.title,
        lat: lead.lat ?? null,
        lon: lead.lon ?? null,
        observedAt: observedTimes.length ? new Date(Math.min(...observedTimes)).toISOString() : null,
        lastReceivedAt: new Date(
          Math.max(...cluster.map((s) => Date.parse(s.receivedAt)).filter(Number.isFinite)),
        ).toISOString(),
        magnitude: lead.magnitude ?? cluster.find((s) => s.magnitude != null)?.magnitude ?? null,
        signals: cluster,
        // Counted by origin, never by signal: twenty outlets on one wire are
        // one confirmation.
        independentSources: origins.length,
        origins,
        contradictions: findContradictions(cluster),
        basis: cluster.length === 1 ? ('single' as const) : ('coordinate' as const),
      }
    })
    .sort((a, b) => Date.parse(b.lastReceivedAt) - Date.parse(a.lastReceivedAt))
}

/**
 * How much of the picture fusion removed.
 *
 * Worth reporting to the user: "142 reports → 38 events" tells them the screen
 * is a summary of more work than it shows, and it is the honest way to present
 * a number that would otherwise look like less coverage than a rival's.
 */
export function fusionSummary(signals: Signal[], events: FusedEvent[]) {
  const fused = events.filter((e) => e.signals.length > 1)
  return {
    signals: signals.length,
    events: events.length,
    /** Events assembled from more than one report. */
    corroborated: fused.length,
    /** Events where the sources disagree about something. */
    contested: events.filter((e) => e.contradictions.length > 0).length,
    /** Reports absorbed into an event that already existed. */
    duplicatesRemoved: signals.length - events.length,
  }
}
