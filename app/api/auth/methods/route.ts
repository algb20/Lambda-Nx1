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
  const accounts = isDbConfigured() && canIssueSessions()
  const mail = mailConfigured()
  return NextResponse.json({
    /** Whether accounts work at all here. */
    accounts,
    /** Email + password sign-up, with a mailed verification code. */
    emailSignUp: accounts && mail,
    /** "Forgot password" — needs mail, since the code has to reach somebody. */
    passwordReset: accounts && mail,
    /** Pi sign-in never needs mail: Pi vouches for the identity itself. */
    pi: accounts,
  })
}
