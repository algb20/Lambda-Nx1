import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import {
  cachedSourceResult,
  clearSourceCache,
  rememberSourceResult,
  sourceCacheSize,
  MAX_CACHE_AGE_MS,
} from './source-cache'
import { Guardrail, RateLimitedError, MAX_POLITE_WAIT_MS } from './guardrail'
import { collect } from './orchestrator'
import { Registry } from './registry'
import type { Evidence, Source } from './types'

const evidence = (claim: string): Evidence => ({
  claim,
  sourceKey: 'demo',
  retrievedAt: '2026-08-15T00:00:00.000Z',
  confidence: 'unconfirmed',
})

beforeEach(() => clearSourceCache())

describe('the source cache', () => {
  it('replays the last answer for the same source and input', () => {
    rememberSourceResult('demo', '', [evidence('a')])
    expect(cachedSourceResult('demo', '')?.evidence[0].claim).toBe('a')
  })

  it('keeps answers to different queries apart', () => {
    rememberSourceResult('demo', 'sudan', [evidence('a')])
    expect(cachedSourceResult('demo', 'yemen')).toBeNull()
  })

  /**
   * Replaying "nothing" for an hour is indistinguishable from the source being
   * down, and would hide a real change the moment the feed recovered.
   */
  it('does not hold an empty answer', () => {
    rememberSourceResult('demo', '', [])
    expect(cachedSourceResult('demo', '')).toBeNull()
  })

  it('stops serving an answer older than a day', () => {
    const t0 = Date.parse('2026-08-15T00:00:00.000Z')
    rememberSourceResult('demo', '', [evidence('a')], t0)
    expect(cachedSourceResult('demo', '', t0 + MAX_CACHE_AGE_MS - 1000)).not.toBeNull()
    expect(cachedSourceResult('demo', '', t0 + MAX_CACHE_AGE_MS + 1000)).toBeNull()
  })

  it('reports the true age, so nothing downstream thinks it is fresh', () => {
    const t0 = Date.parse('2026-08-15T00:00:00.000Z')
    rememberSourceResult('demo', '', [evidence('a')], t0)
    expect(cachedSourceResult('demo', '', t0 + 600_000)?.ageMs).toBe(600_000)
  })

  it('evicts least-recently-written entries rather than growing forever', () => {
    for (let i = 0; i < 450; i++) rememberSourceResult(`s${i}`, '', [evidence(`e${i}`)])
    expect(sourceCacheSize()).toBeLessThanOrEqual(400)
    expect(cachedSourceResult('s0', '')).toBeNull()
    expect(cachedSourceResult('s449', '')).not.toBeNull()
  })
})

describe('the rate limiter', () => {
  /**
   * The production fault this replaces: catalogue feeds declare intervals of
   * 900–3,600 seconds. Awaiting one inside a ten-second request slept fifteen
   * minutes, was killed by the 8s deadline, and reported every healthy feed as
   * a failure.
   */
  it('refuses immediately rather than sleeping out a long interval', async () => {
    const g = new Guardrail()
    g.allowHosts(['example.com'])
    const f = g.createFetch('demo', 900_000)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))

    await f('https://example.com/a')
    const started = Date.now()
    await expect(f('https://example.com/a')).rejects.toBeInstanceOf(RateLimitedError)
    // The point is that it did not wait fifteen minutes, or even one second.
    expect(Date.now() - started).toBeLessThan(500)
    vi.unstubAllGlobals()
  })

  it('still sleeps a short interval, because that is genuine politeness', async () => {
    const g = new Guardrail()
    g.allowHosts(['example.com'])
    const f = g.createFetch('polite', 120)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))

    await f('https://example.com/a')
    const started = Date.now()
    await f('https://example.com/a')
    const waited = Date.now() - started
    expect(waited).toBeGreaterThanOrEqual(90)
    expect(waited).toBeLessThan(MAX_POLITE_WAIT_MS)
    vi.unstubAllGlobals()
  })

  it('never refuses the first call to a source', async () => {
    const g = new Guardrail()
    g.allowHosts(['example.com'])
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
    await expect(g.createFetch('fresh', 3_600_000)('https://example.com/a')).resolves.toBeDefined()
    vi.unstubAllGlobals()
  })
})

