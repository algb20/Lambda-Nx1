import { describe, expect, it } from 'vitest'
import { activeSituations, eventsInLayers, intelligenceHealth, LAYER_GROUPS, layerGroupOf } from './dashboard'
import { CATEGORY_META, type EventCategory, type WorldEventsReport } from '@/lib/modules/world-events-shared'

function report(over: Partial<WorldEventsReport> = {}): WorldEventsReport {
  return {
    generatedAt: '2026-10-09T12:00:00.000Z',
    events: [],
    unplaceable: [],
    categories: [],
    regions: [],
    hotspots: [],
    sourceHealth: [],
    timeline: { days: [], bands: [] } as never,
    fused: [],
    fusion: { signals: 0, events: 0, corroborated: 0, contested: 0, duplicatesRemoved: 0 },
    coverage: [],
    coverageSummary: { dark: 0, thin: 0, quiet: 0, active: 0, trustworthyRegions: 0, totalRegions: 0 },
    summary: { total: 0, placed: 0, newestAt: null, untimed: 0, sources: [], sourcesOk: 0, sourcesEmpty: 0, sourcesFailed: 0 },
    ...over,
  }
}

describe('Home dashboard computations (R338)', () => {
  it('puts every event category in exactly one map layer', () => {
    for (const c of Object.keys(CATEGORY_META) as EventCategory[]) {
      expect(LAYER_GROUPS.filter((g) => g.categories.includes(c)).length, c).toBe(1)
    }
    expect(layerGroupOf('seismic')).toBe('physical')
    expect(layerGroupOf('cyber')).toBe('digital')
  })

  it('filters events by the layers switched on', () => {
    const ev = (category: EventCategory) => ({ category }) as never
    expect(eventsInLayers([ev('seismic'), ev('cyber')], new Set(['physical'])).length).toBe(1)
  })

  it('measures health as counted rates, and says nothing when there is nothing to count', () => {
    const empty = intelligenceHealth(report())
    expect(empty.overall).toBeNull()
    const h = intelligenceHealth(
      report({
        sourceHealth: [
          { sourceKey: 'a', status: 'ok', count: 3, error: null },
          { sourceKey: 'b', status: 'empty', count: 0, error: null },
          { sourceKey: 'c', status: 'failed', count: 0, error: 'x' },
          { sourceKey: 'd', status: 'cached', count: 1, error: null },
        ] as never,
        coverageSummary: { dark: 1, thin: 0, quiet: 0, active: 3, trustworthyRegions: 3, totalRegions: 4 },
        fusion: { signals: 10, events: 8, corroborated: 2, contested: 0, duplicatesRemoved: 2 },
        summary: { total: 10, placed: 8, newestAt: null, untimed: 1, sources: [], sourcesOk: 2, sourcesEmpty: 1, sourcesFailed: 1 },
      }),
    )
    expect(h).toEqual({ sourceHealth: 50, reachability: 75, coverage: 75, corroboration: 25, dated: 90, overall: 50 })
  })

  it('leads situations with what independent origins agree on', () => {
    const f = (id: string, n: number) => ({ id, independentSources: n, signals: [], lastReceivedAt: '2026-10-09T00:00:00Z' }) as never
    expect(activeSituations(report({ fused: [f('a', 1), f('b', 3), f('c', 2)] }), 2).map((x) => x.id)).toEqual(['b', 'c'])
  })

})
