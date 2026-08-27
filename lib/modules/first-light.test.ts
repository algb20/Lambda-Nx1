import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FIRST_LIGHT, inFirstLight } from './first-light'
import { getWorldEvents, resetSweepCache, SWEEP_CACHE_MS } from './world-events'
import {
  registerCatalogSources,
  registerNewsGateway,
  registerWorldEventsGateway,
} from '@/lib/engine/sources'
import { registry } from '@/lib/engine/registry'

registerWorldEventsGateway()
registerNewsGateway()
registerCatalogSources()

const measured = registry.sourcesFor('world_events').map((s) => s.key)

describe('the first-light list names sources that exist', () => {
  /**
   * The one failure mode a hand-written key list has: a source is renamed or
   * retired, the list keeps the old key, and the first pass quietly reads
   * thirteen feeds instead of fourteen — or, if enough go, throws. Nothing else
   * in the codebase would notice.
   */
  it('every key is a registered world_events source', () => {
    const missing = [...FIRST_LIGHT].filter((k) => !measured.includes(k))
    expect(missing, 'first-light names a source that is not registered').toEqual([])
  })

  it('is a strict subset of the measured fan-out', () => {
    expect(FIRST_LIGHT.size).toBeLessThan(measured.length)
  })
})

describe('the list stays small, because that is the entire point', () => {
  /**
   * The profile that justifies this module: 135 measured feeds took 2,491ms
   * while the slowest single response was 335ms — the cost is the number of
   * concurrent requests, not any provider. A first pass that grew towards the
   * full list would cost the same and buy nothing.
   *
   * The ceiling is generous enough that a genuinely global authority can be
   * added, and low enough that the list cannot drift into being the fan-out.
   */
  it('reads at most twenty feeds', () => {
    expect(FIRST_LIGHT.size).toBeLessThanOrEqual(20)
  })

  it('reads at most a sixth of the measured fan-out', () => {
    expect(FIRST_LIGHT.size / measured.length).toBeLessThan(1 / 6)
  })

  /**
   * 39 of the 135 measured sources are `meteoalarm_*` — one per European
   * country. They are the clearest example of what does not belong in a first
   * pass: thorough together, and individually one country's weather warnings.
   * Thirty-nine requests to Europe is not a picture of the world.
   */
  it('includes no single-country weather feed', () => {
    const regional = [...FIRST_LIGHT].filter((k) => k.startsWith('meteoalarm_'))
    expect(regional).toEqual([])
  })
})

describe('the predicate', () => {
  it('accepts a listed source', () => {
    expect(inFirstLight('usgs_recent')).toBe(true)
  })

  it('rejects an unlisted one', () => {
    expect(inFirstLight('meteoalarm_france')).toBe(false)
  })

  it('rejects a name that is not a source at all', () => {
    expect(inFirstLight('')).toBe(false)
    expect(inFirstLight('not_a_source')).toBe(false)
  })
})

describe('what the first pass is for', () => {
  /**
   * Seismic is the reason the list is not shorter. Earthquakes are both the
   * events most likely to matter in the first second and the ones most reliably
   * located, and four independent networks publish them — so this is also where
   * corroboration can be real on the first paint rather than on the second.
   */
  it('carries several independent seismic networks, not one', () => {
    const seismic = [...FIRST_LIGHT].filter((k) => /quake|usgs|emsc/.test(k))
    expect(seismic.length).toBeGreaterThanOrEqual(4)
  })

  it('carries the worldwide natural-event and disaster aggregators', () => {
    expect(FIRST_LIGHT.has('nasa_eonet')).toBe(true)
    expect(FIRST_LIGHT.has('gdacs')).toBe(true)
  })

  /** Rare, and the single most time-critical thing this platform can carry. */
  it('carries tsunami warnings', () => {
    expect(FIRST_LIGHT.has('tsunami_gov')).toBe(true)
  })
})

/**
 * The sweep memo.
 *
 * Tested here rather than in a file of its own because it is the other half of
 * the same change: the tiers make the first paint fast, and the memo stops that
 * speed being paid for by the providers. Driving the browser suite — fifty page
 * visits, each firing two sweeps — saturated the server badly enough that the
 * world report stopped arriving inside thirty seconds, and the first diagnosis
 * was a layout bug.
 */
describe('a burst of readers costs one sweep, not one each', () => {
  beforeEach(() => resetSweepCache())
  afterEach(() => resetSweepCache())

  it('serves the same object to a second caller inside the window', async () => {
    const a = await getWorldEvents({ tier: 'first-light' })
    const b = await getWorldEvents({ tier: 'first-light' })
    // Identity, not equality: a second sweep would produce an equal-looking
    // report with a different `generatedAt`, and asserting on shape would pass
    // for a cache that does nothing.
    expect(b).toBe(a)
  }, 30_000)

  it('shares one in-flight sweep between callers that arrive together', async () => {
    const [a, b, c] = await Promise.all([
      getWorldEvents({ tier: 'first-light' }),
      getWorldEvents({ tier: 'first-light' }),
      getWorldEvents({ tier: 'first-light' }),
    ])
    expect(b).toBe(a)
    expect(c).toBe(a)
  }, 30_000)

  it('keeps the tiers apart, since they are different pictures', async () => {
    const first = await getWorldEvents({ tier: 'first-light' })
    const full = await getWorldEvents({ tier: 'full' })
    expect(full).not.toBe(first)
    expect(first.tier).toBe('first-light')
    expect(full.tier).toBe('full')
    expect(full.sourceHealth.length).toBeGreaterThan(first.sourceHealth.length)
    // Thirty seconds: this is the one case that runs a *full* cold sweep, 174
    // providers, and the 5s default failed it once for that reason alone.
  }, 30_000)

  /**
   * The age a reader sees must be the age of the sweep, not the age of the
   * cache hit. Rewriting `generatedAt` on a hit would make a thirty-second-old
   * picture claim to be new — the same lie the live-edge figure was fixed for.
   */
  it('does not restamp the report on a cache hit', async () => {
    const a = await getWorldEvents({ tier: 'first-light' })
    await new Promise((r) => setTimeout(r, 20))
    const b = await getWorldEvents({ tier: 'first-light' })
    expect(b.generatedAt).toBe(a.generatedAt)
  }, 30_000)

  it('runs again once the window has passed', async () => {
    const a = await getWorldEvents({ tier: 'first-light' })
    resetSweepCache()
    const b = await getWorldEvents({ tier: 'first-light' })
    expect(b).not.toBe(a)
  }, 30_000)

  /**
   * Short enough that nobody is shown a materially staler world, long enough to
   * collapse a burst. The browser refreshes every 120s, so this can never make
   * one reader's picture older than a quarter of their own refresh interval.
   */
  it('holds a sweep for well under the browser refresh interval', () => {
    expect(SWEEP_CACHE_MS).toBeGreaterThanOrEqual(10_000)
    expect(SWEEP_CACHE_MS).toBeLessThanOrEqual(60_000)
  })
})
