/**
 * Is the database *answering* — not merely configured.
 *
 * ## The distinction that broke a deployment
 *
 * `isDbConfigured()` returns true when `DATABASE_URL` is a non-empty string.
 * Nothing more. Every gate in the account routes was built on it, so a
 * deployment with a URL pointing at an unreachable host reported itself ready:
 * `/api/auth/methods` said `accounts: true`, the form offered sign-up, and the
 * first write threw inside the route and came back as `500` with an empty body.
 *
 * The visitor read "an error occurred". The operator read nothing at all.
 *
 * A string being set is a claim about the environment. This asks the database.
 *
 * ## Why it is cached, and why the two caches differ
 *
 * The check costs a round trip, and the surface that needs it most —
 * `/api/auth/methods` — is fetched every time the sign-in form is drawn. So the
 * answer is memoised in the instance.
 *
 * A **healthy** answer is held for thirty seconds: a database that answered a
 * moment ago will almost certainly answer now, and if it does not, the route's
 * own error handling catches it with a real cause.
 *
 * A **failed** answer is held for five: the moment an operator fixes the URL,
 * the product must come back. Caching a failure for as long as a success would
 * mean the fix appears not to work, which sends them looking for a second
 * problem that does not exist. Failure states must always expire faster than
 * healthy ones.
 */
import { sql } from 'drizzle-orm'
import { getDb, isDbConfigured } from './client'
import { explainDatabaseError } from './errors'

export interface DatabaseAvailability {
  /** True only when a real query completed. */
  live: boolean
  /** Scrubbed cause, when it did not. */
  detail: string | null
  /** What an operator should change, when the cause names a fix. */
  hint: string | null
  /** Driver code or SQLSTATE, when there was one. */
  code: string | null
}

/** How long a good answer is trusted. */
export const LIVE_TTL_MS = 30_000
/** How long a bad one is — deliberately shorter. See the header. */
export const DOWN_TTL_MS = 5_000
/** A ping that has not answered in this long is treated as a failure. */
export const PING_TIMEOUT_MS = 2_500

const CONFIGURED: DatabaseAvailability = {
  live: false,
  detail: 'DATABASE_URL is not set on this deployment',
  hint: 'Add DATABASE_URL in the hosting project settings and redeploy — environment variables are read at boot, so a running deployment will not pick up a new one.',
  code: null,
}

let cached: { at: number; value: DatabaseAvailability } | null = null
/** One in-flight ping shared by concurrent callers, never a stampede. */
let inFlight: Promise<DatabaseAvailability> | null = null

function fresh(now: number): DatabaseAvailability | null {
  if (!cached) return null
  const ttl = cached.value.live ? LIVE_TTL_MS : DOWN_TTL_MS
  return now - cached.at < ttl ? cached.value : null
}

async function ping(): Promise<DatabaseAvailability> {
  try {
    const db = getDb()
    /**
     * `select 1` and a deadline. The deadline matters more than the query: a
     * host that accepts the socket and never replies would otherwise hold this
     * open until the platform kills the function, turning a diagnosable outage
     * into a blank timeout.
     */
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`the database did not answer within ${PING_TIMEOUT_MS}ms`)),
        PING_TIMEOUT_MS,
      )
      db.execute(sql`select 1`).then(
        () => {
          clearTimeout(timer)
          resolve()
        },
        (err: unknown) => {
          clearTimeout(timer)
          reject(err)
        },
      )
    })
    return { live: true, detail: null, hint: null, code: null }
  } catch (err) {
    const failure = explainDatabaseError(err)
    return { live: false, detail: failure.detail, hint: failure.hint, code: failure.code }
  }
}

/**
 * Ask, or reuse a recent answer. Never throws.
 */
export async function databaseAvailability(now = Date.now()): Promise<DatabaseAvailability> {
  if (!isDbConfigured()) return CONFIGURED

  const hit = fresh(now)
  if (hit) return hit

  if (!inFlight) {
    inFlight = ping().then((value) => {
      cached = { at: Date.now(), value }
      inFlight = null
      return value
    })
  }
  return inFlight
}

/** Test seam — forget the memoised answer. */
export function resetAvailabilityCache(): void {
  cached = null
  inFlight = null
}
