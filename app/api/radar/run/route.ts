import { NextResponse } from 'next/server'
import { runRadarSweep } from '@/lib/radar'

/**
 * POST /api/radar/run — runs one radar sweep over all due monitors. Intended for
 * a scheduler (pg_cron / external cron), guarded by CRON_SECRET so it is not
 * publicly triggerable.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }
  if (request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const result = await runRadarSweep()
  return NextResponse.json(result)
}
