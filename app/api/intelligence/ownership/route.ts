import { NextResponse } from 'next/server'
import { investigateOwnership } from '@/lib/modules/ownership'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { query?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) return NextResponse.json({ error: 'Provide a "query".' }, { status: 400 })

  try {
    return NextResponse.json(await investigateOwnership(query))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Investigation failed' },
      { status: 400 },
    )
  }
}
