import { NextResponse } from 'next/server'
import { repo, isDbConfigured } from '@/lib/db'

/**
 * GET /api/admin/visitors — the operator's private view of who is using the app
 * and from where. Guarded by ADMIN_SECRET; there is no UI for this and it is
 * never linked from the product (charter §3).
 *
 *  - `x-admin-secret: <ADMIN_SECRET>` (or `?secret=`) is required.
 *  - `?view=country` returns the per-country roll-up instead of the full list.
 *  - `?limit=N` caps the list (default 1000).
 *
 * Returns identity (Pi username / email), country, first/last seen and visit
 * count per subject. Anonymous visitors appear only as per-country aggregates.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const provided =
    request.headers.get('x-admin-secret') ??
    new URL(request.url).searchParams.get('secret') ??
    ''
  // Constant-time-ish: compare lengths then content. Secrets are short; this is
  // a config gate, not a password oracle.
  return provided.length === secret.length && provided === secret
}

export async function GET(request: Request) {
  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'ADMIN_SECRET is not configured' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }

  const url = new URL(request.url)
  if (url.searchParams.get('view') === 'country') {
    return NextResponse.json({ byCountry: await repo.visitors.byCountry() })
  }

  const limitRaw = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 5000) : 1000
  const rows = await repo.visitors.list(limit)
  return NextResponse.json({
    count: rows.length,
    visitors: rows.map((v) => ({
      identity: v.displayName,
      provider: v.provider,
      anonymous: v.subjectKey.startsWith('anon:'),
      country: v.countryName ?? v.countryCode,
      countryCode: v.countryCode,
      region: v.region,
      mode: v.lastMode,
      visits: v.visitCount,
      firstSeen: v.firstSeenAt,
      lastSeen: v.lastSeenAt,
    })),
  })
}
