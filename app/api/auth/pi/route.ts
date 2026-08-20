import { NextResponse } from 'next/server'
import { getAuthProvider } from '@/lib/auth'
import { attachSession } from '@/lib/auth/cookie'
import { repo } from '@/lib/db'
import { isUsernameConflict, piHandleFor } from '@/lib/auth/pi-identity'
import { publicNameFor } from '@/lib/users/public-name'

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
   * the sign-in: no form, no email, no second name to invent.
   *
   * The handle comes from `identity.username`, which is Pi's `username` field,
   * **not** from `externalId`, which is Pi's opaque `uid`. Reading the uid here
   * was a real defect with a silent symptom: a UUID is 36 characters and
   * contains hyphens, so it failed the username rules, `handleUsable` was
   * always false, and every pioneer got an account with no handle at all. They
   * saw their Pi name (it came through `displayName`) and had no idea the thing
   * that identifies them across the product was empty.
   *
   * The handle is still only taken if it fits our shape and is not reserved. If
   * it does not, the account is created and carries no handle — far better than
   * refusing a verified pioneer entry over a name they did not pick.
   *
   * Because `repo.users.upsert` fills a handle in and never overwrites one,
   * pioneers whose accounts were created while the uid bug was live get their
   * real handle on their next sign-in. No migration, no support request.
   */
  const piHandle = piHandleFor(identity)
  /**
   * The display name is the *same* decision as the handle, deliberately.
   *
   * Two things a live run caught, both of which had the account carrying a
   * name it should never have shown:
   *
   *  - A pioneer whose Pi username is `admin` was correctly refused the handle
   *    and then displayed as "admin" anyway, through the display name. That
   *    defeats the entire purpose of the reserved list, which exists because
   *    someone appearing as `admin` is how an account-recovery scam starts.
   *  - A Pi response with no `username` fell back to `externalId`, so the
   *    account's public name became a raw UUID.
   *
   * If Pi's name cannot be held as a handle here, it is not shown as a name
   * either. `publicNameFor` then falls through to a neutral word, which is
   * honest — we do not have a name we can show for this account.
   */
  const displayName = piHandle

  let user
  try {
    user = await repo.users.upsert({
      authProvider: identity.provider,
      externalId: identity.externalId,
      displayName,
      ...(piHandle ? { username: piHandle } : {}),
    })
  } catch (error) {
    // Someone else already holds this handle — an off-Pi sign-up can take a name
    // a pioneer holds on Pi. The pioneer is verified; the handle is a nicety.
    // Let them in without it rather than failing a sign-in over a name.
    if (!piHandle || !isUsernameConflict(error)) throw error
    user = await repo.users.upsert({
      authProvider: identity.provider,
      externalId: identity.externalId,
      displayName,
    })
  }

  const res = NextResponse.json({
    id: user.id,
    username: publicNameFor(user),
  })
  attachSession(res, user.id)
  return res
}