describe('collect, on a warm container', () => {
  afterEach(() => vi.unstubAllGlobals())

  /**
   * The end-to-end shape of the bug. One reading of the live board showed
   * *112 sources failed, 125 events, 0 dated* — every catalogue feed red at
   * once, on a board whose data was in memory the whole time.
   */
  it('serves the previous answer instead of reporting a healthy source as failed', async () => {
    let fetches = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        fetches++
        return new Response('{}')
      }),
    )

    const source: Source = {
      key: 'slow_feed',
      capability: 'news',
      passive: true,
      hosts: ['example.com'],
      minIntervalMs: 900_000,
      async run(_input, ctx) {
        await ctx.fetch('https://example.com/feed')
        return [evidence('a real finding')]
      },
    }

    const reg = new Registry()
    reg.registerAll([source])

    const first = await collect({ capability: 'news', value: '' }, { registry: reg, mode: 'all' })
    expect(first.results[0].ok).toBe(true)
    expect(first.results[0].cached).toBeUndefined()
    expect(first.evidence).toHaveLength(1)

    const second = await collect({ capability: 'news', value: '' }, { registry: reg, mode: 'all' })
    // Not fetched again — the publisher's interval is honoured exactly.
    expect(fetches).toBe(1)
    // And not reported as a failure, which is what used to happen.
    expect(second.results[0].ok).toBe(true)
    expect(second.results[0].cached).toBe(true)
    expect(second.results[0].error).toBeUndefined()
    expect(second.evidence).toHaveLength(1)
    // The replayed finding keeps its original retrieval time.
    expect(second.evidence[0].retrievedAt).toBe('2026-08-15T00:00:00.000Z')
  })

  /**
   * The gap the first version of this fix shipped with, reproduced exactly.
   *
   * `/api/diagnose` runs the world sweep and the news sweep concurrently and
   * both read the `news` capability. The world sweep won every race, stamped
   * the source's clock, and the news sweep was refused a millisecond later with
   * nothing cached yet — so the deploy preview reported *9 reports from 2
   * independent origins* while 101 answers sat in the cache put there by the
   * sweep that beat it.
   */
  it('gives both concurrent sweeps the full answer from one request', async () => {
    let fetches = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        fetches++
        // A real fetch is not instantaneous, which is the entire point: the
        // second caller arrives while the first is still in flight.
        await new Promise((r) => setTimeout(r, 40))
        return new Response('{}')
      }),
    )

    const source: Source = {
      key: 'contested_feed',
      capability: 'news',
      passive: true,
      hosts: ['example.com'],
      minIntervalMs: 900_000,
      async run(_input, ctx) {
        await ctx.fetch('https://example.com/feed')
        return [evidence('one'), evidence('two')]
      },
    }
    const reg = new Registry()
    reg.registerAll([source])

    const [a, b] = await Promise.all([
      collect({ capability: 'news', value: '' }, { registry: reg, mode: 'all' }),
      collect({ capability: 'news', value: '' }, { registry: reg, mode: 'all' }),
    ])

    // One request served both — the publisher sees exactly what it would have.
    expect(fetches).toBe(1)
    // And neither caller was starved. Before single-flight, one got zero.
    expect(a.evidence).toHaveLength(2)
    expect(b.evidence).toHaveLength(2)
    expect(a.results[0].ok).toBe(true)
    expect(b.results[0].ok).toBe(true)
  })

  it('lets the next caller retry after a failed run rather than inheriting it', async () => {
    let attempts = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        attempts++
        if (attempts === 1) throw new Error('provider hiccup')
        return new Response('{}')
      }),
    )
    const source: Source = {
      key: 'flaky_feed',
      capability: 'news',
      passive: true,
      hosts: ['example.com'],
      // Short enough that the retry is not itself rate-limited.
      minIntervalMs: 1,
      async run(_input, ctx) {
        await ctx.fetch('https://example.com/feed')
        return [evidence('recovered')]
      },
    }
    const reg = new Registry()
    reg.registerAll([source])

    const first = await collect({ capability: 'news', value: '' }, { registry: reg, mode: 'all' })
    expect(first.results[0].ok).toBe(false)

    // A rejected promise left in the in-flight map would poison the key forever.
    const second = await collect({ capability: 'news', value: '' }, { registry: reg, mode: 'all' })
    expect(second.results[0].ok).toBe(true)
    expect(second.evidence).toHaveLength(1)
  })

  it('reports a rate-limited source with nothing held as empty, not failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
    const source: Source = {
      key: 'quiet_feed',
      capability: 'news',
      passive: true,
      hosts: ['example.com'],
      minIntervalMs: 900_000,
      async run(_input, ctx) {
        await ctx.fetch('https://example.com/feed')
        return [] // answers, but with nothing — so nothing is cached
      },
    }
    const reg = new Registry()
    reg.registerAll([source])

    await collect({ capability: 'news', value: '' }, { registry: reg, mode: 'all' })
    const second = await collect({ capability: 'news', value: '' }, { registry: reg, mode: 'all' })
    expect(second.results[0].ok).toBe(true)
    expect(second.results[0].cached).toBe(true)
    expect(second.results[0].cacheAgeMs).toBeNull()
    expect(second.results[0].error).toBeUndefined()
  })
})

