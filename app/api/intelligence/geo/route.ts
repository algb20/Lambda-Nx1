import { NextResponse } from 'next/server'
import { investigateGeo } from '@/lib/modules/geo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/**
 * Gateways fan out to several public providers. The platform default (10s) is
 * below the worst realistic case, and being killed mid-request returns an HTML
 * error page where the client expects JSON — which is how the world map ended
 * up empty. Sources also run in parallel and each carries its own deadline, so
 * this ceiling is a safety net, not the normal path.
 */
export const maxDuration = 60

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
    return NextResponse.json(await investigateGeo(query))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Investigation failed' },
      { status: 400 },
    )
  }
}
