import { NextResponse } from 'next/server'
import { investigateDomain } from '@/lib/modules/domain'
import { persistDomainReport } from '@/lib/modules/persist'
import { getSessionUserId } from '@/lib/auth/server'
import { recordRunSafely } from '@/lib/modules/history'

/**
 * POST /api/intelligence/domain  { domain }
 * Runs the real Module 1 investigation and returns a documented DomainReport.
 * No fabricated data — if a provider is unreachable, its section is simply empty
 * and that source is reported as failed.
 */
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

export async function POST(request: Request) {
  let body: { domain?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const domain = typeof body.domain === 'string' ? body.domain.trim() : ''
  if (!domain) {
    return NextResponse.json({ error: 'Provide a "domain".' }, { status: 400 })
  }

  try {
    const report = await investigateDomain(domain)

    // If signed in, archive the report to our database (best-effort).
    let investigationId: string | undefined
    try {
      const userId = await getSessionUserId()
      if (userId) {
        investigationId = await persistDomainReport(userId, report)
        // The full archive above stores the graph and every finding; this adds
        // the row the history list reads, with the gateway and the count.
        await recordRunSafely({ userId, gateway: 'domain', subject: domain, report })
      }
    } catch (persistErr) {
      console.error('[domain] persistence skipped:', persistErr)
    }

    return NextResponse.json({ ...report, investigationId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Investigation failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
