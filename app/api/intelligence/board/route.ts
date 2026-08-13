import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { recordRunSafely } from '@/lib/modules/history'
import { marketsBoard } from '@/lib/modules/markets-board'

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

/** POST /api/intelligence/board — a live multi-class markets overview (no input). */
export async function POST() {
  try {
    const report = await marketsBoard()
    // Best-effort history: a failed archive must never cost the result.
    const userId = await getSessionUserId().catch(() => null)
    if (userId) {
      await recordRunSafely({ userId, gateway: 'board', subject: "", report })
    }
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Board fetch failed' },
      { status: 502 },
    )
  }
}
