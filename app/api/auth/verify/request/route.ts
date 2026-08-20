import { NextResponse } from 'next/server'
import { normalizeEmail } from '@/lib/auth/standalone'
import { defaultVerificationStore } from '@/lib/auth/standalone-deps'
import { issueCode } from '@/lib/auth/verification'
import {
  accountsUnavailable,
  codeRateLimit,
  deliverCode,
  readJson,
  str,
} from '@/lib/auth/code-flow'
import { mailConfigured } from '@/lib/mail'

/**
 * POST /api/auth/verify/request { email, locale } — step one of off-Pi sign-up.
 *
 * Mails a six-digit code to the address so the account is created against an
 * address its owner actually reads.
 *
 * **It does not check whether the address already has an account, and that is
 * on purpose.** Answering "already registered" here would make this endpoint a
 * membership oracle: feed it a list of addresses and it tells you which of those
 * people use the product. So a code goes out either way, and the refusal — if
 * there is one — happens at `confirm`, where you only get to see it by holding
 * a code we mailed, which means by owning the mailbox.
 *
 * The cost is one email to somebody who already has an account and forgot. The
 * alternative is a lookup service for our user list.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function POST(request: Request) {
  const unavailable = accountsUnavailable('auth/verify/request')
  if (unavailable) return unavailable
  const limited = codeRateLimit(request)
  if (limited) return limited

  if (!mailConfigured()) {
    // Saying so plainly beats accepting the request and sending nothing: a user
    // waiting for a code that cannot exist will retry for an hour.
    return NextResponse.json(
      {
        error:
          'Email sign-up is not available yet on this deployment: no mail provider is configured, so the verification code has nowhere to be sent. This is a setting the operator has to add, not something you can work around.',
      },
      { status: 503 },
    )
  }

  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const email = normalizeEmail(str(body.email))
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  const issued = await issueCode(email, 'signup', { store: defaultVerificationStore })
  if (issued.status === 'cooldown') {
    return NextResponse.json(
      {
        error: `A code was already sent. You can ask for another in ${issued.retryAfterSeconds} seconds.`,
        retryAfterSeconds: issued.retryAfterSeconds,
      },
      { status: 429, headers: { 'retry-after': String(issued.retryAfterSeconds) } },
    )
  }

  const sent = await deliverCode({
    to: email,
    code: issued.code,
    purpose: 'signup',
    locale: str(body.locale) || undefined,
  })
  if (!sent.delivered) {
    return NextResponse.json(
      { error: 'We could not send the code. Check the address, or try again in a moment.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ sent: true, expiresAt: issued.expiresAt.toISOString() })
}
