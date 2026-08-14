import { NextResponse } from 'next/server'
import { getSelfAudit, SelfAuditUnavailableError } from '@/lib/modules/self-audit'

/**
 * GET /api/self-audit — what the platform has observed about its own sources.
 *
 * Open, like the brief. The audit's whole value is that anyone can check
 * whether our declared source ratings match what those sources have actually
 * done; putting that behind a login would make the honesty claim unverifiable,
 * which is the same as not making it.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getSelfAudit())
  } catch (err) {
    if (err instanceof SelfAuditUnavailableError) {
      // 503 rather than 200-with-empty-findings: "nothing is wrong" and "we
      // have no record to check" must never render the same, and that
      // distinction is the entire point of the module behind this route.
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Audit failed' },
      { status: 500 },
    )
  }
}
