/**
 * Internal radar — the "keeps us ahead" knowledge base. Public, lawful feed
 * items (new/updated OSINT tools, techniques, research, exploited
 * vulnerabilities) are ingested and stored, de-duplicated, so we can surface
 * what is new/stronger. The feed source is injected; the upsert is injected so
 * this is testable without a database.
 */
import { createHash } from 'node:crypto'
import type { NewRadarFinding } from '../db'
import type { Confidence } from '../engine/types'

export interface FeedItem {
  title: string
  url?: string
  summary?: string
  /** Grade carried from the evidence that produced the item. Default: 'possible'. */
  confidence?: Confidence
  /** Admiralty rating as `source/info`, e.g. "A/1". */
  admiralty?: string
  /** Watchlist feed the item was *first* seen on, kept as provenance. */
  feed?: string
  /** When the publisher issued the item (falls back to the row default: now). */
  retrievedAt?: Date
}

/**
 * Stable identity of a feed item. The URL alone is not enough: some feeds — a
 * vulnerability catalogue, for instance — publish many items behind one page, so
 * the title participates in the hash and those items stay distinct.
 */
export function feedDedupeHash(item: FeedItem): string {
  const basis = `${item.url ?? ''}|${item.title}`
  return 'internal:' + createHash('sha256').update(basis).digest('hex').slice(0, 40)
}

/**
 * Store feed items as internal radar findings, de-duplicated by dedupeHash.
 * `upsert` returns a truthy row when a new finding was inserted, undefined when
 * it already existed. Returns the number of new findings stored.
 */
export async function ingestFeedItems(
  items: FeedItem[],
  upsert: (f: NewRadarFinding) => Promise<unknown | undefined>,
): Promise<number> {
  let stored = 0
  for (const item of items) {
    const row = await upsert({
      kind: 'internal',
      title: item.title,
      summary: item.summary ?? null,
      sourceUrl: item.url ?? null,
      confidence: item.confidence ?? 'possible',
      admiralty: item.admiralty ?? null,
      feed: item.feed ?? null,
      ...(item.retrievedAt ? { retrievedAt: item.retrievedAt } : {}),
      dedupeHash: feedDedupeHash(item),
    })
    if (row) stored++
  }
  return stored
}
