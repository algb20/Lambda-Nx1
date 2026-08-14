/**
 * The loop that lets the platform improve itself.
 *
 * Three steps, and each is deliberately separate:
 *
 *  1. **Observe** — every sweep records what each source did (`recordSweep`).
 *  2. **Judge** — the accumulated record earns each source a state
 *     (`lib/engine/reliability.ts`), independent of the rating we declared.
 *  3. **Report** — where the declared catalogue and the observed record
 *     disagree, that is a finding (`getSelfAudit`).
 *
 * ## Why the loop stops at "report"
 *
 * The obvious fourth step is to act: demote a source whose record has decayed,
 * disable one that has died. It is deliberately absent. An automated demotion
 * is a platform quietly rewriting its own evidence standards, and the whole
 * claim this product makes is that its grading can be checked — a rating that
 * changed itself at 3am, for reasons nobody read, is exactly the thing we tell
 * users not to trust elsewhere.
 *
 * So the machine does the counting, which it is better at, and a person does
 * the judging, which they are accountable for. The findings name the file and
 * the edit, so acting on one takes a minute; what it does not do is act
 * without being read.
 */
import { isDbConfigured, repo } from '../db'
import { CATALOG } from '../engine/catalog'
import { selfAudit, todayKey, type SelfAudit, type SourceDay } from '../engine/reliability'
import type { SourceHealth } from './world-events-shared'

/**
 * Record one sweep's outcome for every source in it.
 *
 * Best-effort by design: this is bookkeeping about a sweep, and a failure to
 * write it must never cost the sweep's actual result. The alternative — a
 * failed observation write bringing down the world board — would make the
 * self-monitoring layer a liability rather than a safeguard.
 */
export async function recordSweep(
  health: SourceHealth[],
  now: number = Date.now(),
): Promise<void> {
  if (!isDbConfigured()) return
  const day = todayKey(now)

  await Promise.allSettled(
    health.map((h) =>
      repo.sourceHealth.record({
        sourceKey: h.sourceKey,
        day,
        status: h.status,
        items: h.count,
        error: h.error,
      }),
    ),
  )
}

/** How far back the audit reads. A quarter is long enough for a trend. */
export const AUDIT_WINDOW_DAYS = 90

export class SelfAuditUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SelfAuditUnavailableError'
  }
}

/**
 * The platform's report on itself.
 *
 * Throws rather than returning an empty audit when there is no database,
 * because "no findings" and "we have no record to audit" are the two answers
 * this whole module exists to keep apart. Returning the first when the second
 * is true would be the platform reassuring a reader about a check it never ran.
 */
export async function getSelfAudit(now: number = Date.now()): Promise<SelfAudit> {
  if (!isDbConfigured()) {
    throw new SelfAuditUnavailableError(
      'No database configured, so no observations have been kept. This is not a clean audit — it is the absence of one.',
    )
  }

  const rows = await repo.sourceHealth.since(AUDIT_WINDOW_DAYS)
  const days: SourceDay[] = rows.map((r) => ({
    sourceKey: r.sourceKey,
    day: r.day,
    ok: r.ok,
    empty: r.empty,
    failed: r.failed,
    items: r.items,
  }))

  return selfAudit(CATALOG, days, now)
}
