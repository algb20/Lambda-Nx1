import { describe, expect, it, vi } from 'vitest'
import { coinRelevance, rankCandidates, cryptoAssets, cryptoFeeds, cryptoNews, publisherTier, units, usd } from './crypto'
import type { SourceContext, SourceInput } from '../types'

/**
 * The crypto gateway, against the shapes CoinGecko and the feeds actually
 * return.
 *
 * The two things worth holding in place are the two that were got wrong
 * elsewhere first: **which** of eighteen thousand assets a search resolves to,
 * and whether a source that fans out inside one run rate-limits itself into
 * silence.
 */

function ctxOf(
  handler: (url: string) => { ok?: boolean; status?: number; body?: unknown; text?: string; badJson?: boolean },
): SourceContext {
  return {
    fetch: vi.fn(async (url: string) => {
      const r = handler(url)
      return {
        ok: r.ok ?? true,
        status: r.status ?? 200,
        // A real `res.json()` on an HTML error page rejects; a stub that
        // resolved with undefined would let the source pass a test the
        // provider would fail it on.
        json: async () => {
          if (r.badJson) throw new SyntaxError('Unexpected token < in JSON')
          return r.body
        },
        text: async () => r.text ?? '',
      } as unknown as Response
    }),
  } as unknown as SourceContext
}

const ask = (value: string): SourceInput => ({ value }) as SourceInput

const NEWS_RSS = `<?xml version="1.0"?><rss><channel>
  <item><title>Release of Pi Node Version 0.6.2</title><link>https://minepi.com/blog/a</link><pubDate>Fri, 14 Aug 2026 15:50:34 +0000</pubDate></item>
  <item><title>Something else entirely</title><link>https://minepi.com/blog/b</link><pubDate>Thu, 13 Aug 2026 10:00:00 +0000</pubDate></item>
</channel></rss>`

describe('which of eighteen thousand assets the reader meant', () => {
  /**
   * The exact failure this ranking exists for. CoinGecko answers `pi` with a
   * euro money-market fund first, because that fund is larger — a sensible
   * ordering of coins and a useless answer to a question. It is the same shape
   * as the exchange register returning the biggest desk rather than the
   * exchange.
   */
  it('puts Pi Network above the larger fund that merely contains the letters', () => {
    const ranked = rankCandidates(
      [
        { id: 'spiko-amundi-overnight-swap-fund-eur', symbol: 'EURSAFO', name: 'Spiko Amundi Fund', marketCapRank: 67 },
        { id: 'pi-network', symbol: 'PI', name: 'Pi Network', marketCapRank: 70 },
        { id: 'pieverse', symbol: 'PIEVERSE', name: 'Pieverse', marketCapRank: 135 },
      ],
      'pi',
    )
    expect(ranked[0]?.id).toBe('pi-network')
  })

  it('reads a ticker as a ticker, ahead of a name that merely starts the same way', () => {
    expect(
      coinRelevance({ id: 'ethereum', symbol: 'ETH', name: 'Ethereum' }, 'eth'),
    ).toBeGreaterThan(coinRelevance({ id: 'ethena', symbol: 'ENA', name: 'Ethena' }, 'eth'))
  })

  it('resolves the multi-word name a person would actually type', () => {
    const ranked = rankCandidates(
      [
        { id: 'pi-network-defi', symbol: 'PID', name: 'Pi Network DeFi', marketCapRank: 900 },
        { id: 'pi-network', symbol: 'PI', name: 'Pi Network', marketCapRank: 70 },
      ],
      'pi network',
    )
    expect(ranked[0]?.id).toBe('pi-network')
  })

  it('drops candidates that do not match at all rather than ranking them last', () => {
    expect(rankCandidates([{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }], 'solana')).toEqual([])
  })

  it('sorts an unranked asset after a ranked one of equal match quality', () => {
    const ranked = rankCandidates(
      [
        { id: 'x-unranked', symbol: 'XX', name: 'Nova coin', marketCapRank: null },
        { id: 'x-ranked', symbol: 'XY', name: 'Nova token', marketCapRank: 400 },
      ],
      'nova',
    )
    // Both match on the same word; the one the provider has ranked leads.
    expect(ranked[0]?.id).toBe('x-ranked')
  })

  it('does not let a regex metacharacter in the query throw', () => {
    expect(() => rankCandidates([{ id: 'a', symbol: 'A', name: 'Alpha' }], 'a(')).not.toThrow()
  })
})

