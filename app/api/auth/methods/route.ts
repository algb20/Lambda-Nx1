import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { canIssueSessions } from '@/lib/auth/session'
import { mailConfigured } from '@/lib/mail'

/**
 * GET /api/auth/methods — what this deployment can actually offer.
 *
 * The sign-in form needs this because the answer is a property of the
 * *deployment*, not of the code: the same build runs inside Pi Browser, on a
 * host with mail configured, and on a preview with neither. Without it the form
 * has to guess, and a guess here means showing a "Forgot password?" link that
 * leads to a 503 — which reads as a broken product rather than an unconfigured
 * one.
 *
 * It reveals only which flows exist, never which provider or which address they
 * come from.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const db = isDbConfigured()
  const sessions = canIssueSessions()
  const accounts = db && sessions
  const mail = mailConfigured()

  /**
   * *Why* email sign-up is off, not merely that it is.
   *
   * This field exists because its absence cost days. `emailSignUp` is
   * `accounts && mail`, and the form — seeing one `false` — told the owner
   * "no mail provider is configured". On a deployment with mail working
   * perfectly and no `DATABASE_URL`, that message is simply untrue: there is
   * nowhere to store a user, which is a different missing piece entirely. The
   * owner chased a mail problem that did not exist while the real one went
   * unnamed.
   *
   * A boolean cannot carry a reason. This can.
   */
  const emailSignUpOffBecause: 'database' | 'sessions' | 'mail' | null = accounts && mail
    ? null
    : !db
      ? 'database'
      : !sessions
        ? 'sessions'
        : 'mail'

  return NextResponse.json({
    /** Whether accounts work at all here. */
    accounts,
    /** Email + password sign-up, with a mailed verification code. */
    emailSignUp: accounts && mail,
    /** "Forgot password" — needs mail, since the code has to reach somebody. */
    passwordReset: accounts && mail,
    /** Pi sign-in never needs mail: Pi vouches for the identity itself. */
    pi: accounts,
    /** Which piece is missing. Never a provider name, never a value. */
    emailSignUpOffBecause,
  })
}
