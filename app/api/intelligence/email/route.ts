import { NextResponse } from 'next/server'
import { investigateEmail } from '@/lib/modules/identity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { email?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email) return NextResponse.json({ error: 'Provide an "email".' }, { status: 400 })

  try {
    return NextResponse.json(await investigateEmail(email))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Investigation failed' },
      { status: 400 },
    )
  }
}
