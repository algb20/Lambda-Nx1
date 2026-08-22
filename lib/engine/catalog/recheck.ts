import { parseFeed } from '../feedxml'
import { publicationTime } from '../observed'
import { USER_AGENT } from '../guardrail'
import { decodeBody, requestUrl } from './adapter'
import { CATALOG } from './index'
import { QUARANTINE, type QuarantinedSource } from './quarantine'
import type { CatalogSource } from './types'

/**
 * Does a source we gave up on work again? Asked on a schedule, not on a whim.
 *
 * ## The gap this closes
 *
 * The platform watches the health of the sources it *uses*: `staleness.ts`
 * catches a feed that answers but has stopped publishing, and `/api/diagnose`
 * reports which sweeps are failing. Nothing watched the sources it had **given
 * up on**. `quarantine.ts` says plainly that "re-running the probe against this
 * list is how a source gets released", and re-running it was a thing a person
 * had to remember.
 *
 * On 2026-08-22 somebody did, for the first time since 2026-08-14. **Eight of
 * fifty-one answered and six were genuinely back** — a national statistics
 * bureau, the SEC's litigation feed, CISA's advisories, an ice-data centre, a
 * vendor security feed and a newsroom. Eight days of decay reversed by one
 * afternoon of asking.
 *
 * Coverage that only heals when a human remembers is coverage that decays. This
 * is R189 in the only honest sense available: not gateways rewriting
 * themselves, but the platform noticing on its own when a door it found locked
 * has been reopened.
 *
 * ## The judgement, and why a status code is not it
 *
 * The same afternoon proved why this cannot be `res.ok`. Two of the eight
 * answered `200` and neither deserved release: `thedailystar_bd` returned ten
 * well-formed items whose newest was **1,492 days old**, and
 * `saws_south_africa` returned a valid page containing no items at all. A
 * release decided on the status code would have put four-year-old reporting
 * back on a live board.
 *
 * So `judgeProbe` is separate from the fetching, takes only what was actually
 * observed, and is exhaustively tested. `recovered` requires all three: the
 * document parsed, it contains items, and one of them is recent.
 */

/** How recent the newest item must be for a source to count as alive. */
export const MAX_ITEM_AGE_DAYS = 60

/**
 * How long one refused provider may hold the job before it is abandoned.
 *
 * Shorter than the engine's general deadline on purpose. These are hosts that
 * already failed once; a slow one is not owed the same patience as a source the
 * platform depends on, and forty of them sharing one function budget means the
 * cost of waiting is paid by every source queued behind it.
 */
export const PROBE_TIMEOUT_MS = 6_000

/**
 * How much of the job's wall clock the probing may consume.
 *
 * The route deploys under a 60-second function budget. Forty-three sources at
 * six seconds each is four and a half minutes in the worst case, so a run that
 * insisted on finishing would be killed mid-list and report nothing at all —
 * the failure mode where a job that runs daily produces a result on no day.
 *
 * So the budget is real and the list rotates: what is not reached today is
 * first in line tomorrow.
 */
export const BUDGET_MS = 45_000

export type Verdict =
  /** Answers, parses, has items, and one of them is recent. Release it. */
  | 'recovered'
  /** The provider still refuses or fails. Nothing has changed. */
  | 'still-refused'
  /** Answers and parses, but the document holds nothing. */
  | 'answers-but-empty'
  /** Answers with items whose newest is too old to be current reporting. */
  | 'answers-but-stale'
  /** A quarantine entry naming a key the catalogue no longer holds. */
  | 'no-record'

export interface Probe {
  /** HTTP status, or `0` when the request did not complete at all. */
  status: number
  /** Items parsed out of the body. `null` when the body could not be parsed. */
  items: number | null
  /** The newest item's ISO timestamp, or `null` when none carried a date. */
  newestAt: string | null
}

export interface Recheck {
  key: string
  /** What the quarantine record said when it was written. */
  was: { reason: QuarantinedSource['reason']; status: number; observedOn: string }
  now: Probe
  verdict: Verdict
  /** One line a person can act on, naming the number that decided it. */
  detail: string
}

/**
 * The whole decision, given only what was observed.
 *
 * Pure on purpose. Every interesting case here — a stale-but-valid feed, a
 * parseable body with nothing in it — is awkward to reproduce over a network
 * and trivial to state as data.
 */
