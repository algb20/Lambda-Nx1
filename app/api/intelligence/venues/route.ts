import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { recordRunSafely } from '@/lib/modules/history'
import { venuesReport } from '@/lib/modules/venues'

/**
 * POST /api/intelligence/venues — every trading venue on earth, searchable.
 *
 * An empty query returns the registry's leading entries rather than nothing: a
 * venue directory that demands a search term before showing anything is a
 * directory nobody browses.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  let body: { value?: unknown; query?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // An empty body is a valid request here — it means "show me the registry".
  }
  const query =
    typeof body.value === 'string' ? body.value : typeof body.query === 'string' ? body.query : ''

  try {
    const report = await venuesReport(query)
    const userId = await getSessionUserId().catch(() => null)
    if (userId) await recordRunSafely({ userId, gateway: 'venues', subject: query, report })
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Venue lookup failed' },
      { status: 502 },
    )
  }
}
