import { describe, it, expect } from 'vitest'
import { runWatchSweep, evidenceToFeedItem } from './watch'
import { WATCHLIST, WATCH_GROUPS, feedsInGroup, findFeed, type WatchFeed } from './watchlist'
import { WATCH_FEEDS, watchSources } from '../engine/sources/watch'
import { feedDedupeHash } from './internal'
import type { Evidence } from '../engine/types'
import type { NewRadarFinding } from '../db'

function ev(o: Partial<Evidence> & { claim: string }): Evidence {
  return {
    sourceKey: 'test',
    retrievedAt: '2026-08-03T00:00:00.000Z',
    confidence: 'possible',
    ...o,
  }
}

const FEED: WatchFeed = {
  key: WATCH_FEEDS.cisaKev,
  label: 'CISA KEV',
  group: 'security',
  why: 'test',
}

/** An in-memory knowledge base with the same de-dup contract as the real repo. */
function knowledgeBase() {
  const rows = new Map<string, NewRadarFinding>()
  return {
    rows,
    upsert: async (f: NewRadarFinding) => {
      if (rows.has(f.dedupeHash)) return undefined
      rows.set(f.dedupeHash, f)
      return { id: f.dedupeHash }
    },
  }
}

describe('watchlist', () => {
  it('lists only feeds a registered source actually serves', async () => {
    const served = new Set(Object.values(WATCH_FEEDS))
    for (const feed of WATCHLIST) expect(served.has(feed.key), feed.key).toBe(true)
  })

  it('every listed feed is reachable through a registered watch source', async () => {
    for (const feed of WATCHLIST) {
      const owners: string[] = []
      for (const source of watchSources) {
        let called = false
        await source.run(
          { capability: 'watch', value: feed.key },
          {
            fetch: async () => {
              called = true
              return new Response('{}', { status: 200 })
            },
          },
        )
        if (called) owners.push(source.key)
      }
      expect(owners, feed.key).toHaveLength(1)
    }
  })

  it('has no duplicate keys and covers every ⭐ group', () => {
    const keys = WATCHLIST.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const group of WATCH_GROUPS) expect(feedsInGroup(group).length).toBeGreaterThan(0)
  })

  it('documents a rationale for every feed', () => {
    for (const feed of WATCHLIST) expect(feed.why.length).toBeGreaterThan(20)
  })

  it('finds a feed by key', () => {
    expect(findFeed(WATCH_FEEDS.cisaKev)?.group).toBe('security')
    expect(findFeed('nope')).toBeUndefined()
  })
})

describe('evidenceToFeedItem', () => {
  it('carries link, grade, Admiralty rating and feed provenance', () => {
    const item = evidenceToFeedItem(
      ev({
        claim: 'Exploited in the wild: CVE-2026-0002',
        sourceUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: { summary: 'An authentication bypass.' },
      }),
      FEED,
    )
    expect(item.title).toBe('Exploited in the wild: CVE-2026-0002')
    expect(item.url).toBe('https://www.cisa.gov/known-exploited-vulnerabilities-catalog')
    expect(item.summary).toBe('An authentication bypass.')
    expect(item.confidence).toBe('confirmed')
    expect(item.admiralty).toBe('A/1')
    expect(item.feed).toBe(WATCH_FEEDS.cisaKev)
    expect(item.retrievedAt?.toISOString()).toBe('2026-08-03T00:00:00.000Z')
  })

  it('drops a future timestamp rather than letting it sort above real items', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(evidenceToFeedItem(ev({ claim: 'x', retrievedAt: future }), FEED).retrievedAt).toBeUndefined()
  })

  it('drops an unparseable timestamp instead of guessing', () => {
    expect(evidenceToFeedItem(ev({ claim: 'x', retrievedAt: 'nonsense' }), FEED).retrievedAt).toBeUndefined()
  })

  it('keeps findings distinct when a feed publishes many items behind one URL', () => {
    const url = 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'
    const a = evidenceToFeedItem(ev({ claim: 'CVE-1', sourceUrl: url }), FEED)
    const b = evidenceToFeedItem(ev({ claim: 'CVE-2', sourceUrl: url }), FEED)
    expect(feedDedupeHash(a)).not.toBe(feedDedupeHash(b))
  })
})

