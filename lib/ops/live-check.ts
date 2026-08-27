/**
 * Once the settings are in the host, are they actually *working*?
 *
 * ## Why `check:deploys` is not enough, and neither is `smoke.mjs`
 *
 * Three questions look alike and are not:
 *
 * | Question | Answered by |
 * |---|---|
 * | Does the app boot and route without any credential? | `scripts/smoke.mjs` |
 * | Is each setting **configured** on each deployment? | `npm run check:deploys` |
 * | Does each configured setting actually **work**? | this |
 *
 * The gap between the second and the third is where a deployment sits looking
 * healthy and doing nothing. `/api/health` reporting `database ok` means the
 * variable is *set* — it is not a connection test, and `docs/DEPLOY.md` records
 * the days lost to a `DATABASE_URL` that was correct in every respect except
 * that its host resolves only over IPv6, which serverless functions do not
 * have. A `CRON_SECRET` that is set but mistyped is the same shape: every
 * scheduled job answers 403 forever and the health probe says the check passes.
 *
 * So this asks each subsystem to do its job and reports what it answered.
 *
 * ## About the secrets it uses
 *
 * They come from the caller's own environment and go to the caller's own site
 * over HTTPS, and nothing here ever prints one. A verdict says
 * `CRON_SECRET is set locally but the deployment rejected it`, never what
 * either value was.
 */

export type Verdict = 'working' | 'not-configured' | 'rejected' | 'failing' | 'unknown'

export interface Probe {
  /** What was asked, in the reader's terms. */
  subsystem: string
  /** HTTP status, or `0` when the request did not complete. */
  status: number
  /** Whatever the body said that bears on the verdict. Never a credential. */
  note?: string
  /** False when the caller had no secret to present. */
  attempted: boolean
}

export interface Result {
  subsystem: string
  verdict: Verdict
  /** One line naming what to do about it, or why nothing is needed. */
  detail: string
}

/**
 * Judge one probe. Pure, and separate from the asking, for the same reason
 * `deploy-check.ts` and `recheck.ts` are: the cases worth getting right — a
 * secret set but rejected, a route disabled rather than broken — are trivial as
 * data and painful to stage over a network.
 */
export function judgeProbe(probe: Probe, secretName: string): Result {
  const { subsystem, status, note } = probe

  if (!probe.attempted) {
    return {
      subsystem,
      verdict: 'unknown',
      detail: `${secretName} is not set in this shell, so this was not checked. Export it and run again, or check it in the host.`,
    }
  }
  if (status === 0) {
    return { subsystem, verdict: 'failing', detail: `the request did not complete${note ? `: ${note}` : ''}` }
  }
  if (status === 401 || status === 403) {
    // The distinction that matters: the deployment is running the guard and
    // refused us, which means the two copies of the secret differ.
    return {
      subsystem,
      verdict: 'rejected',
      detail: `answered ${status} — ${secretName} is set here and on the host, and the two do not match. Copy the value again and redeploy.`,
    }
  }
  if (status === 503) {
    return {
      subsystem,
      verdict: 'not-configured',
      detail: `answered 503 — ${secretName} is not set on the deployment, so this route is disabled. Set it in the host, then redeploy.`,
    }
  }
  if (status >= 200 && status < 300) {
    return { subsystem, verdict: 'working', detail: note ?? 'answered' }
  }
  return { subsystem, verdict: 'failing', detail: `answered ${status}${note ? ` — ${note}` : ''}` }
}

/** The shape `/api/health?deep=1` actually returns under `database`. */
export interface DeepDatabase {
  reachable?: boolean
  error?: string | null
  hint?: string | null
  code?: string | null
  appliedMigrations?: number | null
  expectedMigrations?: number | null
  missingTables?: string[]
}

