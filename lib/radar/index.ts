/**
 * lib/radar — continuous monitoring (product) + knowledge base (internal),
 * wired to the real repositories, engine and queue. Pure logic lives in
 * ./fingerprint, ./scheduler and ./internal (dependency-injected + tested).
 */
import { createHash } from 'node:crypto'
import { repo, type Monitor } from '../db'
import { getQueue, type Queue } from '../queue'
import { investigateDomain } from '../modules/domain'
import { collect } from '../engine'
import { registerWatchFeeds } from '../engine/sources'
import { runDueMonitors, type SchedulerRun } from './scheduler'
import { summarizeChanges, type ChangeSet } from './fingerprint'
import { runWatchSweep, type WatchSweepResult } from './watch'

export * from './fingerprint'
export * from './scheduler'
export * from './internal'
export * from './watchlist'
export * from './watch'

export const RADAR_JOB = 'radar.run'

function changeDedupeHash(monitorId: string, changes: ChangeSet): string {
  const day = new Date().toISOString().slice(0, 10)
  const basis = `${monitorId}:${JSON.stringify(changes.fields)}:${day}`
  return 'product:' + createHash('sha256').update(basis).digest('hex').slice(0, 40)
}

/** Run one radar sweep over due monitors using the real repositories + engine. */
export async function runRadarSweep(): Promise<SchedulerRun> {
  return runDueMonitors({
    listDue: () => repo.monitors.listDue(),
    investigate: investigateDomain,
    onChange: async (monitor: Monitor, changes: ChangeSet) => {
      const title = `Change detected: ${monitor.targetValue}`
      await repo.alerts.add({ monitorId: monitor.id, title, detail: changes })
      await repo.radar.upsertFinding({
        kind: 'product',
        title,
        summary: summarizeChanges(changes),
        confidence: 'possible',
        dedupeHash: changeDedupeHash(monitor.id, changes),
      })
    },
    saveFingerprint: (id, fingerprint) => repo.monitors.setFingerprint(id, fingerprint),
    markRun: (id) => repo.monitors.markRun(id),
  })
}

/**
 * Run one internal sweep of the curated ⭐ watchlist through the real engine and
 * knowledge base. Collection goes through the registry, so the passive
 * guardrail, host allowlist and per-source rate limits all apply.
 */
export async function runInternalRadarSweep(): Promise<WatchSweepResult> {
  registerWatchFeeds()
  return runWatchSweep({
    collectFeed: async (feedKey) => {
      const out = await collect({ capability: 'watch', value: feedKey })
      // The orchestrator absorbs a failing source so siblings can still answer;
      // for a radar sweep the failure itself is news, so pass it through rather
      // than letting an unreachable publisher look like a quiet one.
      const errors = out.results
        .filter((r) => !r.ok)
        .map((r) => `${r.sourceKey}: ${r.error ?? 'failed'}`)
      return { evidence: out.evidence, errors }
    },
    upsert: (finding) => repo.radar.upsertFinding(finding),
  })
}

export interface RadarRun {
  monitors: SchedulerRun | null
  watch: WatchSweepResult | null
  /** Halves that failed outright, named so a scheduler log says which. */
  errors: Array<{ half: 'monitors' | 'watch'; error: string }>
}

function settled<T>(
  half: 'monitors' | 'watch',
  result: PromiseSettledResult<T>,
  errors: RadarRun['errors'],
): T | null {
  if (result.status === 'fulfilled') return result.value
  const reason = result.reason
  errors.push({ half, error: reason instanceof Error ? reason.message : String(reason) })
  return null
}

/**
 * One full radar pass: the product half (user monitors) and the internal half
 * (the ⭐ watchlist). Both always run to completion — a failure in one is
 * reported under `errors` rather than aborting the other.
 */
export async function runFullRadar(): Promise<RadarRun> {
  const [monitors, watch] = await Promise.allSettled([runRadarSweep(), runInternalRadarSweep()])
  const errors: RadarRun['errors'] = []
  return {
    monitors: settled('monitors', monitors, errors),
    watch: settled('watch', watch, errors),
    errors,
  }
}

/**
 * Register the radar job on the queue. In production a durable scheduler
 * (pg_cron/pgmq) enqueues RADAR_JOB periodically; for now enqueue it to run a
 * sweep on demand.
 */
export function registerRadarJobs(queue: Queue = getQueue()): void {
  queue.register(RADAR_JOB, async () => {
    await runFullRadar()
  })
}
