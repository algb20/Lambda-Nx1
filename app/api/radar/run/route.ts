import { NextResponse } from 'next/server'
import { runFullRadar, runRadarSweep, runInternalRadarSweep } from '@/lib/radar'

/**
 * POST /api/radar/run — runs one radar pass: the product half (due monitors)
 * and the internal half (the curated ⭐ watchlist). Intended for a scheduler
 * (pg_cron / external cron), guarded by CRON_SECRET so it is not publicly
 * triggerable.
 *
 * `?half=monitors|watch` runs one half only — the two have different natural
 * cadences (monitors follow each user's interval; the watchlist is a daily
 * read), so a scheduler can drive them on separate schedules.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/**
 * Gateways fan out to several public providers. The platform default (10s) is
 * below the worst realistic case, and being killed mid-request returns an HTML
 * error page where the client expects JSON — which is how the world map ended
 * up empty. Sources also run in parallel and each carries its own deadline, so
 * this ceiling is a safety net, not the normal path.
 */
export const maxDuration = 60

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }
  if (request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const half = new URL(request.url).searchParams.get('half')
  if (half === 'monitors') return NextResponse.json({ monitors: await runRadarSweep() })
  if (half === 'watch') return NextResponse.json({ watch: await runInternalRadarSweep() })
  if (half) return NextResponse.json({ error: 'half must be "monitors" or "watch"' }, { status: 400 })

  return NextResponse.json(await runFullRadar())
}
