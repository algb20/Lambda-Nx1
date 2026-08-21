/**
 * The shared half of the four code-carrying routes.
 *
 * Sign-up verification and password reset are the same shape twice — issue a
 * code, mail it, take it back, spend it — and the parts that must not drift
 * between them are exactly the parts that protect the account. Writing the
 * preconditions once means the reset route cannot quietly end up with a looser
 * rate limit than the sign-up route, which is the sort of asymmetry nobody
 * notices until it is being exploited.
 */
import { NextResponse } from 'next/server'
import { RateLimiter, callerKey, rateLimitHeaders, type RateLimitOptions } from '@/lib/rate-limit'
import {
  databaseAvailability,
  describeDatabaseError,
  ensureSchema,
  explainDatabaseError,
  isDbConfigured,
} from '@/lib/db'
import { canIssueSessions } from '@/lib/auth/session'
import { mailer } from '@/lib/mail'
import { codeEmail, type CodePurpose } from '@/lib/mail/templates'
import { CODE_TTL_MINUTES } from '@/lib/auth/verification'

/**
 * Far tighter than the ordinary write limit.
 *
 * Each of these requests can cause an email to leave the building addressed to
 * somebody who did not ask for it. Ten a minute is generous for a person typing
 * their own address and useless as a mail cannon; the per-address cooldown in
 * `issueCode` closes the other half, where one attacker cycles through IPs
 * against a single victim's inbox.
 */
export const CODE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 }
export const codeLimiter = new RateLimiter(CODE_LIMIT)

/**
 * Reject early if this deployment cannot do accounts at all.
 *
 * ## Why this now asks the database instead of asking the environment
 *
 * It used to check `isDbConfigured()`, which only reports whether
 * `DATABASE_URL` is a non-empty string. A deployment whose URL pointed at an
 * unreachable host passed this gate, ran on, and threw three layers down —
 * where nothing caught it. The visitor got an empty 500.
 *
 * One live round trip, memoised for thirty seconds per instance, closes that:
 * the check now answers the question the caller is actually asking, which is
 * "can this request succeed", not "did somebody set a variable". A healthy
 * deployment pays the round trip at most twice a minute.
 */
