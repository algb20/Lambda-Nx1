import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured, repo, type CalibrationClaim, type NewCalibrationClaim } from '@/lib/db'
import { recordClaim, scoreboard, type AuthorKind, type CalibrationPort } from '@/lib/modules/calibration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const port: CalibrationPort = {
  record: (row) => repo.calibration.record(row as unknown as NewCalibrationClaim),
  resolve: (id, outcome, note) => repo.calibration.resolve(id, outcome as CalibrationClaim['outcome'], note),
  list: (limit) => repo.calibration.list(limit) as unknown as ReturnType<CalibrationPort['list']>,
}

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isDbConfigured())
    return NextResponse.json({ error: 'Calibration ledger is not configured yet.' }, { status: 503 })

  let body: {
    claim?: unknown
    author?: unknown
    authorKind?: unknown
    topic?: unknown
    horizon?: unknown
    sourceUrl?: unknown
    confidence?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const claim = typeof body.claim === 'string' ? body.claim : ''
  const author = typeof body.author === 'string' && body.author.trim() ? body.author : 'Lambda NX'
  const authorKind: AuthorKind = body.authorKind === 'external' ? 'external' : 'us'
  const horizon = typeof body.horizon === 'string' ? new Date(body.horizon) : null

  try {
    await recordClaim(port, {
      claim,
      author,
      authorKind,
      topic: typeof body.topic === 'string' ? body.topic : undefined,
      horizon: horizon && !Number.isNaN(horizon.getTime()) ? horizon : null,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
      confidence: body.confidence === 'confirmed' || body.confidence === 'probable' || body.confidence === 'unconfirmed' ? body.confidence : 'possible',
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not record' }, { status: 400 })
  }
}

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isDbConfigured())
    return NextResponse.json({ scoreboard: null, claims: [], configured: false })

  const rows = await repo.calibration.list(500)
  return NextResponse.json({ scoreboard: scoreboard(rows as never), claims: rows.slice(0, 50), configured: true })
}
