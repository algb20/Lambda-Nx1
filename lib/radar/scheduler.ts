/**
 * Radar scheduler — checks due monitors for change. Dependencies are injected so
 * the logic is testable without a live database; the real wiring (lib/radar)
 * passes the repositories and the domain module.
 */
import type { Monitor } from '../db'
import type { DomainReport } from '../modules/domain'
import {
  computeDomainFingerprint,
  diffFingerprints,
  type ChangeSet,
  type DomainFingerprint,
} from './fingerprint'

export interface MonitorCheck {
  fingerprint: DomainFingerprint
  changes: ChangeSet
  isFirstRun: boolean
}

export async function checkDomainMonitor(
  monitor: Pick<Monitor, 'targetValue' | 'lastFingerprint'>,
  investigate: (target: string) => Promise<DomainReport>,
): Promise<MonitorCheck> {
  const report = await investigate(monitor.targetValue)
  const fingerprint = computeDomainFingerprint(report)
  let previous: DomainFingerprint | null = null
  if (monitor.lastFingerprint) {
    try {
      previous = JSON.parse(monitor.lastFingerprint) as DomainFingerprint
    } catch {
      previous = null
    }
  }
  return { fingerprint, changes: diffFingerprints(previous, fingerprint), isFirstRun: previous === null }
}

export interface SchedulerDeps {
  listDue: () => Promise<Monitor[]>
  investigate: (target: string) => Promise<DomainReport>
  onChange: (monitor: Monitor, changes: ChangeSet) => Promise<void>
  saveFingerprint: (monitorId: string, fingerprint: string) => Promise<void>
  markRun: (monitorId: string) => Promise<void>
}

export interface SchedulerRun {
  checked: number
  alerted: number
  errored: number
}

/** Run all due monitors once. Domain monitors are supported today. */
export async function runDueMonitors(deps: SchedulerDeps): Promise<SchedulerRun> {
  const due = await deps.listDue()
  let alerted = 0
  let errored = 0

  for (const monitor of due) {
    try {
      if (monitor.targetType !== 'domain') {
        await deps.markRun(monitor.id)
        continue
      }
      const result = await checkDomainMonitor(monitor, deps.investigate)
      if (result.changes.changed) {
        await deps.onChange(monitor, result.changes)
        alerted++
      }
      await deps.saveFingerprint(monitor.id, JSON.stringify(result.fingerprint))
      await deps.markRun(monitor.id)
    } catch {
      errored++
      await deps.markRun(monitor.id).catch(() => {})
    }
  }

  return { checked: due.length, alerted, errored }
}