/**
 * The deep database probe reads differently from the rest: `/api/health?deep=1`
 * answers **200 whether or not the database is reachable**, and puts the real
 * answer in the body. Judging it on the status code would call a dead database
 * healthy — the same mistake as releasing a quarantined feed because it
 * returned 200.
 *
 * Four states, not two, because the operator's next action differs in each:
 *
 * - **unset** — there is no database to be broken. Nothing to debug.
 * - **unreachable** — the URL is wrong in one of two ways the deployment doc
 *   already names, and the probe's own `code` says which.
 * - **reachable but incomplete** — tables missing, which is what a truncated
 *   schema paste looks like from outside and is easy to mistake for working.
 * - **working**.
 */
export function judgeDatabase(status: number, database: DeepDatabase | null): Result {
  if (status === 0) return { subsystem: 'database', verdict: 'failing', detail: 'the deployment did not answer' }
  if (!database) {
    return {
      subsystem: 'database',
      verdict: 'unknown',
      detail: 'the deployment reported nothing under `database` — ask it with ?deep=1.',
    }
  }

  const error = database.error ?? ''
  if (/not set|unset|no DATABASE_URL/i.test(error)) {
    return {
      subsystem: 'database',
      verdict: 'not-configured',
      detail: 'DATABASE_URL is not set on this deployment, so accounts, history, monitors and the archive are all off.',
    }
  }

  if (database.reachable !== true) {
    // The two frequent causes are documented and distinguishable, so name the
    // fix rather than making the reader match an error string to a runbook.
    const named =
      database.code === '28P01' || /28P01|password authentication/i.test(error)
        ? 'the password failed — percent-encode any @ : / ? # in it.'
        : /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(error)
          ? 'the host does not resolve — this is the direct host, which is IPv6-only. Use the pooler host on port 6543.'
          : (database.hint ?? 'see the detail above.')
    return { subsystem: 'database', verdict: 'failing', detail: `${error || 'unreachable'} — ${named}` }
  }

  if (database.missingTables?.length) {
    return {
      subsystem: 'database',
      verdict: 'failing',
      detail: `reachable, but ${database.missingTables.length} table(s) are missing (${database.missingTables.slice(0, 4).join(', ')}) — the schema did not finish applying. Re-run it from /setup.`,
    }
  }

  const applied = database.appliedMigrations
  const expected = database.expectedMigrations
  if (typeof applied === 'number' && typeof expected === 'number' && applied < expected) {
    return {
      subsystem: 'database',
      verdict: 'failing',
      detail: `reachable, but ${applied} of ${expected} migrations are applied — the schema is behind the code.`,
    }
  }

  return {
    subsystem: 'database',
    verdict: 'working',
    detail: `reachable${typeof applied === 'number' ? `, ${applied} migrations applied` : ''}`,
  }
}

/** What a person should do next, in one line. Never empty. */
export function summariseLive(results: Result[]): string {
  const by = (v: Verdict) => results.filter((r) => r.verdict === v)
  const rejected = by('rejected')
  const missing = by('not-configured')
  const failing = by('failing')
  const unknown = by('unknown')
  const working = by('working')

  if (rejected.length) {
    return `${names(rejected)} rejected the credential this shell holds — the value on the host differs from the one here. Copy it again and redeploy.`
  }
  if (missing.length) {
    return `${names(missing)} ${missing.length === 1 ? 'is' : 'are'} not configured on the deployment. Set the variable in the host, then redeploy — setting it alone does not reach the running instance.`
  }
  if (failing.length) {
    return `${names(failing)} ${failing.length === 1 ? 'is' : 'are'} configured and still not working; the detail above names the cause.`
  }
  if (unknown.length) {
    return `${working.length} subsystem${working.length === 1 ? '' : 's'} verified. ${names(unknown)} could not be checked from here — export the secret and run again.`
  }
  return `Every subsystem answered: ${names(working)}. This deployment is fully configured.`
}

const names = (r: Result[]) => [...new Set(r.map((x) => x.subsystem))].join(', ')
