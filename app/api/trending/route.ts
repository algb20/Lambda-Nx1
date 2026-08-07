import { NextResponse } from 'next/server'
import { investigateTrending } from '@/lib/modules/trending'

/**
 * GET /api/trending — the day's most-looked-up subjects worldwide, ranked by our
 * own scoring with a 5–10 item spotlight. Real view counts, every item linked to
 * its source. Fans out to two providers in parallel; the 60s ceiling is a safety
 * net (see the note in the news route).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    return NextResponse.json(await investigateTrending())
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Trending fetch failed' },
      { status: 502 },
    )
  }
}
