import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { recordRunSafely } from '@/lib/modules/history'
import { filingsReport } from '@/lib/modules/filings'

/**
 * POST /api/intelligence/filings — what companies just told the SEC.
 *
 * With a query it searches the **full text** of every recent filing. Without
 * one it returns the tape: the last few days of 8-Ks ranked by what they
 * disclose rather than by when they arrived.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  let body: { value?: unknown; query?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // Empty body is valid: it means "show me the tape".
  }
  const query =
    typeof body.value === 'string' ? body.value : typeof body.query === 'string' ? body.query : ''

  try {
    const report = await filingsReport(query)
    const userId = await getSessionUserId().catch(() => null)
    if (userId) await recordRunSafely({ userId, gateway: 'filings', subject: query, report })
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Filing search failed' },
      { status: 502 },
    )
  }
}
