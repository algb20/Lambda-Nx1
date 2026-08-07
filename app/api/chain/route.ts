import { NextResponse } from 'next/server'
import { chainRadar } from '@/lib/modules/chain-radar'

/**
 * GET /api/chain — the blockchain radar: Bitcoin network state (chain tip,
 * mempool, fees) plus market structure and the day's real movers. Fans out
 * across two capabilities in parallel; the 60s ceiling is a safety net.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    return NextResponse.json(await chainRadar())
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chain radar fetch failed' },
      { status: 502 },
    )
  }
}