export function judgeProbe(probe: Probe, nowMs = Date.now()): { verdict: Verdict; detail: string } {
  if (probe.status < 200 || probe.status >= 300) {
    return {
      verdict: 'still-refused',
      detail: probe.status === 0 ? 'no response at all' : `provider answered ${probe.status}`,
    }
  }
  if (probe.items === null) {
    // A 200 that is not the document is worse than a 404: it fails the parser
    // rather than the request, so nothing upstream calls it a failure.
    return { verdict: 'answers-but-empty', detail: 'answered 200 with a body that would not parse' }
  }
  if (probe.items === 0) {
    return { verdict: 'answers-but-empty', detail: 'answered 200 with zero items' }
  }
  if (!probe.newestAt) {
    // Items but no dates: we cannot tell current reporting from an archive, and
    // guessing in the optimistic direction is how a frozen feed gets released.
    return {
      verdict: 'answers-but-stale',
      detail: `answered 200 with ${probe.items} items, none carrying a date — freshness unknowable`,
    }
  }
  const ageDays = Math.floor((nowMs - Date.parse(probe.newestAt)) / 86_400_000)
  if (Number.isNaN(ageDays)) {
    return {
      verdict: 'answers-but-stale',
      detail: `answered 200 with ${probe.items} items and an unreadable newest date`,
    }
  }
  if (ageDays > MAX_ITEM_AGE_DAYS) {
    return {
      verdict: 'answers-but-stale',
      detail: `answered 200 with ${probe.items} items, newest ${ageDays} days old`,
    }
  }
  return {
    verdict: 'recovered',
    detail: `answered 200 with ${probe.items} items, newest ${ageDays} day${ageDays === 1 ? '' : 's'} old`,
  }
}

/** The quarantined keys that still have a catalogue record to probe. */
export function recheckable(): Array<{ entry: QuarantinedSource; source: CatalogSource }> {
  const byKey = new Map(CATALOG.map((s) => [s.key, s]))
  const out: Array<{ entry: QuarantinedSource; source: CatalogSource }> = []
  for (const entry of QUARANTINE) {
    const source = byKey.get(entry.key)
    if (source) out.push({ entry, source })
  }
  return out
}

/**
 * Quarantine entries naming a key the catalogue no longer holds.
 *
 * Two of these existed and withheld nothing, because there was no record to
 * withhold. Reported rather than silently skipped: an entry pointing at nothing
 * is a small lie about the size of the problem.
 */
export function orphanedEntries(): string[] {
  const known = new Set(CATALOG.map((s) => s.key))
  return QUARANTINE.filter((q) => !known.has(q.key)).map((q) => q.key)
}

/**
 * Where today's run starts in the list.
 *
 * A run bounded by a budget that always starts at index 0 does not check a
 * rotating slice of the quarantine — it checks the same head of it every day,
 * forever, and the tail is never asked at all. Which would be a job that looks
 * like it is doing the work and is not, and this codebase has already shipped
 * one of those.
 *
 * Rotating by the day number needs no stored cursor and survives a container
 * that never keeps anything: consecutive days start at consecutive offsets, so
 * the whole list is covered as long as a run reaches more than one source.
 */
export function probeOrder<T>(list: T[], at: Date): T[] {
  if (list.length === 0) return []
  const dayNumber = Math.floor(at.getTime() / 86_400_000)
  const start = ((dayNumber % list.length) + list.length) % list.length
  return [...list.slice(start), ...list.slice(0, start)]
}

export interface RecheckReport {
  checkedAt: string
  quarantined: number
  checked: number
  /** Reached by neither today's budget nor its rotation. First in line next run. */
  skipped: string[]
  recovered: Recheck[]
  others: Recheck[]
  orphaned: string[]
  /** What a person should do next, in one sentence. Never empty. */
  advice: string
}

/**
 * Summarise a set of rechecks into something a scheduler log can be read for.
 *
 * The advice line is mandatory. A report that lists verdicts and stops leaves
 * the reader to work out whether anything happened, which — on a job that runs
 * daily and usually finds nothing — means nobody reads it after the first week.
 */
