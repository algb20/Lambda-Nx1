import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadWorld,
  resetWorldForTests,
  subscribeToWorld,
  worldState,
} from './report-store'
import type { WorldEventsReport } from '@/lib/modules/world-events-shared'

/**
 * The two-pass load, and the two things about it that can go wrong silently.
 *
 * Both were real. The first version of `bootstrap` asked for the fast pass and
 * the full one, and its own comment claimed it bypassed the single-flight guard
 * — which it did not, so the second call returned the first's promise and the
 * first-light request **was never sent**. The second is the race: the two
 * passes are independent requests and the fast one is not guaranteed to land
 * first, so the smaller picture can arrive last and take events off the map.
 *
 * Neither is visible in a browser, because both produce a page that looks
 * exactly right most of the time.
 */

function report(over: Partial<WorldEventsReport> = {}): WorldEventsReport {
  return {
    generatedAt: '2026-08-27T12:00:00.000Z',
    events: [],
    unplaceable: [],
    categories: [],
    regions: [],
    hotspots: [],
    sourceHealth: [],
    timeline: { days: [], bands: [] },
    fused: [],
    fusion: { signals: 0, events: 0, corroborated: 0, contested: 0, duplicatesRemoved: 0 },
    coverage: [],
    coverageSummary: {
      dark: 0,
      thin: 0,
      quiet: 0,
      active: 0,
      trustworthyRegions: 0,
      totalRegions: 0,
    },
    summary: {
      total: 0,
      placed: 0,
      newestAt: null,
      untimed: 0,
      sources: [],
      sourcesOk: 0,
      sourcesEmpty: 0,
      sourcesFailed: 0,
    },
    ...over,
  } as WorldEventsReport
}

/** A fetch we drive by hand, so a race can be run in a chosen order. */
function controlledFetch() {
  const calls: string[] = []
  const pending = new Map<string, (body: WorldEventsReport) => void>()
  const fn = vi.fn((url: string) => {
    calls.push(url)
    return new Promise((resolve) => {
      pending.set(url, (body) =>
        resolve({ ok: true, status: 200, json: async () => body } as Response),
      )
    })
  })
  return {
    fn,
    calls,
    /**
     * Answer one outstanding request, by its **exact** URL.
     *
     * Exact and not a substring, which the first version got wrong: matching
     * `/api/world` by `includes` also matches `/api/world?tier=first-light`,
     * so settling "the full sweep" settled the fast pass instead and the race
     * this file exists to test was never run in the order it claimed.
     */
    settle(url: string, body: WorldEventsReport) {
      const resolve = pending.get(url)
      if (!resolve) {
        throw new Error(`"${url}" is not outstanding — pending: ${[...pending.keys()].join(', ')}`)
      }
      pending.delete(url)
      resolve(body)
    },
  }
}

const FULL = '/api/world'
const FIRST = '/api/world?tier=first-light'

let fetchMock: ReturnType<typeof controlledFetch>

beforeEach(() => {
  resetWorldForTests()
  fetchMock = controlledFetch()
  vi.stubGlobal('fetch', fetchMock.fn)
  // The store refuses to run without a window; the interval it starts is
  // cleared by `resetWorldForTests` after each case.
  vi.stubGlobal('window', {} as unknown as Window)
  vi.stubGlobal('document', { visibilityState: 'visible' } as unknown as Document)
})

afterEach(() => {
  resetWorldForTests()
  vi.unstubAllGlobals()
})

describe('the first load asks for both passes', () => {
  /**
   * The bug the tier-keyed guard fixes. With one shared promise this saw a
   * single request and the fast pass silently did not exist.
   */
  it('sends the first-light request as well as the full one', () => {
    const stop = subscribeToWorld(() => undefined)
    expect(fetchMock.calls).toHaveLength(2)
    expect(fetchMock.calls.some((c) => c.includes('tier=first-light'))).toBe(true)
    expect(fetchMock.calls.some((c) => c === '/api/world')).toBe(true)
    stop()
  })

  it('asks for them at once rather than one after the other', () => {
    // Both are outstanding before either has answered — chaining them would
    // make the total the sum of two sweeps.
    const stop = subscribeToWorld(() => undefined)
    expect(fetchMock.calls).toHaveLength(2)
    stop()
  })

  it('still shares one request between surfaces mounting together', () => {
    const a = subscribeToWorld(() => undefined)
    const b = subscribeToWorld(() => undefined)
    const c = subscribeToWorld(() => undefined)
    // Three subscribers, still two requests: the guard does its real job.
    expect(fetchMock.calls).toHaveLength(2)
    a()
    b()
    c()
  })
})

