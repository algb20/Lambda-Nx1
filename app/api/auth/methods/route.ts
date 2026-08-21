import { NextResponse } from 'next/server'
import { databaseAvailability, isDbConfigured } from '@/lib/db'
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
  /**
   * A live round trip, not a variable.
   *
   * This endpoint decides what the sign-in form offers, so answering from
   * `isDbConfigured()` alone means offering sign-up on a deployment whose
   * database cannot be reached — and that is exactly what happened: the form
   * showed "create an account", the button returned an empty 500, and the
   * product looked broken in a way no message explained.
   *
   * The check is memoised per instance (thirty seconds when healthy, five when
   * not), so a healthy deployment pays for it at most twice a minute, and a
   * repaired one recovers within seconds of the fix.
   */
  const live = await databaseAvailability()
  const db = isDbConfigured() && live.live
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
  const emailSignUpOffBecause:
    | 'database'
    | 'database_unreachable'
    | 'sessions'
    | 'mail'
    | null = accounts && mail
    ? null
    : !isDbConfigured()
      ? 'database'
      : // Configured but not answering. A separate value because the two need
        // different sentences and, more importantly, different people: one is
        // "nothing has been set up here", the other is "something that was
        // working has stopped", and telling an owner the first when the second
        // is true sends them to build what they already built.
        !live.live
        ? 'database_unreachable'
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
