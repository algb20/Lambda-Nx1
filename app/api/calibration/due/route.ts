import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured, repo } from '@/lib/db'
import { dueForReview, type CalibrationClaimRow } from '@/lib/modules/calibration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/calibration/due — claims whose horizon has passed and are still open,
 * i.e. ready to be scored. We surface them; we never fabricate an outcome.
 */
export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isDbConfigured()) return NextResponse.json({ due: [], configured: false })

  const rows = (await repo.calibration.list(1000)) as unknown as CalibrationClaimRow[]
  return NextResponse.json({ due: dueForReview(rows), configured: true })
}