describe('whichever lands first paints', () => {
  it('shows the first-light picture when it wins the race', async () => {
    const stop = subscribeToWorld(() => undefined)
    fetchMock.settle(FIRST, report({ tier: 'first-light' }))
    await vi.waitFor(() => expect(worldState().report).not.toBeNull())
    expect(worldState().report?.tier).toBe('first-light')
    expect(worldState().loading).toBe(false)
    stop()
  })

  it('replaces it with the full sweep when that arrives', async () => {
    const stop = subscribeToWorld(() => undefined)
    fetchMock.settle(FIRST, report({ tier: 'first-light' }))
    await vi.waitFor(() => expect(worldState().report?.tier).toBe('first-light'))
    fetchMock.settle(FULL, report({ tier: 'full', generatedAt: 'later' }))
    await vi.waitFor(() => expect(worldState().report?.tier).toBe('full'))
    expect(worldState().report?.generatedAt).toBe('later')
    stop()
  })
})

describe('the smaller picture never replaces the larger one', () => {
  /**
   * The race, run backwards. On a warm cache the full sweep can answer in
   * milliseconds and beat the pass that exists to be quick — and letting the
   * first-light report land on top of it would take events off a map that
   * already had them, for no reason a reader could see.
   */
  it('discards a late first-light report when the full sweep already landed', async () => {
    const stop = subscribeToWorld(() => undefined)
    fetchMock.settle(FULL, report({ tier: 'full', generatedAt: 'full-first' }))
    await vi.waitFor(() => expect(worldState().report?.tier).toBe('full'))

    fetchMock.settle(FIRST, report({ tier: 'first-light', generatedAt: 'late' }))
    // Give the late answer every chance to be applied.
    await new Promise((r) => setTimeout(r, 10))

    expect(worldState().report?.tier).toBe('full')
    expect(worldState().report?.generatedAt).toBe('full-first')
    stop()
  })

  it('still clears the loading flag when it discards one', async () => {
    const stop = subscribeToWorld(() => undefined)
    fetchMock.settle(FULL, report({ tier: 'full' }))
    await vi.waitFor(() => expect(worldState().loading).toBe(false))
    fetchMock.settle(FIRST, report({ tier: 'first-light' }))
    await new Promise((r) => setTimeout(r, 10))
    expect(worldState().loading).toBe(false)
    expect(worldState().refreshing).toBe(false)
    stop()
  })

  /**
   * A first-light report *may* replace an earlier first-light one: two of them
   * only happen across a reload, and the newer is the better picture.
   */
  it('allows a first-light report to replace an earlier first-light report', async () => {
    // Not awaited before settling: the request only resolves when this test
    // answers it, so awaiting first is a deadlock rather than a wait.
    void loadWorld(false, 'first-light')
    fetchMock.settle(FIRST, report({ tier: 'first-light', generatedAt: 'one' }))
    await vi.waitFor(() => expect(worldState().report?.generatedAt).toBe('one'))

    void loadWorld(true, 'first-light')
    fetchMock.settle(FIRST, report({ tier: 'first-light', generatedAt: 'two' }))
    await vi.waitFor(() => expect(worldState().report?.generatedAt).toBe('two'))
  })
})

describe('the refresh clock reads the whole world', () => {
  /**
   * First light is a *bootstrap*. A refresh that kept using it would pin the
   * board to fourteen feeds forever, which is a much worse failure than a slow
   * first paint — the reader would never learn what the other 160 said.
   */
  it('refreshes with the full sweep, not the fast pass', async () => {
    const stop = subscribeToWorld(() => undefined)
    // Both opening requests have to finish first, or the single-flight guard
    // correctly hands the refresh the sweep that is already running — which is
    // what it is for, and which the first version of this test mistook for a
    // missing request.
    fetchMock.settle(FIRST, report({ tier: 'first-light' }))
    fetchMock.settle(FULL, report({ tier: 'full' }))
    await vi.waitFor(() => expect(worldState().report?.tier).toBe('full'))

    fetchMock.calls.length = 0
    void loadWorld(true)
    expect(fetchMock.calls).toEqual([FULL])
    stop()
  })
})
