import { NextResponse } from 'next/server'
import { normalizeEmail, resetPassword } from '@/lib/auth/standalone'
import { defaultResetDeps, defaultVerificationStore } from '@/lib/auth/standalone-deps'
import { checkCode, looksLikeCode } from '@/lib/auth/verification'
import { attachSession } from '@/lib/auth/cookie'
import {
  accountsUnavailable,
  codeFailureMessage,
  codeRateLimit,
  readJson,
  str,
} from '@/lib/auth/code-flow'

/**
 * POST /api/auth/password/reset { email, code, password } — finish a reset.
 *
 * On success the person is signed in immediately. A reset that ends at the
 * login screen asks someone to type, from memory, the password they chose four
 * seconds ago — which is precisely where they mistype it and start the whole
 * loop again.
 *
 * An address with no account still answers 200 here. It can only get this far by
 * carrying a code we mailed, so there is nothing to protect; answering
 * differently would reintroduce the membership oracle that `forgot` exists to
 * avoid.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const unavailable = accountsUnavailable('auth/password/reset')
  if (unavailable) return unavailable
  const limited = codeRateLimit(request)
  if (limited) return limited

  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const email = normalizeEmail(str(body.email))
  const code = str(body.code)
  const password = str(body.password)

  if (!looksLikeCode(code)) {
    return NextResponse.json({ error: 'Enter the six-digit code from the email' }, { status: 400 })
  }

  const result = await checkCode(email, 'reset', code, { store: defaultVerificationStore })
  if (result.status !== 'ok') {
    return NextResponse.json(
      { error: codeFailureMessage(result.status, 'attemptsLeft' in result ? result.attemptsLeft : undefined) },
      { status: result.status === 'wrong' ? 401 : 400 },
    )
  }

  try {
    const account = await resetPassword(email, password, defaultResetDeps)
    if (!account) return NextResponse.json({ reset: true })
    const res = NextResponse.json({ reset: true, id: account.userId })
    attachSession(res, account.userId)
    return res
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not set the new password' },
      { status: 400 },
    )
  }
}
