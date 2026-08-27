import { NextResponse } from 'next/server'
import { constellation } from '@/lib/modules/constellation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * One upstream request, then a hundred-node correlation matrix and a four
 * hundred iteration layout. Measured on this build the whole thing is a couple
 * of seconds; the ceiling is a safety net for a slow provider, matching the
 * other gateway routes.
 */
export const maxDuration = 60

/**
 * GET /api/markets/constellation — the asset tree over real price histories.
 *
 * GET rather than POST because it takes no input and the answer is the same for
 * every caller, which also means it can be cached at the edge.
 *
 * ## The cache header is the rate limiter
 *
 * CoinGecko throttles keyless callers by IP, and every viewer of this surface
 * shares one server IP. Without a shared cache, ten readers opening the page in
 * a minute would spend ten calls and the eleventh would get a 429 — the exact
 * failure that emptied the world map. Five minutes is well inside the hourly
 * resolution of the underlying series: re-fetching faster cannot produce a
 * different picture, because the provider has not published a new hourly close.
 */
export async function GET() {
  try {
    const report = await constellation()
    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Constellation build failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
