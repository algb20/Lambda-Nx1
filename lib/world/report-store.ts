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
let inFlight: Promise<void> | null = null
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
export function loadWorld(isRefresh = false): Promise<void> {
  if (inFlight) return inFlight
  if (typeof window === 'undefined') return Promise.resolve()

  publish({ ...state, refreshing: isRefresh })
  inFlight = fetch('/api/world', { cache: 'no-store' })
    .then(async (res) => {
      const data = (await res.json()) as WorldEventsReport & { error?: string }
      if (!res.ok || data?.error) throw new Error(data?.error ?? `Request failed (${res.status})`)
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
      inFlight = null
    })
  return inFlight
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
  if (state.report === null && !inFlight) void loadWorld(false)

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
  inFlight = null
  if (timer) clearInterval(timer)
  timer = null
}
