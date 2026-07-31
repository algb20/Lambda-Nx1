import { NextResponse } from 'next/server'
import { marketsBoard } from '@/lib/modules/markets-board'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/intelligence/board — a live multi-class markets overview (no input). */
export async function POST() {
  try {
    return NextResponse.json(await marketsBoard())
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Board fetch failed' },
      { status: 502 },
    )
  }
}
