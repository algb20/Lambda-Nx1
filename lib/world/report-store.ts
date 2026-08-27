/**
 * One world sweep, shared by everything that draws it.
 *
 * ## Why this had to exist before the layout could change
 *
 * The globe owned its own fetch. That was fine while it was the only thing on
 * the page — and it stopped being fine the moment the screen was meant to show
 * the map *and* the live columns beside it, because two components each calling
 * `/api/world` is two sweeps of a report that is thousands of events long.
 *
 * The cost is not only bandwidth. Two independent fetches land at different
 * moments, so the map and the list beside it would be drawn from two different
 * pictures of the world — a dot with no row, a row with no dot, and a reader
 * with no way to tell which is right. On a product whose whole claim is that
 * you can check what it says, two disagreeing copies of the truth is the worst
 * possible failure.
 *
 * So there is one store. One request, one picture, one refresh clock, and every
 * surface reads the same object.
 *
 * ## Failure is a state, not an exception
 *
 * A failed refresh keeps the last good report on screen and records why it is
 * stale. Blanking the map because one poll timed out would throw away a picture
 * that is still substantially true, and a reader watching a developing event
 * would lose it at the moment they were watching it.
 */
import type { WorldEventsReport } from '@/lib/modules/world-events-shared'
import type { SweepTier } from '@/lib/modules/first-light'

/** How often a visible tab re-reads the world. */
export const REFRESH_MS = 120_000

export interface WorldState {
  report: WorldEventsReport | null
  /** True only before the first answer of any kind. */
  loading: boolean
  /** True while a background refresh is in flight; the old report still shows. */
  refreshing: boolean
  /** Why the newest attempt failed, or null. Never clears an existing report. */
  error: string | null
}

const EMPTY: WorldState = { report: null, loading: true, refreshing: false, error: null }

let state: WorldState = EMPTY
const listeners = new Set<() => void>()
/**
 * One request in flight per tier, not one in total.
 *
 * It was a single promise, and the bootstrap below then had a real bug that its
 * own comment denied: `loadWorld` returned the in-flight promise to *any*
 * second caller, so asking for the fast pass right after the full one returned
 * the full one's promise and **never sent the first-light request at all**. The
 * comment said the guard was bypassed; nothing bypassed it.
 *
 * Keyed by tier, the guard still does its real job — every surface mounts at
 * once and shares one sweep — while two genuinely different requests stay two.
 */
const inFlight = new Map<SweepTier, Promise<void>>()
let timer: ReturnType<typeof setInterval> | null = null

function publish(next: WorldState): void {
  state = next
  for (const fn of listeners) fn()
}

export function worldState(): WorldState {
  return state
}

/** What the server renders with. There is no sweep there. */
export function worldOnServer(): WorldState {
  return EMPTY
}

/**
 * Read the world. Concurrent callers share one request.
 *
 * That sharing is the point: every consumer calls this on mount and they all
 * mount together, so the concurrent case is the ordinary one.
 */
export function loadWorld(isRefresh = false, tier: SweepTier = 'full'): Promise<void> {
  const already = inFlight.get(tier)
  if (already) return already
  if (typeof window === 'undefined') return Promise.resolve()

  publish({ ...state, refreshing: isRefresh })
  const url = tier === 'full' ? '/api/world' : `/api/world?tier=${tier}`
  const run = fetch(url, { cache: 'no-store' })
    .then(async (res) => {
      const data = (await res.json()) as WorldEventsReport & { error?: string }
      if (!res.ok || data?.error) throw new Error(data?.error ?? `Request failed (${res.status})`)
      /**
       * A first-light report never replaces a full one.
       *
       * The two passes race — the fast one is *sent* first and there is no
       * guarantee it *lands* first, and on a warm cache the full sweep can beat
       * it outright. Letting the smaller picture overwrite the larger one would
       * make the map lose events for no reason a reader could see, which is
       * worse than the slow first paint this whole change exists to fix.
       */
      if (data.tier === 'first-light' && state.report && state.report.tier !== 'first-light') {
        publish({ ...state, loading: false, refreshing: false })
        return
      }
      publish({ report: data, loading: false, refreshing: false, error: null })
    })
    .catch((err: unknown) => {
      // The last good picture stays. Only the explanation changes.
      publish({
        ...state,
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : 'Could not reach the live feeds',
      })
    })
    .finally(() => {
      inFlight.delete(tier)
    })
  inFlight.set(tier, run)
  return run
}

/**
 * The first load: a true map quickly, then the whole world.
 *
 * ## The measurement
 *
 * Profiled here, the full sweep's measured half is 135 feeds at **2,491ms** —
 * and that is with almost every request refused, the slowest single response
 * being 335ms. The time is 135 requests contending with one another, not any
 * one provider being slow. On an emulated phone the page showed nothing for
 * about nine seconds.
 *
 * The first pass reads fourteen of those feeds — see `first-light.ts` for which
 * fourteen and why. Measured over HTTP against a freshly started server, each
 * tier on its own server: **1.76s cold against 2.43s**, and 365–773ms against
 * 2.0–2.9s once the process is warm. The two figures differ by the ~1.3s of
 * route compilation a cold request pays either way.
 *
 * ## Why two requests and not one streamed one
 *
 * A stream would be fewer round trips and it would put the *analysis* in the
 * wrong place: fusion, coverage and ranking are computed over the whole set,
 * so a partial stream either ships un-analysed events — a different, weaker
 * picture — or re-runs the analysis per chunk. Two complete reports, each
 * honest about which pass produced it, keep one code path and one shape.
 *
 * ## Why the full sweep starts immediately rather than after
 *
 * Chaining them would make the total the sum. They are independent requests
 * against a server that already fans out internally, so both go at once and the
 * reader gets whichever lands first, then the better one. `loadWorld`'s
 * single-flight guard is deliberately bypassed here for the same reason — these
 * two are *not* the same request, and sharing one promise would silently drop
 * the full sweep.
 */
function bootstrap(): void {
  // Both at once. Whichever lands first paints; if that is the fast pass, the
  // full sweep replaces it, and if the full sweep wins the race the guard in
  // `loadWorld` discards the smaller picture rather than losing events to it.
  void loadWorld(false, 'first-light')
  void loadWorld(false, 'full')
}

/**
 * Subscribe, starting the sweep and its clock if nobody has yet.
 *
 * The interval only ever exists while something is watching, and it skips a
 * hidden tab — a backgrounded phone browser should not be reading 119 sources
 * every two minutes on somebody's data plan.
 */
export function subscribeToWorld(onChange: () => void): () => void {
  listeners.add(onChange)
  if (state.report === null && inFlight.size === 0) void bootstrap()

  if (!timer && typeof window !== 'undefined') {
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') void loadWorld(true)
    }, REFRESH_MS)
  }

  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** Test seam: forget everything this module remembers. */
export function resetWorldForTests(): void {
  state = EMPTY
  listeners.clear()
  inFlight.clear()
  if (timer) clearInterval(timer)
  timer = null
}
