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
import { isDbConfigured } from '@/lib/db'
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

/** Reject early if this deployment cannot do accounts at all. */
export function accountsUnavailable(route: string): NextResponse | null {
  if (isDbConfigured() && canIssueSessions()) return null
  console.error(
    `[${route}] refusing — db configured: ${isDbConfigured()}, session secret usable: ${canIssueSessions()}`,
  )
  return NextResponse.json(
    { error: 'Accounts are temporarily unavailable on this deployment. Try again later.' },
    { status: 503 },
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
