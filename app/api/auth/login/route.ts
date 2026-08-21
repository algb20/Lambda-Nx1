import { NextResponse } from 'next/server'
import { classifyIdentifier, loginUser } from '@/lib/auth/standalone'
import { defaultStandaloneDeps } from '@/lib/auth/standalone-deps'
import { attachSession } from '@/lib/auth/cookie'
import { accountsUnavailable, databaseUnavailable } from '@/lib/auth/code-flow'

/**
 * POST /api/auth/login { identifier, password } — off-Pi sign-in.
 *
 * `identifier` is either an email address or a Pi Network username; we work out
 * which. A Pi username only works once its owner has claimed it from inside the
 * Pi Browser (see /api/auth/pi/claim), so typing someone else's username gets
 * you nowhere.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  /**
   * Asks the database, not the environment.
   *
   * The old check was `isDbConfigured()`, which is true for any non-empty
   * string. With an unreachable host it passed, `loginUser` threw, and the
   * catch at the bottom of this function turned that into `401 Sign-in failed`
   * — telling people their own password was wrong while the database was down.
   * That is the worst possible lie for this endpoint to tell: it sends someone
   * to reset a password that was never the problem.
   */
  const unavailable = await accountsUnavailable('auth/login')
  if (unavailable) return unavailable

  let body: { identifier?: unknown; email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const identifier =
    typeof body.identifier === 'string'
      ? body.identifier
      : typeof body.email === 'string'
        ? body.email
        : ''
  const password = typeof body.password === 'string' ? body.password : ''

  try {
    const { userId } = await loginUser(identifier, password, defaultStandaloneDeps)
    const id = classifyIdentifier(identifier)
    const res = NextResponse.json({
      id: userId,
      username: id.kind === 'invalid' ? identifier.trim() : id.value,
    })
    attachSession(res, userId)
    return res
  } catch (err) {
    // Never let an outage be reported as bad credentials. See above.
    const down = databaseUnavailable('auth/login', err)
    if (down) return down
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sign-in failed' },
      { status: 401 },
    )
  }
}
