import { NextResponse } from 'next/server'
import { investigateThreat } from '@/lib/modules/threat'

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
  let body: { indicator?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const indicator = typeof body.indicator === 'string' ? body.indicator.trim() : ''
  if (!indicator) return NextResponse.json({ error: 'Provide an "indicator".' }, { status: 400 })

  try {
    return NextResponse.json(await investigateThreat(indicator))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Investigation failed' },
      { status: 400 },
    )
  }
}
