import { NextResponse } from 'next/server'
import { RateLimiter, callerKey, rateLimitHeaders, type RateLimitOptions } from '@/lib/rate-limit'

/**
 * The tighter policy sign-in was promised and never given.
 *
 * ## What was there instead
 *
 * `lib/api-scope.ts` exempts all of `/api/auth/` from the gateway limit, and
 * says why:
 *
 *   > `/api/auth/*` — sign-in needs its own far tighter policy; a shared 30/min
 *   > is both too loose to matter and too tight to be a real product.
 *
 * The reasoning is right. The policy was never written. The code-flow routes —
 * `verify/*`, `password/*` — carry their own `codeRateLimit` and were fine, but
 * `login`, `register` and the two Pi routes had **no limit at all**: exempt from
 * the middleware by that regex, and holding nothing of their own. A comment
 * describing an intention as though it were a fact, guarding the one endpoint
 * where guessing is the attack.
 *
 * ## Two keys, because there are two attacks
 *
 * **Per caller** stops one address working through a password list.
 *
 * **Per subject** stops the same account being hammered from many addresses,
 * which is what credential stuffing actually looks like and what a per-IP limit
 * alone never sees. The subject is the identifier being *claimed* — an email, a
 * Pi username — hashed into the key rather than stored, and never logged.
 *
 * A request must pass both. The subject bucket is deliberately more generous
 * than the caller bucket: a shared office address retrying one account is a
 * person who forgot their password, and locking the account out on their
 * behalf would hand anyone a denial-of-service against any user by typing their
 * email a few times.
 *
 * ## What this is not
 *
 * The counters live in this process. Behind several instances an attacker gets
 * one budget per instance, and `docs/PLAN.md` carries distributed limiting as
 * an open item against a durable store. Saying so is the point: this raises the
 * cost of guessing a great deal, and it is not a lockout.
 */

/** Attempts per minute from one address, across every sign-in surface. */
export const SIGN_IN_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 }

/**
 * Attempts per minute against one identity, from anywhere.
 *
 * Higher than the caller limit on purpose — see above on why a tight number
 * here is a denial-of-service handed to anyone who knows a user's email.
 */
export const SIGN_IN_SUBJECT_LIMIT: RateLimitOptions = { limit: 20, windowMs: 60_000 }

export const signInLimiter = new RateLimiter(SIGN_IN_LIMIT)
export const signInSubjectLimiter = new RateLimiter(SIGN_IN_SUBJECT_LIMIT)

/**
 * A stable, non-reversible key for the identity being claimed.
 *
 * Lower-cased and trimmed so `A@b.co ` and `a@b.co` share a bucket — otherwise
 * the limit is bypassed by changing the capitalisation. Not a security hash and
 * not treated as one: it exists so the counter map never holds an address.
 */
export function subjectKey(subject: string): string {
  const normalised = subject.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < normalised.length; i += 1) {
    hash = (hash * 31 + normalised.charCodeAt(i)) | 0
  }
  return `s:${hash}`
}

const refusal = (retryAfterSeconds: number, headers: Record<string, string>) =>
  NextResponse.json(
    {
      // No hint about which bucket was hit, and no hint about whether the
      // account exists. "Too many attempts" is the whole answer.
      error: 'Too many sign-in attempts. Wait a moment and try again.',
      retryAfterSeconds,
    },
    { status: 429, headers },
  )

/**
 * Gate a sign-in attempt. Returns a 429 response to send, or `null` to proceed.
 *
 * `subject` is the identifier being claimed, when the route has read one. Omit
 * it and only the per-caller budget applies — which is the correct behaviour
 * for a route that has not parsed a body yet.
 */
export function signInRateLimit(request: Request, subject?: string | null): NextResponse | null {
  const caller = signInLimiter.check(callerKey(request.headers))
  if (!caller.ok) {
    return refusal(caller.retryAfterSeconds, rateLimitHeaders(caller, SIGN_IN_LIMIT))
  }

  const claimed = (subject ?? '').trim()
  if (!claimed) return null

  const bySubject = signInSubjectLimiter.check(subjectKey(claimed))
  if (!bySubject.ok) {
    return refusal(bySubject.retryAfterSeconds, rateLimitHeaders(bySubject, SIGN_IN_SUBJECT_LIMIT))
  }
  return null
}
