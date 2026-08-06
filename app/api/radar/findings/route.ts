import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { repo } from '@/lib/db'
import { WATCHLIST, WATCH_GROUP_LABELS } from '@/lib/radar'

/**
 * GET /api/radar/findings — the Radar knowledge base.
 *
 * `?kind=internal|product` filters the two halves (internal = the ⭐ watchlist,
 * product = change alerts from user monitors); `?limit=` caps the page. The
 * watchlist itself is returned alongside so a client can show *what is being
 * watched* even before the first sweep has stored anything.
 *
 * Auth-gated: the knowledge base is signed-in surface, not a public feed.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_LIMIT = 100

export async function GET(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const rawKind = params.get('kind')
  if (rawKind !== null && rawKind !== 'internal' && rawKind !== 'product') {
    return NextResponse.json({ error: 'kind must be "internal" or "product"' }, { status: 400 })
  }
  const kind: 'internal' | 'product' | undefined = rawKind ?? undefined
  const parsedLimit = Number(params.get('limit') ?? 50)
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), MAX_LIMIT)
    : 50

  const watchlist = WATCHLIST.map((f) => ({
    key: f.key,
    label: f.label,
    group: f.group,
    groupLabel: WATCH_GROUP_LABELS[f.group],
    why: f.why,
  }))

  try {
    const findings = await repo.radar.listRecent(kind, limit)
    return NextResponse.json({ findings, watchlist })
  } catch {
    // No database configured yet — say so plainly instead of inventing findings.
    return NextResponse.json(
      { error: 'Radar knowledge base is not available (database not configured)', watchlist },
      { status: 503 },
    )
  }
}
