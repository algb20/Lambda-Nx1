import { NextResponse } from 'next/server'
import { getAuthProvider } from '@/lib/auth'
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session'
import { repo } from '@/lib/db'

/**
 * POST /api/auth/pi  { pi_auth_token }
 * Our own login: verify the Pi access token via lib/auth, upsert the user in our
 * database, and set a signed session cookie. Independent of the App Studio
 * default backend.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { pi_auth_token?: unknown; accessToken?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token =
    typeof body.pi_auth_token === 'string'
      ? body.pi_auth_token
      : typeof body.accessToken === 'string'
        ? body.accessToken
        : ''
  if (!token) {
    return NextResponse.json({ error: 'Missing access token' }, { status: 400 })
  }

  const identity = await getAuthProvider().verify(token)
  if (!identity) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const user = await repo.users.upsert({
    authProvider: identity.provider,
    externalId: identity.externalId,
    displayName: identity.displayName,
  })

  const res = NextResponse.json({ id: user.id, username: user.displayName ?? identity.externalId })
  res.cookies.set(SESSION_COOKIE, createSession(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
