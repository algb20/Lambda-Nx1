import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured, repo, type CalibrationClaim } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OUTCOMES = ['correct', 'partial', 'wrong'] as const

/** POST /api/calibration/resolve { id, outcome, note? } — record how a claim turned out. */
export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isDbConfigured())
    return NextResponse.json({ error: 'Calibration ledger is not configured yet.' }, { status: 503 })

  let body: { id?: unknown; outcome?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  const outcome = OUTCOMES.includes(body.outcome as never) ? (body.outcome as CalibrationClaim['outcome']) : null
  if (!id || !outcome) return NextResponse.json({ error: 'Provide id and a valid outcome' }, { status: 400 })

  const row = await repo.calibration.resolve(id, outcome, typeof body.note === 'string' ? body.note : undefined)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}
