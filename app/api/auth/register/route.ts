import { NextResponse } from 'next/server'
import { registerUser } from '@/lib/auth/standalone'
import { defaultStandaloneDeps } from '@/lib/auth/standalone-deps'
import { attachSession } from '@/lib/auth/cookie'
import { canIssueSessions } from '@/lib/auth/session'
import { normalizeUsername } from '@/lib/auth/policy'
import { isDbConfigured } from '@/lib/db'

/**
 * POST /api/auth/register { email, password } — standalone (off-Pi) sign-up.
 *
 * The two preflight checks matter more than they look. Registration writes a
 * user row and *then* signs the session cookie; if the deployment cannot sign
 * one, the account is created and the person is left signed out, and their
 * second attempt tells them the email is already taken. Asking first turns a
 * corrupted signup into an honest "not available right now".
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isDbConfigured() || !canIssueSessions()) {
    // Deliberately vague to the client, loud in the logs: which piece of
    // configuration is missing is an operator's business, not a visitor's.
    console.error(
      `[auth/register] refusing sign-up — db configured: ${isDbConfigured()}, session secret usable: ${canIssueSessions()}`,
    )
    return NextResponse.json(
      { error: 'Accounts are temporarily unavailable on this deployment. Try again later.' },
      { status: 503 },
    )
  }

  let body: { email?: unknown; password?: unknown; username?: unknown; fullName?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const username = typeof body.username === 'string' ? body.username : ''
  /**
   * The real name, which this route was silently dropping.
   *
   * `registerUser` accepts it, `normalizeFullName` validates it and
   * `createUserAndCredential` writes it — the whole feature was built and this
   * one line was missing, so every account created since carried no name and
   * nothing anywhere said so. Found by registering an account against a real
   * database and reading the row back, not by any test: every layer below was
   * tested in isolation and each one passed.
   *
   * Stored, never shown: `showRealName` defaults to false, so giving a name
   * here publishes nothing until its owner opens the eye.
   */
  const fullName = typeof body.fullName === 'string' ? body.fullName : ''

  try {
    const { userId } = await registerUser(
      email,
      password,
      username,
      defaultStandaloneDeps,
      fullName,
    )
    const res = NextResponse.json({ id: userId, username: normalizeUsername(username) })
    attachSession(res, userId)
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed'
    // The unique constraint is the real arbiter of a free handle: the
    // availability check before it is advisory, so two sign-ups racing on one
    // name both pass it and one loses here. Translate that into the same
    // sentence the check would have given rather than a database error.
    if (/users_username_uq/i.test(message)) {
      return NextResponse.json({ error: 'That username is taken' }, { status: 409 })
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
