import { NextResponse } from 'next/server'
import { investigateDomain } from '@/lib/modules/domain'
import { persistDomainReport } from '@/lib/modules/persist'
import { getSessionUserId } from '@/lib/auth/server'

/**
 * POST /api/intelligence/domain  { domain }
 * Runs the real Module 1 investigation and returns a documented DomainReport.
 * No fabricated data — if a provider is unreachable, its section is simply empty
 * and that source is reported as failed.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
      if (userId) investigationId = await persistDomainReport(userId, report)
    } catch (persistErr) {
      console.error('[domain] persistence skipped:', persistErr)
    }

    return NextResponse.json({ ...report, investigationId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Investigation failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
