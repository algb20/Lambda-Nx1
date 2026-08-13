import { NextResponse } from 'next/server'
import { registerUser } from '@/lib/auth/standalone'
import { defaultStandaloneDeps } from '@/lib/auth/standalone-deps'
import { attachSession } from '@/lib/auth/cookie'
import { canIssueSessions } from '@/lib/auth/session'
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

  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''

  try {
    const { userId } = await registerUser(email, password, defaultStandaloneDeps)
    const res = NextResponse.json({ id: userId, username: email.trim().toLowerCase() })
    attachSession(res, userId)
    return res
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Registration failed' },
      { status: 400 },
    )
  }
}
