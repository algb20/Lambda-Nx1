import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { recordRunSafely } from '@/lib/modules/history'
import { broadcastsReport } from '@/lib/modules/broadcasts'

/**
 * POST /api/intelligence/broadcasts — what is on air right now, by country.
 *
 * A two-letter query is a country code; anything else is a name search; nothing
 * returns the most-opened stations worldwide. Only streams that answered their
 * last health check are returned, each stating when that was.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  let body: { value?: unknown; query?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // Empty body is valid: it means "what is most listened to right now".
  }
  const query =
    typeof body.value === 'string' ? body.value : typeof body.query === 'string' ? body.query : ''

  try {
    const report = await broadcastsReport(query)
    const userId = await getSessionUserId().catch(() => null)
    if (userId) await recordRunSafely({ userId, gateway: 'broadcasts', subject: query, report })
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Broadcast lookup failed' },
      { status: 502 },
    )
  }
}
