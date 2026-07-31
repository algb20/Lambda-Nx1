import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured, repo } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/suggestions/vote { id } — upvote a suggestion (demand signal). */
export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isDbConfigured())
    return NextResponse.json({ error: 'Suggestions store is not configured yet.' }, { status: 503 })

  let body: { id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const row = await repo.suggestions.incrementVotes(id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}
