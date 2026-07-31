import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { analyzeFindings } from '@/lib/modules/analyst'
import { AnalystRefusedError } from '@/lib/ai/types'
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
