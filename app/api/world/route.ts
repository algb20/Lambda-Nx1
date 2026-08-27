import { NextResponse } from 'next/server'
import { getWorldEvents } from '@/lib/modules/world-events'
import type { SweepTier } from '@/lib/modules/first-light'

/**
 * GET /api/world — the live world picture the globe and the map both draw:
 * measured natural hazards and seismic events with coordinates, plus reported
 * humanitarian and world events. Every item carries its source, timestamp and
 * Admiralty rating. Fans out across two capabilities in parallel; the 60s
 * ceiling is a safety net, not the expected duration.
 *
 * ## `?tier=first-light`
 *
 * Reads the fourteen worldwide hazard authorities instead of all 174, so the
 * map has something true on it while the rest are still being asked. The
 * response says which pass it came from in `tier`, and the browser's store
 * asks for this one first and the full one immediately after.
 *
 * An unknown `tier` is the full sweep rather than an error. The parameter is a
 * performance hint, and refusing to serve the world because a query string was
 * misspelled would trade a slower answer for no answer.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get('tier')
  const tier: SweepTier = asked === 'first-light' ? 'first-light' : 'full'
  try {
    return NextResponse.json(await getWorldEvents({ tier }))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'World events fetch failed' },
      { status: 502 },
    )
  }
}
