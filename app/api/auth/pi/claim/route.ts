import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { claimPiUsername } from '@/lib/auth/standalone'
import { defaultClaimDeps } from '@/lib/auth/standalone-deps'
import { repo, isDbConfigured } from '@/lib/db'

/**
 * POST /api/auth/pi/claim { password } — set a passphrase on a Pi account so its
 * username can sign in outside the Pi Browser.
 *
 * The username is never taken from the request body. It is read from the
 * signed-in user's own record, which only exists because the Pi SDK verified
 * them — that is the whole security property, and accepting a username from the
 * client would throw it away.
 *
 * It is read from `user.username` — the handle Pi issued — and **not** from
 * `user.externalId`, which holds Pi's opaque `uid`. Reading the uid here broke
 * the feature completely and in both directions: the panel displayed a UUID to
 * the pioneer as "your Pi username", and submitting it failed validation every
 * time with "Invalid Pi username", because a UUID is not one.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const user = await repo.users.getById(userId)
  // No handle means there is nothing to sign in *as*. That happens when Pi's
  // name does not fit our namespace, or when another account already holds it —
  // rare, and the panel stays hidden rather than offering something that cannot
  // work.
  if (!user || user.authProvider !== 'pi' || !user.username) {
    return NextResponse.json({ eligible: false, piUsername: null, claimed: false })
  }
  const cred = await repo.credentials.getByUserId(userId)
  return NextResponse.json({
    eligible: true,
    piUsername: user.username,
    claimed: Boolean(cred?.piUsername),
  })
}

export async function POST(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const user = await repo.users.getById(userId)
  if (!user) return NextResponse.json({ error: 'Unknown user' }, { status: 401 })
  if (user.authProvider !== 'pi') {
    return NextResponse.json(
      { error: 'Only a Pi-verified account can claim a Pi username' },
      { status: 403 },
    )
  }
  if (!user.username) {
    return NextResponse.json(
      { error: 'This account carries no Pi handle, so there is nothing to sign in as.' },
      { status: 409 },
    )
  }

  let body: { password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const password = typeof body.password === 'string' ? body.password : ''

  try {
    await claimPiUsername(
      { userId, piUsername: user.username, password },
      defaultClaimDeps,
    )
    return NextResponse.json({ ok: true, piUsername: user.username.toLowerCase() })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not link this username' },
      { status: 400 },
    )
  }
}
