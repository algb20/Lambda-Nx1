import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { recordRunSafely } from '@/lib/modules/history'
import { propertyReport } from '@/lib/modules/property'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/**
 * Three statistical authorities, one of which (FRED) is fetched once per series.
 * The platform default of 10s is below the worst realistic case, and being
 * killed mid-request returns an HTML error page where the client expects JSON.
 */
export const maxDuration = 60

/** POST /api/intelligence/property — housing prices, activity, rates and supply. */
export async function POST() {
  try {
    const report = await propertyReport()
    // Best-effort history: a failed archive must never cost the result.
    const userId = await getSessionUserId().catch(() => null)
    if (userId) {
      await recordRunSafely({ userId, gateway: 'property', subject: '', report })
    }
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Property data fetch failed' },
      { status: 502 },
    )
  }
}
