import type { CatalogSource } from './catalog/types'
import type { AdmiraltySource } from './types'

/**
 * Observed reliability — the platform grading its own sources.
 *
 * ## The gap this closes
 *
 * Every source in this catalogue carries an Admiralty rating, and every one of
 * those ratings is a **claim we made** when we wrote the record down. A
 * national seismic network is an A because national seismic networks are
 * reliable, not because we ever checked that *this* endpoint answered. That is
 * the standard practice across the field, and it has a quiet failure mode: a
 * feed can rot — change its URL, start returning an empty document, be
 * decommissioned — and go on carrying its A for years, contributing nothing
 * while inflating every coverage number it appears in.
 *
 * So this module keeps a second, *earned* record: what each source has actually
 * done, observed by us, run after run. The declared rating says how much a
 * source would be worth if it answered; the observed record says whether it
 * does. **When the two disagree, that disagreement is the finding** — and it is
 * the one place where the platform is auditing itself rather than the world.
 *
 * ## Why availability and yield are separate numbers
 *
 * A feed that answers every request with an empty document is 100% available
 * and worth nothing. Collapsing the two into one "health" percentage is exactly
 * the bug that once made this board show every source green while the globe was
 * a bare sphere. They stay apart, permanently:
 *
 *  - **availability** — did it answer at all? A transport question.
 *  - **yield** — did answering produce anything? A coverage question.
 *
 * A source can fail either one independently, and the remedy differs: low
 * availability is an outage to wait out or a URL to fix; low yield is a feed
 * that has gone quiet, which may be entirely correct and is never health.
 *
 * ## Why this is not a machine-learning problem
 *
 * It is counting. A rate computed from counts can be checked by hand from the
 * same rows, argued with, and explained to a user in one sentence — and an
 * automated judgement about a source's trustworthiness is precisely the kind of
 * claim that must be arguable. A learned score would be more impressive and
 * less useful, because nobody could say why a source was demoted.
 */

/** One day's observations of one source. The unit we persist and reason over. */
export interface SourceDay {
  sourceKey: string
  /** ISO date, `YYYY-MM-DD`, in UTC. */
  day: string
  /** Runs where the source answered and produced at least one item. */
  ok: number
  /** Runs where it answered and produced nothing. Not failure; not health. */
  empty: number
  /** Runs where it did not answer, or answered with an error. */
  failed: number
  /** Items contributed across all runs that day. */
  items: number
}

export type SourceState =
  | 'healthy'
  | 'degraded'
  | 'silent'
  | 'dead'
  | 'unproven'

/**
 * How many runs before we are willing to say anything at all.
 *
 * Below this a source is `unproven`, never `dead`. Demoting a source on two
 * observations would mean one bad afternoon costs a national agency its rating,
 * and the whole point of an earned record is that it takes time to earn.
 */
export const MIN_RUNS_TO_JUDGE = 20

/** Answering less often than this is degraded, whatever it produces when it does. */
export const AVAILABILITY_FLOOR = 0.8

/** Answering reliably but producing nothing is `silent` below this yield. */
export const YIELD_FLOOR = 0.05

/**
 * Days of unbroken silence before a source is called dead.
 *
 * Fourteen because the quietest legitimate feeds in this catalogue are weekly —
 * the Smithsonian volcanism report, several national statistics releases — and
 * a threshold under two of their cycles would condemn a healthy source for
 * doing exactly what it is supposed to do.
 */
export const DAYS_TO_DECLARE_DEAD = 14

export interface SourceRecord {
  sourceKey: string
  runs: number
  /** Share of runs where the source answered. Transport, not coverage. */
  availability: number
  /** Share of *answered* runs that produced at least one item. */
  yield: number
  /** Mean items per answered run — how much this source actually carries. */
  itemsPerRun: number
  /** Last day it produced anything at all. Null if it never has. */
  lastProductiveDay: string | null
  /** Consecutive days ending today with no items. */
  quietDays: number
  state: SourceState
  /** Why it is in that state, in one sentence. */
  reason: string
}

