import { NextResponse } from 'next/server'
import { getAuthProvider } from '@/lib/auth'
import { attachSession } from '@/lib/auth/cookie'
import { repo } from '@/lib/db'
import { normalizeUsername, usernameProblem } from '@/lib/auth/policy'

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

  /**
   * A pioneer never chooses a handle here — Pi already assigned them one, and
   * it arrives verified by Pi itself. Registration for a Pi user is therefore
   * the sign-in: no form, no second name to invent.
   *
   * The handle is only offered if it fits our shape and is not reserved. If it
   * does not, the account is still created and simply carries no handle, which
   * is far better than refusing a verified pioneer entry over a name they did
   * not pick and cannot change.
   */
  const piHandle = normalizeUsername(identity.externalId)
  const handleUsable = usernameProblem(piHandle) === null

  const user = await repo.users.upsert({
    authProvider: identity.provider,
    externalId: identity.externalId,
    displayName: identity.displayName ?? identity.externalId,
    ...(handleUsable ? { username: piHandle } : {}),
  })

  const res = NextResponse.json({
    id: user.id,
    username: user.username ?? user.displayName ?? identity.externalId,
  })
  attachSession(res, user.id)
  return res
}
