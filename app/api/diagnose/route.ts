import { NextResponse } from 'next/server'
import { getWorldEvents } from '@/lib/modules/world-events'
import { investigateNews } from '@/lib/modules/news'
import { activeSources, CATALOG } from '@/lib/engine/catalog'
import { allSourceCatalog } from '@/lib/engine/sources'

/**
 * GET /api/diagnose — one URL that says what is actually wrong.
 *
 * ## Why this exists
 *
 * The development environment this platform is built in has no outbound
 * network, so the person writing the code cannot open the deployed site or
 * reach a single one of its 238 providers. Every diagnosis is therefore made
 * from the code rather than from the running system — which is exactly how a
 * board ends up with a third of its feeds dead and nobody noticing.
 *
 * This closes that loop with the cheapest possible instrument: one request, one
 * compact answer, small enough to paste into a conversation. It is deliberately
 * *not* the full report — `/api/world` is megabytes and unpasteable — but a
 * digest built around the three questions that actually decide whether the
 * board is healthy:
 *
 *  1. **Which feeds are dead, and with what error?** A source that fails
 *     silently is worse than one that is missing, because it still counts.
 *  2. **Is one category drowning the rest?** Nine seismic feeds each returning
 *     forty quakes will bury every other kind of event on the board, and the
 *     result looks like a product that only knows about earthquakes.
 *  3. **Do the events carry dates?** An item with no publication time renders
 *     as "just now" on most boards, which turns an old record into breaking
 *     news — the single most damaging thing a signals feed can do.
 *
 * Public, and free of anything private: it names feeds and counts, never a user
 * and never a credential.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Errors are truncated: a stack trace pasted into a chat helps nobody. */
const MAX_ERROR = 140

export async function GET() {
  const startedAt = Date.now()

  const [worldResult, newsResult] = await Promise.allSettled([
    getWorldEvents(),
    investigateNews(''),
  ])

  const world = worldResult.status === 'fulfilled' ? worldResult.value : null
  const news = newsResult.status === 'fulfilled' ? newsResult.value : null

  // ── Which feeds are failing, and why ──────────────────────────────────────
  const health = world?.sourceHealth ?? []
  const failed = health
    .filter((h) => h.status === 'failed')
    .map((h) => ({ source: h.sourceKey, error: (h.error ?? 'no detail').slice(0, MAX_ERROR) }))
  const empty = health.filter((h) => h.status === 'empty').map((h) => h.sourceKey)

  // ── Is one category drowning the board? ───────────────────────────────────
  const byCategory = (world?.categories ?? [])
    .map((c) => ({ category: c.category, count: c.count }))
    .sort((a, b) => b.count - a.count)
  const total = byCategory.reduce((n, c) => n + c.count, 0)
  const dominant = byCategory[0]

  // ── Do events carry a real publication time? ──────────────────────────────
  const allEvents = [...(world?.events ?? []), ...(world?.unplaceable ?? [])]
  const dated = allEvents.filter((e) => e.observedAt !== null).length

  return NextResponse.json({
    takenAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,

    catalogue: {
      declared: CATALOG.length,
      active: activeSources().length,
      coded: allSourceCatalog.length,
    },

    /** The first question: what is broken, named and with its reason. */
    feeds: {
      contributing: health.filter((h) => h.status === 'ok').length,
      answeredEmpty: empty.length,
      failed: failed.length,
      /** Capped, because a hundred identical timeouts teach nothing new. */
      failures: failed.slice(0, 40),
      emptySources: empty.slice(0, 40),
    },

    /** The second question: is the board one category wearing a costume? */
    balance: {
      events: total,
      byCategory,
      dominantShare: dominant && total > 0 ? Number((dominant.count / total).toFixed(3)) : 0,
      verdict:
        dominant && total > 0 && dominant.count / total > 0.5
          ? `"${dominant.category}" is ${Math.round((dominant.count / total) * 100)}% of the board. Whatever else the platform collects is invisible behind it.`
          : 'No single category dominates the board.',
    },

    /** The third question: can anything on the board be dated at all? */
    dates: {
      events: allEvents.length,
      withObservedTime: dated,
      withoutObservedTime: allEvents.length - dated,
      verdict:
        allEvents.length > 0 && dated === 0
          ? 'Not one event carries a source-stated time. Every age shown on the board is the moment we fetched it, not when it happened.'
          : `${dated} of ${allEvents.length} events carry a time their source stated.`,
    },

    news: news
      ? {
          reports: news.summary.count,
          stories: news.analysis.stories,
          duplicatesCollapsed: news.analysis.duplicatesCollapsed,
          independentOrigins: news.analysis.origins,
          undatedStories: news.analysis.undated,
          newestAt: news.analysis.newestAt,
          oldestAt: news.analysis.oldestAt,
          sourcesFailed: news.summary.sourcesFailed,
        }
      : { error: String((newsResult as PromiseRejectedResult).reason).slice(0, MAX_ERROR) },

    // A run that failed entirely is a different fact from one that found
    // nothing, and the digest must never render them the same.
    worldError:
      worldResult.status === 'rejected'
        ? String(worldResult.reason).slice(0, MAX_ERROR)
        : null,
  })
}
