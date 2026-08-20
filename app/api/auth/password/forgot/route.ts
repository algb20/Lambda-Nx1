import { NextResponse } from 'next/server'
import { normalizeEmail } from '@/lib/auth/standalone'
import { defaultVerificationStore } from '@/lib/auth/standalone-deps'
import { issueCode } from '@/lib/auth/verification'
import { repo } from '@/lib/db'
import { accountsUnavailable, codeRateLimit, deliverCode, readJson, str } from '@/lib/auth/code-flow'
import { mailConfigured } from '@/lib/mail'

/**
 * POST /api/auth/password/forgot { email, locale } — ask for a reset code.
 *
 * **Always answers the same.** Whether the address has an account, whether a
 * code was issued, whether the mail was accepted — one response. This is the
 * single most important line in the file: a reset form that distinguishes
 * "no such account" from "code sent" is a membership oracle, and this product's
 * own charter forbids building profiles of private individuals. Shipping one on
 * our own sign-in page would be the clearest possible contradiction of that.
 *
 * The cooldown is applied silently for the same reason: a 429 that only appears
 * for real accounts is the same oracle wearing a different status code.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** The one answer. Identical in every branch below. */
const ACKNOWLEDGED = {
  sent: true,
  message: 'If that address has an account, a reset code is on its way.',
}

export async function POST(request: Request) {
  const unavailable = accountsUnavailable('auth/password/forgot')
  if (unavailable) return unavailable
  const limited = codeRateLimit(request)
  if (limited) return limited

  if (!mailConfigured()) {
    // The one honest exception to answering uniformly: with no mail provider no
    // reset can ever arrive, and that fact is about the deployment, not about
    // whether this particular address has an account. Silence here would leave
    // every user waiting for a code the server has no way to send.
    return NextResponse.json(
      {
        error:
          'Password reset is not available on this deployment — no mail provider is configured.',
      },
      { status: 503 },
    )
  }

  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const email = normalizeEmail(str(body.email))
  if (!EMAIL_RE.test(email)) {
    // A malformed address is a typo, not a probe — saying so helps the user and
    // tells an attacker only what they already typed.
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  try {
    const account = await repo.credentials.getByEmail(email)
    if (account) {
      const issued = await issueCode(email, 'reset', { store: defaultVerificationStore })
      if (issued.status === 'issued') {
        await deliverCode({
          to: email,
          code: issued.code,
          purpose: 'reset',
          locale: str(body.locale) || undefined,
        })
      }
    }
  } catch (error) {
    // Logged for the operator, invisible to the caller: a database failure that
    // changed the answer would leak by its absence.
    console.error(`[auth/password/forgot] ${error instanceof Error ? error.message : error}`)
  }

  return NextResponse.json(ACKNOWLEDGED)
}
