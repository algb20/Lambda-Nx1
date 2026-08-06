import { NextResponse } from 'next/server'
import { investigateNexus } from '@/lib/modules/nexus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/intelligence/nexus  { query }
 * Unified investigation: classify the selector and fan out across every relevant
 * gateway in parallel, returning one fused, graded dossier.
 */
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
    return NextResponse.json(await investigateNexus(query))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Investigation failed' },
      { status: 400 },
    )
  }
}
