import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { cronGate } from '@/lib/cron/auth'
import { PublishJobUnavailableError, runPublishJob } from '@/lib/modules/publish-job'
import { recheckQuarantine } from '@/lib/engine/catalog/recheck'
import { runFullRadar, runInternalRadarSweep, runRadarSweep } from '@/lib/radar'

/**
 * GET /api/cron/[job] — the one door a scheduler comes through.
 *
 * Everything the platform does on its own now hangs off this route, for one
 * blunt reason: schedulers send `GET` with a bearer token, and the jobs were
 * behind `POST` with bespoke headers, so on a hosted deploy they never ran. The
 * product's "automatic" work was automatic only in the sense that nobody was
 * doing it.
 *
 * Jobs:
 *  - `publish`         — turn the strongest of today's findings into real posts.
 *  - `radar`           — a full Radar pass (due monitors + the standing watchlist).
 *  - `radar-monitors`  — the users' monitors only.
 *  - `radar-watch`     — the curated watchlist only.
 *  - `sources`         — re-ask the quarantined sources whether they work again.
 *
 * All five are idempotent: publishing skips anything already out, the Radar
 * fingerprints its findings, and `sources` only reads. Running one twice costs
 * time, never duplicates.
 *
 * Guarded by CRON_SECRET (`Authorization: Bearer …`, which is what hosted cron
 * sends, or `x-cron-secret`). An unauthenticated caller can learn only that the
 * route exists.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JOBS = ['publish', 'radar', 'radar-monitors', 'radar-watch', 'sources'] as const
type Job = (typeof JOBS)[number]

const isJob = (value: string): value is Job => (JOBS as readonly string[]).includes(value)

export async function GET(request: Request, context: { params: Promise<{ job: string }> }) {
  const denied = cronGate(request)
  if (denied) return denied

  const { job } = await context.params
  if (!isJob(job)) {
    return NextResponse.json(
      { error: `Unknown job "${job}"`, jobs: JOBS },
      { status: 404 },
    )
  }

  const startedAt = new Date().toISOString()
  const began = Date.now()

  try {
    const result = await run(job)
    return NextResponse.json({
      job,
      startedAt,
      durationMs: Date.now() - began,
      result,
    })
  } catch (err) {
    if (err instanceof PublishJobUnavailableError) {
      return NextResponse.json({ job, error: err.message }, { status: 503 })
    }
    // A scheduled job that fails must say so with a non-200, or the scheduler
    // records a success and nobody ever learns the platform stopped working.
    return NextResponse.json(
      {
        job,
        startedAt,
        durationMs: Date.now() - began,
        error: err instanceof Error ? err.message : 'job failed',
      },
      { status: 500 },
    )
  }
}

async function run(job: Job): Promise<unknown> {
  switch (job) {
    case 'publish': {
      const h = await headers()
      const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
      const proto = h.get('x-forwarded-proto') ?? 'https'
      const result = await runPublishJob({ origin: host ? `${proto}://${host}` : '' })
      return {
        considered: result.considered,
        publishedCount: result.published.length,
        skippedAsDuplicate: result.skippedAsDuplicate,
        skippedBelowBar: result.skippedBelowBar,
        published: result.published.map((c) => ({ kind: c.kind, title: c.title })),
        feeds: result.feeds,
      }
    }
    case 'radar':
      return runFullRadar()
    case 'radar-monitors':
      return { monitors: await runRadarSweep() }
    case 'radar-watch':
      return { watch: await runInternalRadarSweep() }
    case 'sources': {
      /**
       * Coverage that only heals when a person remembers is coverage that
       * decays. Eight days after the quarantine was written, six of its
       * fifty-one entries were back and nothing in the platform knew.
       *
       * The budget is well under this route's own `maxDuration`, because a run
       * the runtime kills reports nothing at all — see `BUDGET_MS`.
       */
      const report = await recheckQuarantine({ budgetMs: 45_000 })
      return {
        quarantined: report.quarantined,
        checked: report.checked,
        skipped: report.skipped.length,
        recovered: report.recovered.map((r) => ({ key: r.key, detail: r.detail })),
        orphaned: report.orphaned,
        advice: report.advice,
      }
    }
  }
}