function dayDiff(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

/** Today in UTC, as the day key. Separated so a test can pin the clock. */
export function todayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

function judge(
  runs: number,
  availability: number,
  yieldRate: number,
  quietDays: number,
  lastProductiveDay: string | null,
): { state: SourceState; reason: string } {
  if (runs < MIN_RUNS_TO_JUDGE) {
    return {
      state: 'unproven',
      reason: `Only ${runs} observation${runs === 1 ? '' : 's'} so far — too few to judge a source on.`,
    }
  }

  // Dead is checked before degraded, because a source that has produced nothing
  // for a fortnight is not a source with a transport problem: whatever it is
  // doing, it is no longer a source of anything.
  if (quietDays >= DAYS_TO_DECLARE_DEAD) {
    return {
      state: 'dead',
      reason: lastProductiveDay
        ? `Nothing since ${lastProductiveDay} — ${quietDays} days silent. Whatever it answers with, it is no longer contributing.`
        : `Never produced anything in ${runs} runs. It answers, or it does not, but it has never been a source.`,
    }
  }

  if (availability < AVAILABILITY_FLOOR) {
    return {
      state: 'degraded',
      reason: `Answered ${(availability * 100).toFixed(0)}% of ${runs} runs. That is a transport problem — a URL to fix or an outage to wait out — not a quiet feed.`,
    }
  }

  if (yieldRate < YIELD_FLOOR) {
    return {
      state: 'silent',
      reason: `Answers reliably (${(availability * 100).toFixed(0)}%) but produced items in only ${(yieldRate * 100).toFixed(0)}% of them. It is reachable and contributing nothing, which is a coverage gap and never health.`,
    }
  }

  return {
    state: 'healthy',
    reason: `Answered ${(availability * 100).toFixed(0)}% of ${runs} runs and produced items in ${(yieldRate * 100).toFixed(0)}% of those.`,
  }
}

/**
 * The earned record for every source we have observations of.
 *
 * `today` is injected rather than read from the clock so a record can be
 * asserted in a test. A judgement about a source that nobody can reproduce is
 * one nobody should act on — the same argument the confidence engine makes.
 */
export function observedReliability(
  days: SourceDay[],
  today: string = todayKey(),
): SourceRecord[] {
  const bySource = new Map<string, SourceDay[]>()
  for (const d of days) {
    const list = bySource.get(d.sourceKey) ?? []
    list.push(d)
    bySource.set(d.sourceKey, list)
  }

  return [...bySource.entries()]
    .map(([sourceKey, rows]) => {
      const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day))
      const ok = sorted.reduce((n, d) => n + d.ok, 0)
      const empty = sorted.reduce((n, d) => n + d.empty, 0)
      const failed = sorted.reduce((n, d) => n + d.failed, 0)
      const items = sorted.reduce((n, d) => n + d.items, 0)
      const runs = ok + empty + failed
      const answered = ok + empty

      const productive = sorted.filter((d) => d.items > 0)
      const lastProductiveDay = productive[productive.length - 1]?.day ?? null

      // Measured from today, not from the last row: a source that stopped being
      // *observed* is as invisible as one that stopped producing, and treating
      // the gap as zero would let a source that fell out of the sweep keep its
      // healthy record indefinitely.
      const quietDays = lastProductiveDay ? dayDiff(lastProductiveDay, today) : dayDiff(sorted[0].day, today)

      const availability = runs > 0 ? answered / runs : 0
      const yieldRate = answered > 0 ? ok / answered : 0
      const { state, reason } = judge(runs, availability, yieldRate, quietDays, lastProductiveDay)

      return {
        sourceKey,
        runs,
        availability: Number(availability.toFixed(4)),
        yield: Number(yieldRate.toFixed(4)),
        itemsPerRun: answered > 0 ? Number((items / answered).toFixed(2)) : 0,
        lastProductiveDay,
        quietDays,
        state,
        reason,
      }
    })
    .sort((a, b) => a.availability - b.availability || a.sourceKey.localeCompare(b.sourceKey))
}

// ── The self-audit ───────────────────────────────────────────────────────────

export type AuditKind =
  | 'declared-dead'
  | 'declared-silent'
  | 'declared-degraded'
  | 'never-observed'
  | 'rating-unearned'
  | 'thin-topic'

export interface AuditFinding {
  kind: AuditKind
  /** The source or topic the finding is about. */
  subject: string
  /** What is wrong, stated as a fact about our own records. */
  detail: string
  /** What should be done about it — an edit to the catalogue, usually. */
  remedy: string
  /**
   * How badly this misleads a reader, worst first.
   *
   * Not how badly it breaks the system — a dead source breaks nothing, it
   * simply makes every count it appears in a lie, which is worse.
   */
  severity: 'high' | 'medium' | 'low'
}

/**
 * Sources whose declared rating implies they are load-bearing.
 *
 * An A or B source that has died matters more than a D that has, because the
 * A is the one a confidence score leaned on.
 */
const LOAD_BEARING: readonly AdmiraltySource[] = ['A', 'B']

/**
 * A topic covered by fewer independent origins than this cannot corroborate
 * anything. Two is the minimum for a second opinion to exist at all; three is
 * the point below which one outage removes the possibility.
 */
export const MIN_ORIGINS_PER_TOPIC = 3

const ORDER: Record<AuditFinding['severity'], number> = { high: 0, medium: 1, low: 2 }

/**
 * Audit the catalogue against what we have actually observed.
 *
 * This is the self-improving loop, and it is deliberately advisory: it produces
 * findings and never edits the catalogue. An automated demotion would be a
 * platform quietly rewriting its own evidence standards without anyone reading
 * the reason — which is the exact opposite of a product built on being able to
 * check what it claims. The findings are the output; a human applies them.
 */