describe('reading a number at the size it actually is', () => {
  it('keeps a sub-dollar token from printing as $0.00', () => {
    // The majority of the eighteen thousand trade below a dollar. Two decimals
    // would render a real price as nothing.
    expect(usd(0.096942)).toBe('$0.09694')
    expect(usd(0.00000123)).toContain('0.000001')
  })

  it('scales money without ever calling a coin count money', () => {
    expect(usd(1.56e12)).toBe('$1.56T')
    expect(units(11_090_430_701)).toBe('11.09B')
    expect(units(11_090_430_701)).not.toContain('$')
  })
})

describe('the asset record', () => {
  const SEARCH = {
    coins: [{ id: 'pi-network', symbol: 'PI', name: 'Pi Network', market_cap_rank: 70 }],
  }
  const COIN = {
    id: 'pi-network',
    symbol: 'pi',
    name: 'Pi Network',
    market_cap_rank: 70,
    platforms: { '': '' },
    categories: ['Layer 1 (L1)', 'Mobile Mining'],
    last_updated: '2026-08-22T00:10:30.000Z',
    links: { homepage: ['https://minepi.com'], blockchain_site: ['https://blockexplorer.minepi.com'] },
    market_data: {
      current_price: { usd: 0.096942 },
      market_cap: { usd: 1_075_360_292 },
      total_volume: { usd: 40_000_000 },
      circulating_supply: 11_090_430_701,
      total_supply: 17_062_201_079,
      max_supply: 100_000_000_000,
      price_change_percentage_24h: 3.5,
      ath: { usd: 2.99 },
      ath_date: { usd: '2025-02-26T08:41:03.000Z' },
      ath_change_percentage: { usd: -96.7 },
    },
  }

  function run(value: string) {
    const ctx = ctxOf((url) =>
      url.includes('/search') ? { body: SEARCH } : { body: COIN },
    )
    return { ctx, out: cryptoAssets.run(ask(value), ctx) }
  }

  it('spends at most two requests, because a third would be refused', async () => {
    // CoinGecko's keyless tier allows a handful of calls a minute, and a source
    // that fans out is throttled into returning nothing while still looking
    // healthy — the failure already paid for in the ECB curve and the World
    // Bank indicators.
    const { ctx, out } = run('pi network')
    await out
    expect(ctx.fetch).toHaveBeenCalledTimes(2)
  })

  it('reports supply against the cap, which is the fact a price alone hides', async () => {
    const claims = (await run('pi network').out).map((e) => e.claim)
    expect(claims.some((c) => c.includes('In circulation') && c.includes('11.09B PI') && c.includes('11.1% of the maximum'))).toBe(true)
    expect(claims.some((c) => c.includes('Maximum that can exist') && c.includes('100.00B'))).toBe(true)
  })

  it('says how far the asset is from its record, with the date of it', async () => {
    const claims = (await run('pi network').out).map((e) => e.claim)
    expect(claims.some((c) => c.includes('All-time high') && c.includes('2025-02-26') && c.includes('-96.70%'))).toBe(true)
  })

  it('states that a native asset has its own chain rather than leaving it blank', async () => {
    // `platforms: {'': ''}` is CoinGecko's encoding for a native asset. Read
    // naively it is an empty object, and the row would silently vanish — which
    // is exactly the distinction between a coin and a token disappearing.
    const claims = (await run('pi network').out).map((e) => e.claim)
    expect(claims.some((c) => c.includes('Runs on') && c.includes('Its own chain'))).toBe(true)
  })

  it('names an uncapped supply instead of omitting the row', async () => {
    const ctx = ctxOf((url) =>
      url.includes('/search')
        ? { body: SEARCH }
        : { body: { ...COIN, market_data: { ...COIN.market_data, max_supply: null } } },
    )
    const claims = (await cryptoAssets.run(ask('pi network'), ctx)).map((e) => e.claim)
    // A missing cap and no cap must not look the same: one is absent data, the
    // other is a fact about the asset that changes what it is worth.
    expect(claims.some((c) => c.includes('No cap published'))).toBe(true)
  })

  it('tells the reader when the search matched other assets too', async () => {
    const ctx = ctxOf((url) =>
      url.includes('/search')
        ? {
            body: {
              coins: [
                { id: 'pi-network', symbol: 'PI', name: 'Pi Network', market_cap_rank: 70 },
                { id: 'pieverse', symbol: 'PIEVERSE', name: 'Pieverse', market_cap_rank: 135 },
              ],
            },
          }
        : { body: COIN },
    )
    const claims = (await cryptoAssets.run(ask('pi'), ctx)).map((e) => e.claim)
    expect(claims.some((c) => c.includes('other match') && c.includes('Pieverse'))).toBe(true)
  })

  it('returns the largest assets, in rank order, when nothing is asked', async () => {
    const ctx = ctxOf(() => ({
      body: [
        { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 77935, market_cap: 1.56e12, market_cap_rank: 1, price_change_percentage_24h: 7.7, last_updated: '2026-08-22T00:10:30.000Z' },
        { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 2500, market_cap: 3e11, market_cap_rank: 2, price_change_percentage_24h: -1.2, last_updated: '2026-08-22T00:10:30.000Z' },
      ],
    }))
    const out = await cryptoAssets.run(ask(''), ctx)
    expect(ctx.fetch).toHaveBeenCalledTimes(1)
    // Weight descending is what the board sorts on, so #1 must weigh more.
    const weights = out.map((e) => (e.data as { weight: number }).weight)
    expect(weights[0]).toBeGreaterThan(weights[1])
    expect(out[0]?.claim).toContain('#1 Bitcoin')
  })

  it('returns nothing when nothing matched, rather than the largest coin', async () => {
    const ctx = ctxOf((url) => (url.includes('/search') ? { body: { coins: [] } } : { body: COIN }))
    expect(await cryptoAssets.run(ask('zzzzzz'), ctx)).toEqual([])
    // And does not spend the second request finding that out.
    expect(ctx.fetch).toHaveBeenCalledTimes(1)
  })

  it('fails loudly when throttled, rather than reporting healthy and empty', async () => {
    // CoinGecko throttles keyless callers, and `if (!res.ok) return []` is what
    // turns that into a green source with nothing to say — the board then reads
    // "2 sources ok" while missing half its answer.
    await expect(
      cryptoAssets.run(ask(''), ctxOf(() => ({ ok: false, status: 429 }))),
    ).rejects.toThrow(/429/)
  })

  it('treats an unparseable body as a provider failure, not as no results', async () => {
    await expect(
      cryptoAssets.run(ask(''), ctxOf(() => ({ badJson: true, text: '<html>error</html>' }))),
    ).rejects.toThrow()
  })

  it('survives a response that is the wrong shape but genuinely from the provider', async () => {
    for (const body of [null, {}, 7]) {
      expect(await cryptoAssets.run(ask(''), ctxOf(() => ({ body })))).toEqual([])
    }
  })

  it('claims a place above the sector at large for the asset that was asked for', async () => {
    // Size is the board's default proxy for importance, and here it is wrong:
    // seven rows about the asset would otherwise land beneath seventy general
    // headlines, so the answer to the question arrives seventh.
    const weightOf = (rows: Awaited<ReturnType<typeof cryptoAssets.run>>, needle: string) =>
      (rows.find((e) => e.claim.includes(needle))?.data as { groupWeight?: number })?.groupWeight ?? 0
    const asset = await run('pi network').out
    const news = await cryptoNews.run(ask(''), ctxOf(() => ({ text: NEWS_RSS })))

    expect(weightOf(asset, 'Price')).toBeGreaterThan(
      (news[0]?.data as { groupWeight?: number })?.groupWeight ?? 0,
    )
    // And within the asset, price leads the links you would check it against.
    expect(weightOf(asset, 'Price')).toBeGreaterThan(weightOf(asset, 'Official site'))
  })

  it('reads passively, from one declared host', () => {
    expect(cryptoAssets.passive).toBe(true)
    expect(cryptoAssets.hosts).toEqual(['api.coingecko.com'])
  })
})