export async function accountsUnavailable(route: string): Promise<NextResponse | null> {
  const sessions = canIssueSessions()
  if (!isDbConfigured() || !sessions) {
    console.error(
      `[${route}] refusing — db configured: ${isDbConfigured()}, session secret usable: ${sessions}`,
    )
    return NextResponse.json(
      { error: 'Accounts are temporarily unavailable on this deployment. Try again later.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  /**
   * A connected database is not a ready one.
   *
   * This deployment ran for days with a live database whose tables had never
   * been created — because the step that creates them belonged to a person,
   * and every route by which a person could take it failed in turn. So the
   * deployment takes it: at most once per process, only when tables are
   * genuinely absent, and only ever creating. See `lib/db/apply-schema`.
   *
   * Deliberately not awaited *before* the liveness check below: if the database
   * is unreachable there is nothing to create, and the error the visitor needs
   * is the connection one.
   */
  const database = await databaseAvailability()
  if (database.live) await ensureSchema()

  if (!database.live) {
    console.error(
      `[${route}] refusing — database not answering: ${database.detail}${database.hint ? ` — ${database.hint}` : ''}`,
    )
    return NextResponse.json(
      {
        error: UNAVAILABLE_MESSAGE.unreachable,
        reason: 'database_unreachable',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return null
}

/**
 * What a user is told when the database — not their input — is the problem.
 *
 * One sentence per cause, because the three are not the same event and the
 * person reading has different options in each. `schema` in particular must
 * never say "try again in a moment": nothing will change until an operator
 * applies the schema, and inviting a retry loop is how a five-minute fix
 * becomes an afternoon.
 */
const UNAVAILABLE_MESSAGE: Record<string, string> = {
  unreachable:
    'Accounts are unavailable right now: this deployment cannot reach its database. Nothing was created and no code was sent. This is a server problem, not something wrong with what you entered.',
  credentials:
    'Accounts are unavailable right now: this deployment was refused by its database. Nothing was created and no code was sent. The operator has to fix the connection settings.',
  tls:
    'Accounts are unavailable right now: this deployment could not open a secure connection to its database. Nothing was created and no code was sent.',
  capacity:
    'Accounts are busy right now: the database has no free connections. Nothing was created and no code was sent — please try again in a minute.',
  schema:
    'Accounts are not ready on this deployment: the database is connected but its tables were never created. Nothing was created and no code was sent. The operator has to apply the schema.',
}

/**
 * Turn a thrown database error into an answer, instead of a blank 500.
 *
 * ## Why this is not optional
 *
 * Every route in this family calls a store that can throw. None of them caught
 * it, so an unreachable database produced `HTTP 500` with a zero-length body —
 * and the form, having nothing to show, said "an error occurred". That sentence
 * is true of every failure that has ever happened and useful for none of them.
 * The owner spent days on it while the database had been stating its reason the
 * whole time, one `cause` deep.
 *
 * Returns `null` for anything that is *not* an infrastructure failure, so a
 * genuine bug still surfaces as a bug rather than being dressed up as an outage
 * the operator will look for and never find.
 */
export function databaseUnavailable(route: string, err: unknown): NextResponse | null {
  const failure = explainDatabaseError(err)
  if (!failure.infrastructure) return null

  // The full diagnosis, including the fix, goes to the log where an operator
  // can act on it. The visitor gets the consequence, never the internals.
  console.error(`[${route}] database unavailable — ${describeDatabaseError(err)}`)

  return NextResponse.json(
    {
      error: UNAVAILABLE_MESSAGE[failure.kind] ?? UNAVAILABLE_MESSAGE.unreachable,
      /** Machine-readable, so a client can distinguish this from a bad input. */
      reason: `database_${failure.kind}`,
    },
    {
      // 503 rather than 500: this is a working service that is temporarily
      // unable to serve, and it is the status a monitor already understands.
      status: 503,
      headers: { 'Cache-Control': 'no-store', ...(failure.kind === 'capacity' ? { 'retry-after': '60' } : {}) },
    },
  )
}

export function codeRateLimit(request: Request): NextResponse | null {
  const result = codeLimiter.check(callerKey(request.headers))
  if (result.ok) return null
  return NextResponse.json(
    { error: 'Too many code requests. Wait a moment and try again.', retryAfterSeconds: result.retryAfterSeconds },
    { status: 429, headers: rateLimitHeaders(result, CODE_LIMIT) },
  )
}

/** Read a JSON body without letting a malformed one become a 500. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json()
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Send a code, and report whether it left.
 *
 * The plaintext code exists in exactly two places — the argument to this
 * function and the message body — and is never logged. The `detail` returned on
 * failure is the provider's, and is safe: it says "connection refused" or
 * "mailbox unavailable", never the code.
 */
export async function deliverCode(input: {
  to: string
  code: string
  purpose: CodePurpose
  locale?: string
}): Promise<{ delivered: boolean; detail: string }> {
  const provider = mailer()
  if (!provider.configured) {
    return { delivered: false, detail: 'No mail provider configured on this deployment.' }
  }
  const result = await provider.send(
    codeEmail({
      to: input.to,
      code: input.code,
      purpose: input.purpose,
      minutes: CODE_TTL_MINUTES,
      locale: input.locale,
    }),
  )
  if (!result.delivered) console.error(`[mail] delivery failed: ${result.detail}`)
  return result
}

/**
 * Turn a code check into the sentence the user reads.
 *
 * Deliberately specific — "that code has expired" and "that code is wrong" send
 * a person to different actions, and collapsing both into "invalid code" leaves
 * them retyping a code that will never work. None of these reveal anything a
 * holder of the mailbox does not already know.
 */
export function codeFailureMessage(status: 'none' | 'expired' | 'wrong' | 'exhausted', attemptsLeft?: number): string {
  switch (status) {
    case 'none':
      return 'No code is waiting for that address. Ask for a new one.'
    case 'expired':
      return 'That code has expired. Ask for a new one.'
    case 'exhausted':
      return 'Too many wrong attempts. Ask for a new code.'
    case 'wrong':
      return attemptsLeft && attemptsLeft > 0
        ? `That code is not right — ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`
        : 'That code is not right.'
  }
}
