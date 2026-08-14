/**
 * Investigation history — what this account has already looked at.
 *
 * Investigations persisted before this, but only the domain gateway wrote them
 * and nothing ever read them back. The effect for a user was that every session
 * started from nothing: the same subject investigated three times in a week was
 * three cold starts, and the work of the first two was invisible.
 *
 * Three decisions shape it:
 *
 *  - **Recording is server-side, and best-effort.** The client cannot be trusted
 *    to report what it ran, and history is never worth failing an investigation
 *    over — a database hiccup must cost the history entry, not the result the
 *    user asked for.
 *  - **Only signed-in accounts get history.** The gateways stay open to everyone
 *    (charter §1); an anonymous visitor is not tracked into a table so that a
 *    convenience feature can exist. Nothing is written without a user id.
 *  - **The finding count is stored, not derived.** A list showing thirty entries
 *    should not load thirty reports to count them.
 *
 * The counting and title logic is pure and lives here, so it is testable without
 * a database and identical for every gateway.
 */
import { repo } from '@/lib/db'
import type { EntityType } from '@/lib/engine/types'

/** How the target of a run is typed when the gateway does not deal in entities. */
const FALLBACK_TYPE: EntityType = 'other'

/** Which entity type a gateway's subject usually is, for the pivot graph. */
const GATEWAY_TARGET_TYPE: Record<string, EntityType> = {
  domain: 'domain',
  username: 'username',
  email: 'email',
  threat: 'other',
  finance: 'company',
  ownership: 'company',
  procurement: 'company',
  reference: 'other',
  geo: 'other',
  markets: 'other',
  media: 'image',
  // A catalogue search is a subject search, not an entity lookup: "flood risk"
  // is a topic. The organizations it surfaces become entities in their own
  // right through the evidence, which is where they belong.
  'open-data': 'other',
}

export interface HistoryEntry {
  id: string
  gateway: string
  subject: string
  findingCount: number
  createdAt: string
}

/**
 * Count the graded findings in any gateway's report, without knowing its shape.
 *
 * Every gateway returns evidence somewhere — a flat `findings`, a `sections`
 * object of arrays, `items`, `facts`, `found`, or breaches plus profiles. A
 * per-gateway counter would be sixteen places to forget; this reads whatever is
 * there, and returns 0 rather than guessing when it recognises nothing.
 */
export function countFindings(report: unknown): number {
  if (!report || typeof report !== 'object') return 0
  const r = report as Record<string, unknown>

  let total = 0
  for (const key of ['findings', 'items', 'facts', 'found', 'breaches', 'profiles', 'unplaceable']) {
    const value = r[key]
    if (Array.isArray(value)) total += value.length
  }

  // `sections` is either an object of arrays (domain) or an array of groups.
  const sections = r.sections
  if (Array.isArray(sections)) {
    for (const group of sections) {
      const findings = (group as Record<string, unknown> | null)?.findings
      if (Array.isArray(findings)) total += findings.length
    }
  } else if (sections && typeof sections === 'object') {
    for (const value of Object.values(sections as Record<string, unknown>)) {
      if (Array.isArray(value)) total += value.length
    }
  }

  return total
}

/** The one-line label a history row shows. Never longer than a row can hold. */
export function historyTitle(gateway: string, subject: string): string {
  const label = gateway.charAt(0).toUpperCase() + gateway.slice(1)
  const trimmed = subject.trim()
  return trimmed ? `${label}: ${trimmed}`.slice(0, 200) : label
}

export interface RecordRunInput {
  userId: string
  gateway: string
  subject: string
  report: unknown
}

/**
 * Write one history entry. Returns the id, or null when there was nothing worth
 * recording — an empty subject on a gateway that needs one is not a run anybody
 * would want to reopen.
 */
export async function recordRun(input: RecordRunInput): Promise<string | null> {
  const subject = input.subject.trim().slice(0, 500)
  const row = await repo.investigations.create({
    userId: input.userId,
    title: historyTitle(input.gateway, subject),
    targetType: GATEWAY_TARGET_TYPE[input.gateway] ?? FALLBACK_TYPE,
    targetValue: subject || input.gateway,
    gateway: input.gateway,
    findingCount: countFindings(input.report),
  })
  return row?.id ?? null
}

/**
 * Record without ever failing the caller.
 *
 * History is a convenience; the investigation is the product. A route that
 * throws because the archive was briefly unavailable would trade the thing the
 * user asked for against a thing they did not.
 */
export async function recordRunSafely(input: RecordRunInput): Promise<string | null> {
  try {
    return await recordRun(input)
  } catch (err) {
    console.error(`[history] not recorded for ${input.gateway}:`, err)
    return null
  }
}
