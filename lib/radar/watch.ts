/**
 * The watch sweep — the automated half of the weekly technology review.
 *
 * For every feed on the curated ⭐ watchlist it collects evidence through the
 * engine (so the passive guardrail, the allowlist and per-source rate limits all
 * apply unchanged), converts each item into a knowledge-base finding carrying
 * its link, timestamp, Admiralty rating and confidence grade, and files it
 * de-duplicated. Re-reading a feed is therefore cheap and idempotent: only
 * genuinely new items are stored, which is exactly what "surface what's new"
 * means.
 *
 * Everything here is dependency-injected and pure with respect to I/O, so the
 * whole sweep is testable without a network or a database. The live wiring lives
 * in ./index.
 */
import type { Evidence } from '../engine/types'
import type { NewRadarFinding } from '../db'
import { ingestFeedItems, type FeedItem } from './internal'
import { WATCHLIST, type WatchFeed, type WatchGroup } from './watchlist'

export interface WatchFeedRun {
  feed: string
  label: string
  group: WatchGroup
  /** Items the feed returned this sweep. */
  collected: number
  /** Of those, how many were new to the knowledge base. */
  stored: number
  /**
   * Anything that went wrong reading or storing this feed, even if some items
   * still came through. Present with `collected > 0` means a partial read.
   */
  error?: string
}

export interface WatchSweepResult {
  startedAt: string
  finishedAt: string
  feeds: WatchFeedRun[]
  collected: number
  stored: number
  /**
   * Feeds that produced nothing *because* they failed. An empty feed with no
   * error is not counted — "the publisher posted nothing" and "we could not
   * reach the publisher" are different facts and must not be conflated.
   */
  failed: number
}

/** What one feed read returned: its items, plus anything that went wrong. */
export interface FeedCollection {
  evidence: Evidence[]
  /** Errors reported by the sources that serve this feed. */
  errors?: string[]
}

export interface WatchSweepDeps {
  /** Collect one feed's current items (the engine call). */
  collectFeed: (feedKey: string) => Promise<FeedCollection>
  /** Store a finding, de-duplicated; truthy when it was new. */
  upsert: (finding: NewRadarFinding) => Promise<unknown | undefined>
  now?: () => Date
}

/** A publisher timestamp we can trust, or undefined so the row default applies. */
function publishedAt(evidence: Evidence): Date | undefined {
  const ms = Date.parse(evidence.retrievedAt)
  if (Number.isNaN(ms)) return undefined
  // A feed that claims the future is misreporting; don't let it sort above real items.
  return ms > Date.now() ? undefined : new Date(ms)
}

/** Turn one piece of collected evidence into a knowledge-base item. */
export function evidenceToFeedItem(evidence: Evidence, feed: WatchFeed): FeedItem {
  const summary =
    typeof (evidence.data as { summary?: unknown } | undefined)?.summary === 'string'
      ? ((evidence.data as { summary: string }).summary)
      : undefined
  return {
    title: evidence.claim,
    url: evidence.sourceUrl,
    summary,
    confidence: evidence.confidence,
    admiralty: evidence.admiralty
      ? `${evidence.admiralty.source}/${evidence.admiralty.info}`
      : undefined,
    feed: feed.key,
    retrievedAt: publishedAt(evidence),
  }
}

/**
 * Read every watchlist feed and file what is new. Feeds are read one at a time:
 * they share provider hosts and the guardrail throttles per source, so a
 * parallel fan-out would only queue behind itself — and sequential reads keep a
 * slow feed from starving the rest of the sweep's error reporting.
 *
 * A feed that fails is recorded with its error and the sweep continues; one dead
 * publisher must never cost us the others.
 */
export async function runWatchSweep(
  deps: WatchSweepDeps,
  feeds: WatchFeed[] = WATCHLIST,
): Promise<WatchSweepResult> {
  const now = deps.now ?? (() => new Date())
  const startedAt = now().toISOString()
  const runs: WatchFeedRun[] = []

  for (const feed of feeds) {
    const base = { feed: feed.key, label: feed.label, group: feed.group }
    try {
      const { evidence, errors } = await deps.collectFeed(feed.key)
      const items = evidence.map((e) => evidenceToFeedItem(e, feed))
      const stored = await ingestFeedItems(items, deps.upsert)
      runs.push({
        ...base,
        collected: items.length,
        stored,
        // Source-level failures are reported even when other sources delivered.
        error: errors && errors.length > 0 ? errors.join('; ') : undefined,
      })
    } catch (err) {
      runs.push({
        ...base,
        collected: 0,
        stored: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    startedAt,
    finishedAt: now().toISOString(),
    feeds: runs,
    collected: runs.reduce((n, r) => n + r.collected, 0),
    stored: runs.reduce((n, r) => n + r.stored, 0),
    failed: runs.filter((r) => r.error && r.collected === 0).length,
  }
}