export function summarise(
  results: Recheck[],
  orphaned: string[],
  quarantined: number,
  options: { at?: Date; skipped?: string[] } = {},
): RecheckReport {
  const { at = new Date(), skipped = [] } = options
  const recovered = results.filter((r) => r.verdict === 'recovered')
  const others = results.filter((r) => r.verdict !== 'recovered')
  const unreached = skipped.length
    ? ` ${skipped.length} not reached within the budget; they lead the next run.`
    : ''
  const advice = recovered.length
    ? `${recovered.length} source${recovered.length === 1 ? '' : 's'} answer again with recent items — release ${recovered
        .map((r) => r.key)
        .join(', ')} from quarantine.${unreached}`
    : orphaned.length
      ? `Nothing recovered. ${orphaned.length} quarantine ${orphaned.length === 1 ? 'entry names a key' : 'entries name keys'} the catalogue no longer holds — remove ${orphaned.join(', ')}.${unreached}`
      : `Nothing recovered and nothing to tidy; the quarantine is an accurate picture today.${unreached}`
  return {
    checkedAt: at.toISOString(),
    quarantined,
    checked: results.length,
    skipped,
    recovered,
    others,
    orphaned,
    advice,
  }
}

/**
 * Ask one quarantined source whether it works again.
 *
 * Reads the body the way the engine reads it — `decodeBody` and `parseFeed`,
 * the same path a real sweep takes — because an audit taken with a different
 * instrument from the thing being audited measures the instrument. That lesson
 * is written on `scripts/audit-feeds.ts` in this codebase and was learned by
 * reporting 51 feeds unreachable that were not.
 */
export async function probeSource(
  source: CatalogSource,
  fetchImpl: typeof fetch = fetch,
  at = new Date(),
): Promise<Probe> {
  try {
    const res = await fetchImpl(requestUrl(source, at), {
      redirect: 'follow',
      // A host that accepts the connection and never answers would otherwise
      // hold undici's five-minute default and take the whole job with it.
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        'User-Agent': source.userAgent ?? USER_AGENT,
        Accept:
          source.kind === 'geojson' || source.kind === 'json'
            ? 'application/json, application/geo+json;q=0.9, */*;q=0.5'
            : 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5',
      },
    })
    if (!res.ok) return { status: res.status, items: null, newestAt: null }

    const text = await decodeBody(res)
    if (source.kind === 'json' || source.kind === 'geojson') {
      const parsed: unknown = JSON.parse(text)
      const at_ = source.path
        ? source.path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], parsed)
        : parsed
      const rows = Array.isArray(at_)
        ? at_
        : Array.isArray((parsed as { features?: unknown[] })?.features)
          ? (parsed as { features: unknown[] }).features
          : null
      return { status: res.status, items: rows ? rows.length : null, newestAt: null }
    }

    const entries = parseFeed(text)
    let newestAt: string | null = null
    for (const e of entries) {
      const t = e.published ? publicationTime(e.published) : null
      if (t && (!newestAt || t > newestAt)) newestAt = t
    }
    return { status: res.status, items: entries.length, newestAt }
  } catch {
    // A request that did not complete is `0`, which `judgeProbe` reads as "no
    // response at all" rather than as any particular refusal.
    return { status: 0, items: null, newestAt: null }
  }
}

/**
 * Re-probe the quarantine, politely, inside a budget.
 *
 * Serial with a pause, not parallel. These are publishers who have already said
 * no once; asking forty of them at once is the opposite of the manner the
 * guardrail enforces on every other request this engine makes.
 *
 * The budget stops the run rather than the runtime doing it: a job killed by
 * the function timeout returns nothing, so the day's probing is spent and no
 * one learns anything from it. Stopping early returns everything measured so
 * far and names what was not reached.
 */
export async function recheckQuarantine(options?: {
  fetchImpl?: typeof fetch
  pauseMs?: number
  budgetMs?: number
  now?: () => number
}): Promise<RecheckReport> {
  const fetchImpl = options?.fetchImpl ?? fetch
  const pauseMs = options?.pauseMs ?? 400
  const budgetMs = options?.budgetMs ?? BUDGET_MS
  const now = options?.now ?? (() => Date.now())

  const startedAt = now()
  const queue = probeOrder(recheckable(), new Date(startedAt))
  const results: Recheck[] = []
  const skipped: string[] = []

  for (const { entry, source } of queue) {
    if (now() - startedAt >= budgetMs) {
      skipped.push(entry.key)
      continue
    }
    const probe = await probeSource(source, fetchImpl, new Date(now()))
    const { verdict, detail } = judgeProbe(probe, now())
    results.push({
      key: entry.key,
      was: { reason: entry.reason, status: entry.status, observedOn: entry.observedOn },
      now: probe,
      verdict,
      detail,
    })
    if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs))
  }
  return summarise(results, orphanedEntries(), QUARANTINE.length, {
    at: new Date(now()),
    skipped,
  })
}
