/**
 * Is what is deployed the thing we think is deployed, and does it work?
 *
 * ## The morning this exists for
 *
 * On 2026-08-27 the owner said there were errors in the database, the settings
 * and GitHub. Finding out what they were meant asking three sites by hand, one
 * `curl` at a time. The answers were worse than the question:
 *
 * - **All three deployments reported `unhealthy`**, with `SESSION_SECRET`
 *   unset — the check the health route itself marks `required` — so sign-in
 *   was unavailable on every one of them.
 * - `DATABASE_URL` was unset everywhere, so there were no database *errors*;
 *   there was no database.
 * - `CRON_SECRET` was unset, so `/api/cron/*` answered 503 and **the daily
 *   quarantine re-probe shipped five days earlier had never run once**.
 * - One of the three was serving a build from **twelve days earlier** than the
 *   other two, and nothing anywhere said so.
 *
 * Every one of those is visible in `/api/health`, which this project already
 * built and which already tells the truth. None of them was noticed, because
 * reading it was a thing a person had to remember to do — the same shape of
 * failure as the quarantine that only healed when somebody remembered, and the
 * job that was scheduled on no host at all.
 *
 * ## What this module is, and what it deliberately is not
 *
 * The judgement is pure and the fetching is separate, for the same reason
 * `recheck.ts` splits them: the interesting cases — a site twelve days behind,
 * a required check degraded, a site that answers nothing at all — are painful
 * to reproduce over a network and trivial to state as data.
 *
 * It reads only `/api/health`, which is public and carries no secret: provider
 * names, check names, and whether each is configured. It never reads a value.
 * **Nothing here can print a key, because nothing here is ever given one.**
 */

/** One check as `/api/health` reports it. */
export interface HealthCheck {
  name: string
  status: 'ok' | 'degraded' | 'off'
  detail?: string
  /** The route's own judgement that the product cannot work without it. */
  required?: boolean
}

/** What one deployment answered, or why it did not. */
export interface Reading {
  /** The deployment's public name, for the report. */
  site: string
  /** `null` when the site did not answer at all. */
  health: {
    status: string
    checks: HealthCheck[]
    build?: { shortCommit?: string; builtAt?: string }
  } | null
  /** Why it did not answer, when it did not. */
  error?: string
}

export type Severity = 'blocking' | 'degraded' | 'stale' | 'unreachable'

export interface Finding {
  site: string
  severity: Severity
  /** One line naming what is wrong and what it costs. */
  detail: string
}

/**
 * How far behind the newest deployment a site may be before it is called out.
 *
 * Deploys are not simultaneous — one host finishing a few minutes after another
 * is normal and reporting it would train the reader to ignore this. A site
 * still serving yesterday's commit is not normal.
 */
export const STALE_AFTER_HOURS = 12

/**
 * Judge a set of readings.
 *
 * Ordered worst-first: a site nobody can sign in to matters more than one
 * missing an optional mail provider, and a reader who has to sort the list
 * themselves stops reading it.
 */
export function judgeDeployments(readings: Reading[], nowMs = Date.now()): Finding[] {
  const findings: Finding[] = []

  // The newest build any site is serving is the yardstick. Not `main`'s HEAD:
  // this runs against deployments, and a deployment can legitimately lag a
  // commit that has not finished building anywhere yet.
  const builtAtMs = readings
    .map((r) => (r.health?.build?.builtAt ? Date.parse(r.health.build.builtAt) : NaN))
    .filter((n) => !Number.isNaN(n))
  const newestMs = builtAtMs.length ? Math.max(...builtAtMs) : null

  for (const r of readings) {
    if (!r.health) {
      findings.push({
        site: r.site,
        severity: 'unreachable',
        detail: r.error ? `did not answer: ${r.error}` : 'did not answer',
      })
      continue
    }

    for (const c of r.health.checks) {
      if (c.status === 'ok') continue
      // `required` is the health route's own word for "the product cannot work
      // without this". Re-deciding it here would let the two disagree.
      findings.push({
        site: r.site,
        severity: c.required ? 'blocking' : 'degraded',
        detail: `${c.name} is ${c.status}${c.detail ? ` — ${firstSentence(c.detail)}` : ''}`,
      })
    }

    const builtAt = r.health.build?.builtAt ? Date.parse(r.health.build.builtAt) : NaN
    if (newestMs !== null && !Number.isNaN(builtAt)) {
      const behindHours = Math.floor((newestMs - builtAt) / 3_600_000)
      if (behindHours >= STALE_AFTER_HOURS) {
        const days = Math.floor(behindHours / 24)
        findings.push({
          site: r.site,
          severity: 'stale',
          detail:
            `serving ${r.health.build?.shortCommit ?? 'an unknown commit'}, ` +
            `${days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${behindHours} hours`} behind the newest deployment`,
        })
      }
    }
  }

  const order: Record<Severity, number> = { unreachable: 0, blocking: 1, stale: 2, degraded: 3 }
  return findings.sort((a, b) => order[a.severity] - order[b.severity] || a.site.localeCompare(b.site))
}

/** The check details are paragraphs; a report wants the claim, not the manual. */
function firstSentence(text: string): string {
  const cut = text.search(/[.—]\s/)
  return (cut > 0 ? text.slice(0, cut) : text).trim()
}

/**
 * One line a person can act on, naming the worst thing found.
 *
 * Mandatory and never empty, for the reason the quarantine report's advice is:
 * a check that usually passes stops being read the first time it says nothing.
 */
export function summariseDeployments(findings: Finding[], siteCount: number): string {
  if (siteCount === 0) return 'No deployments are listed to check.'
  if (findings.length === 0) {
    return `All ${siteCount} deployment${siteCount === 1 ? '' : 's'} answered, current, with every check configured.`
  }
  const unreachable = findings.filter((f) => f.severity === 'unreachable')
  const blocking = findings.filter((f) => f.severity === 'blocking')
  const stale = findings.filter((f) => f.severity === 'stale')

  if (unreachable.length) {
    return `${unreachable.length} deployment${unreachable.length === 1 ? '' : 's'} did not answer at all — ${sites(unreachable)}. Check the host before reading anything else here.`
  }
  if (blocking.length) {
    return `${blocking.length} required check${blocking.length === 1 ? ' is' : 's are'} unset — ${sites(blocking)} cannot do what ${blocking.length === 1 ? 'it needs' : 'they need'} that setting for. Set them in the host, then redeploy so the running instance picks them up.`
  }
  if (stale.length) {
    return `Every check is configured, but ${sites(stale)} ${stale.length === 1 ? 'is' : 'are'} serving an old build — the host is not publishing what was merged.`
  }
  return `${findings.length} optional capabilit${findings.length === 1 ? 'y is' : 'ies are'} off; nothing is blocking.`
}

const sites = (f: Finding[]) => [...new Set(f.map((x) => x.site))].join(', ')
