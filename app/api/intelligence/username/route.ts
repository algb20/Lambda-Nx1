import { NextResponse } from 'next/server'
import { investigateUsername } from '@/lib/modules/identity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { username?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  if (!username) return NextResponse.json({ error: 'Provide a "username".' }, { status: 400 })

  try {
    return NextResponse.json(await investigateUsername(username))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Investigation failed' },
      { status: 400 },
    )
  }
}
