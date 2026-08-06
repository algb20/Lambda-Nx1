import { NextResponse } from 'next/server'
import { PLAN_LIST, TIERS_ENFORCED } from '@/lib/plans/plans'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured, repo } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/plans — public pricing + features (driven by lib/plans, the single
 * source of truth). Includes the caller's current plan when signed in.
 */
export async function GET() {
  let current: 'free' | 'pro' = 'free'
  const userId = await getSessionUserId().catch(() => null)
  if (userId && isDbConfigured()) {
    current = await repo.users.getPlan(userId).catch(() => 'free')
  }
  return NextResponse.json({ plans: PLAN_LIST, current, enforced: TIERS_ENFORCED })
}