export function auditCatalogue(
  sources: CatalogSource[],
  records: SourceRecord[],
  options: { minOriginsPerTopic?: number } = {},
): AuditFinding[] {
  const byKey = new Map(records.map((r) => [r.sourceKey, r]))
  const findings: AuditFinding[] = []
  const minOrigins = options.minOriginsPerTopic ?? MIN_ORIGINS_PER_TOPIC

  for (const source of sources) {
    if (source.enabled === false) continue
    const record = byKey.get(source.key)
    const loadBearing = LOAD_BEARING.includes(source.admiralty)

    if (!record) {
      findings.push({
        kind: 'never-observed',
        subject: source.key,
        detail: `${source.name} is enabled and rated ${source.admiralty}, but the sweep has no record of ever having run it.`,
        remedy: 'Check that it is registered and reachable, or disable it with a note.',
        severity: loadBearing ? 'medium' : 'low',
      })
      continue
    }

    switch (record.state) {
      case 'dead':
        findings.push({
          kind: 'declared-dead',
          subject: source.key,
          detail: `${source.name} carries an Admiralty ${source.admiralty} and has contributed nothing for ${record.quietDays} days. ${record.reason}`,
          // Not "delete": a dead endpoint is often a moved one, and the record
          // holds the licence and independence group that would be lost.
          remedy: 'Find the current endpoint, or set `enabled: false` with the reason written beside it.',
          severity: loadBearing ? 'high' : 'medium',
        })
        break
      case 'silent':
        findings.push({
          kind: 'declared-silent',
          subject: source.key,
          detail: `${source.name} answers but rarely carries anything. ${record.reason}`,
          remedy: 'Confirm the feed still publishes what the record claims; adjust the topics if it has narrowed.',
          severity: 'low',
        })
        break
      case 'degraded':
        findings.push({
          kind: 'declared-degraded',
          subject: source.key,
          detail: `${source.name} is unreliable to reach. ${record.reason}`,
          remedy: 'Check the URL and the polling interval — a rate limit reads as an outage.',
          severity: loadBearing ? 'medium' : 'low',
        })
        break
      default:
        break
    }

    // The disagreement this module exists for: a rating we declared, against a
    // record the source earned. An A that answers three runs in five is not an
    // A in any sense a confidence score should be allowed to use.
    if (loadBearing && record.state !== 'unproven' && record.availability < AVAILABILITY_FLOOR) {
      findings.push({
        kind: 'rating-unearned',
        subject: source.key,
        detail: `Declared ${source.admiralty}, but answered only ${(record.availability * 100).toFixed(0)}% of ${record.runs} runs. The rating says how much it would be worth if it answered; the record says it does not.`,
        remedy: 'Either fix the endpoint or lower the declared rating until it earns it back.',
        severity: 'high',
      })
    }
  }

  // Topics one outage away from having no second opinion. Counted over sources
  // that are actually working, which is the whole point — a topic with four
  // origins of which three are dead has one.
  const workingByTopic = new Map<string, Set<string>>()
  for (const source of sources) {
    if (source.enabled === false) continue
    const record = byKey.get(source.key)
    if (record && (record.state === 'dead' || record.state === 'degraded')) continue
    for (const topic of source.topics) {
      const group = workingByTopic.get(topic) ?? new Set<string>()
      group.add(source.independence ?? source.key)
      workingByTopic.set(topic, group)
    }
  }
  for (const [topic, origins] of workingByTopic) {
    if (origins.size < minOrigins) {
      findings.push({
        kind: 'thin-topic',
        subject: topic,
        detail: `"${topic}" has ${origins.size} working independent origin${origins.size === 1 ? '' : 's'}. Nothing on this topic can be corroborated beyond that.`,
        remedy: 'Add an independent source for this topic — not another republisher of one already counted.',
        severity: origins.size <= 1 ? 'high' : 'medium',
      })
    }
  }

  return findings.sort(
    (a, b) => ORDER[a.severity] - ORDER[b.severity] || a.subject.localeCompare(b.subject),
  )
}

export interface SelfAudit {
  generatedAt: string
  observedSources: number
  states: Record<SourceState, number>
  findings: AuditFinding[]
  /** The audit in one honest sentence. */
  headline: string
}

export function selfAudit(
  sources: CatalogSource[],
  days: SourceDay[],
  now: number = Date.now(),
): SelfAudit {
  const records = observedReliability(days, todayKey(now))
  const findings = auditCatalogue(sources, records)

  const states: Record<SourceState, number> = {
    healthy: 0,
    degraded: 0,
    silent: 0,
    dead: 0,
    unproven: 0,
  }
  for (const r of records) states[r.state]++

  const high = findings.filter((f) => f.severity === 'high').length
  const headline =
    records.length === 0
      ? 'No observations yet — the platform has nothing to say about its own sources.'
      : `${records.length} sources observed: ${states.healthy} healthy, ${states.degraded} degraded, ${states.silent} silent, ${states.dead} dead.` +
        (findings.length === 0
          ? ' Nothing in the catalogue contradicts what we have observed.'
          : ` ${findings.length} finding${findings.length === 1 ? '' : 's'}${high > 0 ? `, ${high} of them material` : ''}.`)

  return {
    generatedAt: new Date(now).toISOString(),
    observedSources: records.length,
    states,
    findings,
    headline,
  }
}
