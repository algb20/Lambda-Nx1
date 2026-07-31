import { NextResponse } from 'next/server'
import { investigateNews } from '@/lib/modules/news'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/intelligence/news  { query?: string }
 * Top world signals when query is empty; topic coverage when a topic is given.
 */
export async function POST(request: Request) {
  let body: { query?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const query = typeof body.query === 'string' ? body.query.trim() : ''

  try {
    return NextResponse.json(await investigateNews(query))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'News fetch failed' },
      { status: 502 },
    )
  }
}
