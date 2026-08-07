import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getSessionUserId } from '@/lib/auth/server'
import { geoFromHeaders } from '@/lib/geo/edge-geo'
import { repo, isDbConfigured } from '@/lib/db'

/**
 * POST /api/visit — a lightweight, fire-and-forget beacon the app pings once on
 * open. It records into the **private** usage registry (admin-only) who reached
 * the app and from which country:
 *
 *  - **Signed-in:** one row per user, carrying their Pi username / email and the
 *    country the edge resolved.
 *  - **Anonymous:** aggregated per country only — no per-guest identifier is
 *    created or stored (charter §3: data minimization, no personal tracking).
 *
 * No IP is ever stored; the country comes from the host's edge geo header. This
 * data is never surfaced anywhere in the product — only through /api/admin/visitors.
 *
 * The endpoint always answers 204 and never throws to the client: analytics must
 * never break the app.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    if (!isDbConfigured()) return new NextResponse(null, { status: 204 })

    let body: { mode?: unknown } = {}
    try {
      body = await request.json()
    } catch {
      /* body is optional */
    }
    const mode = typeof body.mode === 'string' ? body.mode.slice(0, 24) : null

    const geo = geoFromHeaders(await headers())
    const userId = await getSessionUserId()

    if (userId) {
      const user = await repo.users.getById(userId)
      if (user) {
        await repo.visitors.record({
          subjectKey: `user:${user.id}`,
          userId: user.id,
          provider: user.authProvider,
          displayName: user.displayName ?? user.externalId,
          countryCode: geo.countryCode,
          countryName: geo.countryName,
          region: geo.region,
          lastMode: mode ?? user.authProvider,
        })
        return new NextResponse(null, { status: 204 })
      }
    }

    // Anonymous — aggregate by country, never per-person.
    await repo.visitors.record({
      subjectKey: `anon:${geo.countryCode ?? 'XX'}`,
      countryCode: geo.countryCode,
      countryName: geo.countryName,
      region: null, // don't narrow anonymous aggregates below country
      lastMode: mode ?? 'guest',
    })
    return new NextResponse(null, { status: 204 })
  } catch {
    // Never surface an analytics failure to the visitor.
    return new NextResponse(null, { status: 204 })
  }
}
