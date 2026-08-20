import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { recordRunSafely } from '@/lib/modules/history'
import { companyReport } from '@/lib/modules/companies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/**
 * A profile is three EDGAR calls, one of which (`companyfacts`) is a 4 MB
 * document. The platform default of 10s is below the worst realistic case.
 */
export const maxDuration = 60

/**
 * POST /api/intelligence/companies { company }
 *
 * With a subject: that company's profile, financials and filings. Without one:
 * the largest filers ranked by their own reported balance sheets. One field
 * doing both jobs is deliberate — a gateway that made you first choose a mode
 * would be asking the user to do the routing.
 */
export async function POST(request: Request) {
  let body: { company?: unknown; companies?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const subject =
    typeof body.company === 'string' ? body.company : typeof body.companies === 'string' ? body.companies : ''

  try {
    const report = await companyReport(subject)
    const userId = await getSessionUserId().catch(() => null)
    if (userId) {
      await recordRunSafely({ userId, gateway: 'companies', subject, report })
    }
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Company lookup failed' },
      { status: 502 },
    )
  }
}
