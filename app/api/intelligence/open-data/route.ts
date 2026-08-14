import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { recordRunSafely } from '@/lib/modules/history'
import { investigateOpenData, openDataCoverage } from '@/lib/modules/open-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/**
 * Thirty government catalogues, several on hosting that is slow by any
 * standard. Each portal carries its own 8-second deadline and they run six at a
 * time, so the realistic worst case is well inside this — the ceiling is a
 * safety net, and being killed mid-request would return an HTML error page
 * where the client expects JSON.
 */
export const maxDuration = 60

/** What the federation covers, without querying anything. */
export async function GET() {
  return NextResponse.json(openDataCoverage())
}

export async function POST(request: Request) {
  let body: { query?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) return NextResponse.json({ error: 'Provide a "query".' }, { status: 400 })

  try {
    const report = await investigateOpenData(query)
    // Best-effort history: a failed archive must never cost the result.
    const userId = await getSessionUserId().catch(() => null)
    if (userId) {
      await recordRunSafely({ userId, gateway: 'open-data', subject: query, report })
    }
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Catalogue search failed' },
      { status: 400 },
    )
  }
}
