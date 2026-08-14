import { NextResponse } from 'next/server'
import { getStandingBrief } from '@/lib/modules/brief'

/**
 * GET /api/brief — the standing analytic read of the world picture.
 *
 * Open, deliberately. The analyst layer used to be gated behind an API key that
 * most users did not have, which meant the product's analysis was invisible to
 * almost everyone who opened it. The mechanical reading costs no model call and
 * no credential, so there is nothing here to gate: what a paid tier buys is a
 * *model's* reading on top, not the existence of analysis.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/**
 * The brief sweeps every world-events feed and then analyses the result. The
 * sources run in parallel with their own deadlines, so this ceiling is a safety
 * net — being killed mid-request would return an HTML error page where the
 * client expects JSON, which is how the world map once ended up empty.
 */
export const maxDuration = 60

export async function GET() {
  try {
    return NextResponse.json(await getStandingBrief())
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not build the brief' },
      { status: 503 },
    )
  }
}