describe('the news half', () => {
  const RSS = NEWS_RSS

  it('reads its feed list from the catalogue, not from a second list here', () => {
    const keys = cryptoFeeds().map((f) => f.key)
    expect(keys).toContain('pi_network_blog')
    expect(keys).toContain('ethereum_foundation_blog')
    // Every host the source may reach is derived from that same list, so the
    // guardrail allowlist cannot drift from the feeds that exist.
    for (const feed of cryptoFeeds()) {
      expect(cryptoNews.hosts).toContain(new URL(feed.url).hostname.toLowerCase())
    }
  })

  it('separates what a network announced from what the press reported about it', () => {
    const feeds = cryptoFeeds()
    const pi = feeds.find((f) => f.key === 'pi_network_blog')!
    const press = feeds.find((f) => f.key === 'cointelegraph')!
    expect(publisherTier(pi)).toBe('From the networks themselves')
    expect(publisherTier(press)).toBe('Specialist press')
  })

  it('fetches every feed in one run without refusing itself', async () => {
    // A high `minIntervalMs` here would rate-limit the source against its own
    // previous fetch and return one publisher's view of the world while
    // reporting healthy. Same bug, third appearance.
    const ctx = ctxOf(() => ({ text: RSS }))
    await cryptoNews.run(ask(''), ctx)
    expect((ctx.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(cryptoFeeds().length)
  })

  it('keeps going when one publisher fails', async () => {
    const ctx = ctxOf((url) =>
      url.includes('minepi.com') ? { ok: false, status: 503 } : { text: RSS },
    )
    const out = await cryptoNews.run(ask(''), ctx)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((e) => e.sourceKey !== 'pi_network_blog')).toBe(true)
  })

  it('carries the publisher’s own timestamp, never ours', async () => {
    const out = await cryptoNews.run(ask(''), ctxOf(() => ({ text: RSS })))
    expect(out[0]?.publishedAt).toBe('2026-08-14T15:50:34.000Z')
  })

  it('grades an announcement above a report about one', async () => {
    const out = await cryptoNews.run(ask(''), ctxOf(() => ({ text: RSS })))
    const primary = out.find((e) => e.sourceKey === 'pi_network_blog')
    const press = out.find((e) => e.sourceKey === 'cointelegraph')
    expect(primary?.admiralty).toEqual({ source: 'A', info: 1 })
    expect(press?.admiralty?.info).toBe(3)
  })

  it('lifts headlines that mention the subject into their own box', async () => {
    const out = await cryptoNews.run(ask('Pi Node'), ctxOf(() => ({ text: RSS })))
    const groups = out.map((e) => (e.data as { group: string }).group)
    expect(groups).toContain('News mentioning “Pi Node”')
    // And leaves the rest where they were, rather than hiding them.
    expect(groups.some((g) => g === 'From the networks themselves' || g === 'Specialist press')).toBe(true)
  })

  it('reads passively', () => {
    expect(cryptoNews.passive).toBe(true)
  })
})
