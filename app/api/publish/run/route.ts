import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { adminGate } from '@/lib/social/admin'
import { PublishJobUnavailableError, runPublishJob } from '@/lib/modules/publish-job'

/**
 * POST /api/publish/run — the operator's handle on the publisher.
 *
 * The scheduled path is `GET /api/cron/publish`; this exists so a human can run
 * the job on demand, and — with `?dry=1` — see exactly what it *would* publish
 * without writing anything. That is how the thresholds get checked before they
 * are let loose on a real feed.
 *
 * Guarded by ADMIN_SECRET. Safe to run as often as you like: every candidate
 * carries a stable identity and anything already published is skipped.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const denied = adminGate(request)
  if (denied) return denied

  const dryRun = new URL(request.url).searchParams.get('dry') === '1'
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? 'https'

  try {
    const result = await runPublishJob({ dryRun, origin: host ? `${proto}://${host}` : '' })
    return NextResponse.json({
      dryRun: result.dryRun,
      considered: result.considered,
      publishedCount: result.published.length,
      skippedAsDuplicate: result.skippedAsDuplicate,
      skippedBelowBar: result.skippedBelowBar,
      published: result.published.map((c) => ({
        kind: c.kind,
        title: c.title,
        refValue: c.refValue,
        sourceUrl: c.sourceUrl,
      })),
      feeds: result.feeds,
    })
  } catch (err) {
    if (err instanceof PublishJobUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
