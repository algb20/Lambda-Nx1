import { NextResponse } from 'next/server'
import { getWorldEvents } from '@/lib/modules/world-events'

/**
 * GET /api/world — the live world picture the globe and the map both draw:
 * measured natural hazards and seismic events with coordinates, plus reported
 * humanitarian and world events. Every item carries its source, timestamp and
 * Admiralty rating. Fans out across two capabilities in parallel; the 60s
 * ceiling is a safety net, not the expected duration.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    return NextResponse.json(await getWorldEvents())
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'World events fetch failed' },
      { status: 502 },
    )
  }
}
