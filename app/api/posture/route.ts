import { NextResponse } from 'next/server'
import { checkPosture } from '@/lib/security/posture'
import {
  registerCatalogSources,
  registerNewsGateway,
  registerWorldEventsGateway,
} from '@/lib/engine/sources'

/**
 * GET /api/posture — are this deployment's own guarantees switched on?
 *
 * The header badge reads it. It answers one narrow question and answers it from
 * live probes rather than constants: is every registered source read-only, does
 * every one name its providers, does the allowlist refuse a host nobody
 * declared, is a state-changing method actually rejected, and is the licence
 * gate still holding anything back.
 *
 * The sources are registered first because the checks are a census of what is
 * *registered*, and on a cold serverless invocation nothing has registered yet.
 * Without this the report would be a truthful description of an empty engine —
 * five passing checks over nothing at all, which is worse than a failure.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    registerWorldEventsGateway()
    registerNewsGateway()
    registerCatalogSources()
    return NextResponse.json(await checkPosture())
  } catch (err) {
    /**
     * A checker that cannot run has not found compliance — it has found
     * nothing. Saying so is the only honest answer, and the badge treats an
     * unreachable posture as unknown rather than as lawful.
     */
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Posture check failed' },
      { status: 502 },
    )
  }
}
