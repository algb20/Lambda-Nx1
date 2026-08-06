import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { analyzeFindings } from '@/lib/modules/analyst'
import { AnalystRefusedError } from '@/lib/ai/types'
import { isDbConfigured, repo } from '@/lib/db'
import { requireTier, TIERS_ENFORCED } from '@/lib/plans/plans'
import type { Evidence } from '@/lib/engine/types'

/**
 * POST /api/analyst  { subject, gateway, findings: Evidence[], focus? }
 * Auth-gated AI triage over a report our engine already produced. The analyst
 * summarizes the provided evidence — it never adds or verifies facts.
 *
 * Tier note: this is a Pro-tier feature. Subscription gating lands with task #25
 * (requireTier); until then the route is auth-gated only.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // The AI analyst is a Pro feature. Enforcement is off until subscriptions ship
  // (ENFORCE_TIERS); when on, a free user is asked to upgrade rather than blocked
  // silently. Plans/pricing live in lib/plans (single source of truth).
  if (TIERS_ENFORCED) {
    const plan = isDbConfigured() ? await repo.users.getPlan(userId).catch(() => 'free') : 'free'
    const check = requireTier(plan, 'ai_analyst')
    if (!check.ok) {
      return NextResponse.json(
        { error: 'The AI analyst is a Pro feature.', upgradeTo: check.upgradeTo },
        { status: 402 },
      )
    }
  }

  let body: { subject?: unknown; gateway?: unknown; findings?: unknown; focus?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const gateway = typeof body.gateway === 'string' ? body.gateway.trim() : 'general'
  const focus = typeof body.focus === 'string' && body.focus.trim() ? body.focus.trim() : undefined
  const findings = Array.isArray(body.findings) ? (body.findings as Evidence[]) : []

  if (!subject) return NextResponse.json({ error: 'Provide a "subject".' }, { status: 400 })
  if (findings.length === 0)
    return NextResponse.json({ error: 'Provide "findings" to analyze.' }, { status: 400 })

  try {
    const verdict = await analyzeFindings({ subject, gateway, findings, focus })
    return NextResponse.json(verdict)
  } catch (err) {
    if (err instanceof AnalystRefusedError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 502 },
    )
  }
}