/**
 * A failure on the *provider's* side, which is a different thing from our own
 * politeness refusing to fetch — and used to be treated far worse.
 */
describe('collect, when the provider itself fails', () => {
  afterEach(() => vi.unstubAllGlobals())

  function flakySource(fail: { now: boolean }): Source {
    return {
      key: 'flaky_provider',
      capability: 'news',
      passive: true,
      hosts: ['example.com'],
      async run() {
        if (fail.now) throw new Error('flaky_provider: provider answered 429')
        return [evidence('a real finding')]
      },
    }
  }

  it('still answers from the last good reading, and still calls the fetch a failure', async () => {
    // CoinGecko throttles keyless callers, so the crypto gateway's asset half
    // would vanish the moment two readers searched inside a minute — while the
    // identical rows sat in memory. The cache was consulted only when *we*
    // declined to fetch, never when the provider fell over.
    const fail = { now: false }
    const reg = new Registry()
    reg.registerAll([flakySource(fail)])

    const first = await collect({ capability: 'news', value: 'q' }, { registry: reg, mode: 'all' })
    expect(first.evidence).toHaveLength(1)

    fail.now = true
    const second = await collect({ capability: 'news', value: 'q' }, { registry: reg, mode: 'all' })

    // The reader is not shown an empty panel.
    expect(second.evidence).toHaveLength(1)
    expect(second.evidence[0].retrievedAt).toBe('2026-08-15T00:00:00.000Z')
    expect(second.results[0].cached).toBe(true)
    // And the product does not report itself healthy while serving stale data:
    // a fetch failed, the count says so, and the reason is carried.
    expect(second.results[0].ok).toBe(false)
    expect(second.results[0].error).toContain('429')
    expect(second.results[0].cacheAgeMs).toBeTypeOf('number')
  })

  it('reports an empty failure when nothing was ever held', async () => {
    const reg = new Registry()
    reg.registerAll([flakySource({ now: true })])
    const r = await collect({ capability: 'news', value: 'cold' }, { registry: reg, mode: 'all' })
    expect(r.results[0].ok).toBe(false)
    expect(r.results[0].cached).toBeUndefined()
    expect(r.evidence).toEqual([])
  })

  it('prefers a live sibling over our stale copy in a fallback chain', async () => {
    const reg = new Registry()
    const healthy: Source = {
      key: 'healthy_provider',
      capability: 'news',
      passive: true,
      hosts: ['example.org'],
      async run() {
        return [{ ...evidence('fresh'), sourceKey: 'healthy_provider' }]
      },
    }
    reg.registerAll([flakySource({ now: false }), healthy])
    await collect({ capability: 'news', value: 'chain' }, { registry: reg, mode: 'first' })

    const reg2 = new Registry()
    reg2.registerAll([flakySource({ now: true }), healthy])
    const r = await collect({ capability: 'news', value: 'chain' }, { registry: reg2, mode: 'first' })
    // A cached-after-failure result does not stop the chain: the ordered
    // fallback exists precisely so a live sibling can answer instead.
    expect(r.results.map((x) => x.sourceKey)).toContain('healthy_provider')
    expect(r.evidence.some((e) => e.claim === 'fresh')).toBe(true)
  })
})
