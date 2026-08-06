import { NextResponse } from 'next/server'
import { registerUser } from '@/lib/auth/standalone'
import { defaultStandaloneDeps } from '@/lib/auth/standalone-deps'
import { attachSession } from '@/lib/auth/cookie'

/** POST /api/auth/register { email, password } — standalone (off-Pi) sign-up. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
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
