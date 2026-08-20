/**
 * Publishing that keeps running without a scheduler.
 *
 * ## The failure this fixes
 *
 * Automatic publishing was automatic in one narrow sense: a cron entry existed.
 * On Vercel it fired **once a day at 06:00**; on Netlify, every six hours. For a
 * product whose front page is meant to be the world right now, a page that
 * refreshes itself once a day is a page that does not refresh itself.
 *
 * Worse, both depended on configuration the operator has to get right — a
 * `CRON_SECRET`, a scheduler the host actually reads — and when either was
 * missing, *nothing published at all* and nothing said so. The front page simply
 * stayed empty and looked like a product with no content.
 *
 * ## What this adds
 *
 * A second, independent way for the same job to run: when somebody reads the
 * feed and the newest automatic post is older than `STALE_AFTER_MS`, the
 * publish job is started in the background. The reader's request is never
 * blocked and never waits — they get the feed as it is, and the *next* reader
 * gets the newer one.
 *
 * This is not a replacement for the scheduler. It is the property that a
 * scheduler cannot give: **the platform stays current on any host, with no cron
 * configuration at all**, including a laptop, a self-hosted box, and Pi App
 * Studio. Where a scheduler *is* configured, it fires first and this never
 * triggers, because the posts are already fresh.
 *
 * ## Why this cannot storm
 *
 * Three guards, and the reason for each:
 *
 *  - **One at a time.** A module-level promise means concurrent readers share
 *    one run rather than starting one each. Without it, ten readers arriving at
 *    once on a cold instance would start ten world sweeps.
 *  - **A floor between runs.** Even a failed run sets the clock, so a broken
 *    publisher is retried on a cadence rather than on every request — which is
 *    how a failing job becomes an outbound flood.
 *  - **Never on a write.** Only reads consider triggering, so publishing can
 *    never be provoked by something a visitor submits.
 *
 * Serverless caveat, stated rather than hidden: this lives in one instance's
 * memory. On a host that runs several, each keeps its own clock, so the real
 * cadence is up to *n* times the floor. That is acceptable — the job is
 * idempotent, it skips anything already published — and it is why the floor is
 * minutes rather than seconds.
 */

/** How stale the newest automatic post may be before a read triggers a run. */
export const STALE_AFTER_MS = 20 * 60_000

/** The hard floor between two self-driven runs, however many readers arrive. */
export const MIN_INTERVAL_MS = 10 * 60_000

interface DriveState {
  lastStartedAt: number
  running: Promise<unknown> | null
  runs: number
  failures: number
  lastError: string | null
}

const state: DriveState = {
  lastStartedAt: 0,
  running: null,
  runs: 0,
  failures: 0,
  lastError: null,
}

export interface DriveDecision {
  /** Whether a run was started by this call. */
  started: boolean
  /** Why not, when it was not. Always a real reason, never silence. */
  reason: 'started' | 'already-running' | 'too-soon' | 'still-fresh'
}

/**
 * Consider publishing, and say what was decided.
 *
 * `newestAt` is the timestamp of the newest automatic post, or null when there
 * are none — null means "nothing has ever published", which is the strongest
 * possible reason to run.
 */
export function considerPublishing(input: {
  newestAt: string | Date | null
  run: () => Promise<unknown>
  now?: number
}): DriveDecision {
  const now = input.now ?? Date.now()

  if (state.running) return { started: false, reason: 'already-running' }
  if (now - state.lastStartedAt < MIN_INTERVAL_MS) return { started: false, reason: 'too-soon' }

  const newest = input.newestAt ? new Date(input.newestAt).getTime() : null
  const stale = newest === null || !Number.isFinite(newest) || now - newest > STALE_AFTER_MS
  if (!stale) return { started: false, reason: 'still-fresh' }

  // The clock is set *before* the run, not after: a run that takes two minutes
  // must not let a reader at minute one start a second one.
  state.lastStartedAt = now
  state.runs += 1
  state.running = input
    .run()
    .catch((error: unknown) => {
      state.failures += 1
      state.lastError = error instanceof Error ? error.message : String(error)
      // Logged, never rethrown. This is background work nobody asked for; a
      // rejection escaping here would become an unhandled rejection and, on
      // some runtimes, take the process with it.
      console.error(`[self-drive] publish run failed: ${state.lastError}`)
    })
    .finally(() => {
      state.running = null
    })

  return { started: true, reason: 'started' }
}

/** What the self-driver has done. Reported by the health surface, not hidden. */
export function driveStatus(): {
  runs: number
  failures: number
  lastStartedAt: string | null
  running: boolean
  lastError: string | null
} {
  return {
    runs: state.runs,
    failures: state.failures,
    lastStartedAt: state.lastStartedAt ? new Date(state.lastStartedAt).toISOString() : null,
    running: state.running !== null,
    lastError: state.lastError,
  }
}

/** Test seam. Never called in production. */
export function resetDrive(): void {
  state.lastStartedAt = 0
  state.running = null
  state.runs = 0
  state.failures = 0
  state.lastError = null
}
