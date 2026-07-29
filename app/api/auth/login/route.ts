import { NextResponse } from 'next/server'
import { loginUser } from '@/lib/auth/standalone'
import { defaultStandaloneDeps } from '@/lib/auth/standalone-deps'
import { attachSession } from '@/lib/auth/cookie'

/** POST /api/auth/login { email, password } — standalone (off-Pi) sign-in. */
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
    const { userId } = await loginUser(email, password, defaultStandaloneDeps)
    const res = NextResponse.json({ id: userId, username: email.trim().toLowerCase() })
    attachSession(res, userId)
    return res
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Login failed' },
      { status: 401 },
    )
  }
}