describe('runWatchSweep', () => {
  const feeds: WatchFeed[] = [
    FEED,
    { key: WATCH_FEEDS.arxivSecurity, label: 'arXiv cs.CR', group: 'papers', why: 'test' },
  ]

  it('stores what each feed returned and reports per-feed counts', async () => {
    const kb = knowledgeBase()
    const result = await runWatchSweep(
      {
        collectFeed: async (key) => ({
          evidence:
            key === FEED.key
              ? [ev({ claim: 'CVE-1', admiralty: { source: 'A', info: 1 }, confidence: 'confirmed' })]
              : [ev({ claim: 'Preprint A' }), ev({ claim: 'Preprint B' })],
        }),
        upsert: kb.upsert,
      },
      feeds,
    )
    expect(result.collected).toBe(3)
    expect(result.stored).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.feeds.map((f) => f.stored)).toEqual([1, 2])
    expect(result.feeds[0].group).toBe('security')
    // The grade survives the trip into the knowledge base.
    const kev = [...kb.rows.values()].find((r) => r.title === 'CVE-1')
    expect(kev?.confidence).toBe('confirmed')
    expect(kev?.admiralty).toBe('A/1')
    expect(kev?.feed).toBe(FEED.key)
    expect(kev?.kind).toBe('internal')
  })

  it('is idempotent — a second sweep of unchanged feeds stores nothing new', async () => {
    const kb = knowledgeBase()
    const deps = {
      collectFeed: async () => ({
        evidence: [ev({ claim: 'Same item', sourceUrl: 'https://example.org/a' })],
      }),
      upsert: kb.upsert,
    }
    const first = await runWatchSweep(deps, feeds)
    const second = await runWatchSweep(deps, feeds)
    // One item published on two feeds is one thing that happened: de-dup is by
    // item identity, not by feed, so the knowledge base holds a single finding.
    expect(first.stored).toBe(1)
    expect(kb.rows.size).toBe(1)
    expect(second.stored).toBe(0)
    expect(second.collected).toBe(2) // it still read both feeds; nothing was new
  })

  it('records a failing feed and keeps sweeping the rest', async () => {
    const kb = knowledgeBase()
    const result = await runWatchSweep(
      {
        collectFeed: async (key) => {
          if (key === FEED.key) throw new Error('provider unavailable')
          return { evidence: [ev({ claim: 'Preprint A' })] }
        },
        upsert: kb.upsert,
      },
      feeds,
    )
    expect(result.failed).toBe(1)
    expect(result.feeds[0].error).toBe('provider unavailable')
    expect(result.feeds[0].stored).toBe(0)
    expect(result.feeds[1].stored).toBe(1)
    expect(result.stored).toBe(1)
  })

  it('reports a run window even when every feed is empty', async () => {
    const result = await runWatchSweep(
      { collectFeed: async () => ({ evidence: [] }), upsert: async () => undefined },
      feeds,
    )
    expect(result.collected).toBe(0)
    expect(result.stored).toBe(0)
    expect(Date.parse(result.startedAt)).toBeLessThanOrEqual(Date.parse(result.finishedAt))
  })

  it('does not count a genuinely quiet feed as a failure', async () => {
    const result = await runWatchSweep(
      { collectFeed: async () => ({ evidence: [], errors: [] }), upsert: async () => undefined },
      feeds,
    )
    expect(result.failed).toBe(0)
    expect(result.feeds.every((f) => f.error === undefined)).toBe(true)
  })

  it('counts an unreachable publisher as failed, not as quiet', async () => {
    // The orchestrator absorbs source errors and returns no evidence; without
    // the error passing through, a dead feed would be indistinguishable from a
    // feed that simply published nothing.
    const result = await runWatchSweep(
      {
        collectFeed: async () => ({ evidence: [], errors: ['cisa_kev: fetch failed'] }),
        upsert: async () => undefined,
      },
      feeds,
    )
    expect(result.failed).toBe(2)
    expect(result.feeds[0].error).toBe('cisa_kev: fetch failed')
  })

  it('reports a partial read without calling the feed failed', async () => {
    const kb = knowledgeBase()
    const result = await runWatchSweep(
      {
        collectFeed: async () => ({
          evidence: [ev({ claim: 'One item that did arrive' })],
          errors: ['sibling_source: timed out'],
        }),
        upsert: kb.upsert,
      },
      [FEED],
    )
    expect(result.collected).toBe(1)
    expect(result.failed).toBe(0) // items arrived, so the feed is not "failed"…
    expect(result.feeds[0].error).toBe('sibling_source: timed out') // …but the loss is visible
  })
})

// Live sweep of the real ⭐ feeds — only with RUN_LIVE=1 and open egress to the
// publishers (the build sandbox blocks them; this runs at deploy). Nothing is
// written: the upsert is a counter, so this exercises collection only.
describe.runIf(process.env.RUN_LIVE === '1')('watch sweep — LIVE', () => {
  it('collects real items from every watchlist feed', async () => {
    const { collect } = await import('../engine')
    const { registerWatchFeeds } = await import('../engine/sources')
    registerWatchFeeds()

    const result = await runWatchSweep({
      collectFeed: async (key) => {
        const out = await collect({ capability: 'watch', value: key })
        return {
          evidence: out.evidence,
          errors: out.results.filter((r) => !r.ok).map((r) => `${r.sourceKey}: ${r.error}`),
        }
      },
      upsert: async (f) => ({ id: f.dedupeHash }),
    })

    expect(result.failed, JSON.stringify(result.feeds)).toBe(0)
    for (const feed of result.feeds) {
      expect(feed.collected, `${feed.feed} returned nothing`).toBeGreaterThan(0)
    }
    expect(result.stored).toBe(result.collected)
  }, 120_000)
})
