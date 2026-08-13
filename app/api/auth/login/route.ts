import { NextResponse } from 'next/server'
import { classifyIdentifier, loginUser } from '@/lib/auth/standalone'
import { defaultStandaloneDeps } from '@/lib/auth/standalone-deps'
import { attachSession } from '@/lib/auth/cookie'
import { canIssueSessions } from '@/lib/auth/session'
import { isDbConfigured } from '@/lib/db'

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
  if (!isDbConfigured() || !canIssueSessions()) {
    console.error(
      `[auth/login] refusing sign-in — db configured: ${isDbConfigured()}, session secret usable: ${canIssueSessions()}`,
    )
    return NextResponse.json(
      { error: 'Sign-in is temporarily unavailable on this deployment. Try again later.' },
      { status: 503 },
    )
  }

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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sign-in failed' },
      { status: 401 },
    )
  }
}
