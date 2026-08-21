import { NextResponse } from 'next/server'
import { normalizeEmail, registerUser } from '@/lib/auth/standalone'
import { defaultStandaloneDeps, defaultVerificationStore } from '@/lib/auth/standalone-deps'
import { checkCode, looksLikeCode } from '@/lib/auth/verification'
import { attachSession } from '@/lib/auth/cookie'
import { normalizeUsername } from '@/lib/auth/policy'
import {
  accountsUnavailable,
  codeFailureMessage,
  codeRateLimit,
  databaseUnavailable,
  readJson,
  str,
} from '@/lib/auth/code-flow'

/**
 * POST /api/auth/verify/confirm { email, code, password, username } — step two.
 *
 * The order of operations is the security property: the code is spent *before*
 * the account is created, so a request that races another cannot create two
 * accounts, and a code that has already made an account cannot make a second.
 *
 * The cost of that order is that a valid code plus a taken username burns the
 * code. That is the right way round — the user asks for a new code and keeps
 * their account, rather than a spare code staying live in a mailbox.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const unavailable = await accountsUnavailable('auth/verify/confirm')
  if (unavailable) return unavailable
  const limited = codeRateLimit(request)
  if (limited) return limited

  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const email = normalizeEmail(str(body.email))
  const code = str(body.code)
  const password = str(body.password)
  const username = str(body.username)

  if (!looksLikeCode(code)) {
    // Refused without touching the database, so a flood of nonsense cannot burn
    // the real attempt budget of whoever is genuinely mid-signup.
    return NextResponse.json({ error: 'Enter the six-digit code from the email' }, { status: 400 })
  }

  // Reading the stored code is a database call, and a database that has gone
  // away must not reach the user as "that code is not right" — which is what a
  // thrown error looks like once it falls through to a generic handler.
  let result: Awaited<ReturnType<typeof checkCode>>
  try {
    result = await checkCode(email, 'signup', code, { store: defaultVerificationStore })
  } catch (err) {
    const down = databaseUnavailable('auth/verify/confirm', err)
    if (down) return down
    throw err
  }

  if (result.status !== 'ok') {
    return NextResponse.json(
      { error: codeFailureMessage(result.status, 'attemptsLeft' in result ? result.attemptsLeft : undefined) },
      { status: result.status === 'wrong' ? 401 : 400 },
    )
  }

  try {
    const { userId } = await registerUser(
      email,
      password,
      username,
      defaultStandaloneDeps,
      str(body.fullName),
    )
    const res = NextResponse.json({ id: userId, username: normalizeUsername(username) })
    attachSession(res, userId)
    return res
  } catch (err) {
    /**
     * Infrastructure first, always.
     *
     * The branches below turn an error into "that username is taken" or into a
     * 400 carrying the raw message — both of which blame the person typing. A
     * database that stopped answering would have been reported to them as their
     * own mistake, and they would have kept trying different usernames.
     */
    const down = databaseUnavailable('auth/verify/confirm', err)
    if (down) return down

    const message = err instanceof Error ? err.message : 'Registration failed'
    if (/users_username_uq/i.test(message)) {
      return NextResponse.json({ error: 'That username is taken' }, { status: 409 })
    }
    if (/already registered/i.test(message)) {
      // Only reachable by someone holding a code we mailed — so this reveals
      // nothing to anyone who does not already own the mailbox.
      return NextResponse.json(
        { error: 'That address already has an account. Sign in, or reset the password.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
