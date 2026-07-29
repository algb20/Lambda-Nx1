/**
 * lib/radar — continuous monitoring (product) + knowledge base (internal),
 * wired to the real repositories, engine and queue. Pure logic lives in
 * ./fingerprint, ./scheduler and ./internal (dependency-injected + tested).
 */
import { createHash } from 'node:crypto'
import { repo, type Monitor } from '../db'
import { getQueue, type Queue } from '../queue'
import { investigateDomain } from '../modules/domain'
import { runDueMonitors, type SchedulerRun } from './scheduler'
import { summarizeChanges, type ChangeSet } from './fingerprint'

export * from './fingerprint'
export * from './scheduler'
export * from './internal'

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
 * Register the radar job on the queue. In production a durable scheduler
 * (pg_cron/pgmq) enqueues RADAR_JOB periodically; for now enqueue it to run a
 * sweep on demand.
 */
export function registerRadarJobs(queue: Queue = getQueue()): void {
  queue.register(RADAR_JOB, async () => {
    await runRadarSweep()
  })
}
