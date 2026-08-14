import { describe, it, expect } from 'vitest'
import {
  coverageMap,
  coverageSummary,
  declaredRegions,
  regionOfPoint,
  REGION_LABELS,
  type CoverageObservation,
} from './blindspots'
import type { CatalogSource } from '../engine/catalog/types'
import { PUBLIC_DOMAIN } from '../engine/catalog/licence'

/**
 * The distinction this module exists for: a region with no dots may be quiet or
 * it may be dark, and every competitor renders those identically. If these
 * tests pass and the two states still collapse into one, the feature is
 * decoration.
 */
function source(over: Partial<CatalogSource> = {}): CatalogSource {
  return {
    key: `k${Math.random()}`,
    name: 'A source',
    publisher: 'A publisher',
    url: 'https://example.com/feed',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['earthquake'],
    coverage: 'global',
    admiralty: 'A',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 300,
    keyless: true,
    ...over,
  }
}

const obs = (lat: number, lon: number, independence: string): CoverageObservation => ({
  lat,
  lon,
  independence,
  sourceKey: independence,
})

describe('regionOfPoint', () => {
  it('places well-known coordinates in the right band', () => {
    expect(regionOfPoint(40.7, -74)).toBe('north-america') // New York
    expect(regionOfPoint(-23.5, -46.6)).toBe('latin-america') // São Paulo
    expect(regionOfPoint(51.5, -0.1)).toBe('europe') // London
    expect(regionOfPoint(-1.3, 36.8)).toBe('africa') // Nairobi
    expect(regionOfPoint(35.7, 51.4)).toBe('middle-east') // Tehran
    expect(regionOfPoint(28.6, 77.2)).toBe('south-asia') // Delhi
    expect(regionOfPoint(35.7, 139.7)).toBe('east-asia') // Tokyo
    expect(regionOfPoint(-33.9, 151.2)).toBe('oceania') // Sydney
  })

  it('sends extreme latitudes to polar whatever the longitude', () => {
    expect(regionOfPoint(80, -100)).toBe('polar')
    expect(regionOfPoint(-75, 140)).toBe('polar')
  })

  it('always returns a region, never undefined', () => {
    // A point that classified as nothing would silently vanish from the map.
    for (let lat = -90; lat <= 90; lat += 15) {
      for (let lon = -180; lon <= 180; lon += 15) {
        expect(Object.keys(REGION_LABELS), `${lat},${lon}`).toContain(regionOfPoint(lat, lon))
      }
    }
  })
})

describe('declaredRegions', () => {
  it('gives a global source every region', () => {
    expect(declaredRegions(source({ coverage: 'global' }))).toHaveLength(
      Object.keys(REGION_LABELS).length,
    )
  })

  it('gives a national source only its own region', () => {
    // A national meteorological service is authoritative for its territory and
    // nowhere else. Treating it as global would manufacture coverage.
    expect(declaredRegions(source({ coverage: ['US'] }))).toEqual(['north-america'])
    expect(declaredRegions(source({ coverage: ['NZ'] }))).toEqual(['oceania'])
  })

  it('deduplicates countries that share a region', () => {
    expect(declaredRegions(source({ coverage: ['GB', 'IE', 'FR'] }))).toEqual(['europe'])
  })

  it('ignores a country code it does not know rather than guessing', () => {
    expect(declaredRegions(source({ coverage: ['ZZ'] }))).toEqual([])
  })
})

describe('the distinction competitors collapse', () => {
  it('separates dark from quiet', () => {
    // Both regions show zero events. Only one of them is a blind spot.
    const covered = [source({ coverage: ['US'], independence: 'a' }), source({ coverage: ['US'], independence: 'b' }), source({ coverage: ['US'], independence: 'c' })]
    const map = coverageMap(covered, [])

    const northAmerica = map.find((r) => r.region === 'north-america')!
    const africa = map.find((r) => r.region === 'africa')!

    expect(northAmerica.status).toBe('quiet')
    expect(africa.status).toBe('dark')

    // And the difference is stated, not left for the reader to infer.
    expect(northAmerica.explanation).toMatch(/silence is evidence/i)
    expect(africa.explanation).toMatch(/not evidence that nothing is happening/i)
  })

  it('never turns silence into an event', () => {
    // A dark region produces a coverage warning, never a hazard. Manufacturing
    // an event from an absence would invert the rule the whole product rests on.
    const map = coverageMap([], [])
    for (const region of map) {
      expect(region.reports).toBe(0)
      expect(region.observed).toBe(0)
      expect(region.status).toBe('dark')
    }
  })
})

describe('coverageMap', () => {
  it('counts declared coverage by independent origin, not by source', () => {
    // Three feeds from one agency are one origin's worth of coverage.
    const sameAgency = [
      source({ coverage: ['US'], independence: 'usgs' }),
      source({ coverage: ['US'], independence: 'usgs' }),
      source({ coverage: ['US'], independence: 'usgs' }),
    ]
    const map = coverageMap(sameAgency, [])
    const na = map.find((r) => r.region === 'north-america')!
    expect(na.declared).toBe(1)
    expect(na.status).toBe('thin')
  })

  it('marks a region with too few origins as thin, however loud it is', () => {
    const map = coverageMap(
      [source({ coverage: ['US'], independence: 'only-one' })],
      Array.from({ length: 50 }, () => obs(40, -100, 'only-one')),
    )
    const na = map.find((r) => r.region === 'north-america')!
    // Fifty reports from one origin is not coverage — it is a single point of
    // failure being noisy.
    expect(na.reports).toBe(50)
    expect(na.status).toBe('thin')
    expect(na.explanation).toMatch(/one outage would blind us/i)
  })

  it('reports observed origins separately from raw report counts', () => {
    const map = coverageMap(
      [
        source({ coverage: 'global', independence: 'a' }),
        source({ coverage: 'global', independence: 'b' }),
        source({ coverage: 'global', independence: 'c' }),
      ],
      [obs(51, 0, 'a'), obs(52, 1, 'a'), obs(48, 2, 'b')],
    )
    const europe = map.find((r) => r.region === 'europe')!
    expect(europe.reports).toBe(3)
    expect(europe.observed).toBe(2) // a and b, not three reports
    expect(europe.status).toBe('active')
  })

  it('ignores an observation with no coordinate rather than assigning one', () => {
    const map = coverageMap(
      [source({ coverage: 'global', independence: 'a' }), source({ coverage: 'global', independence: 'b' }), source({ coverage: 'global', independence: 'c' })],
      [{ lat: null, lon: null, independence: 'a', sourceKey: 'a' }],
    )
    // Placing it somewhere would put a guess on the coverage map.
    expect(map.every((r) => r.reports === 0)).toBe(true)
  })

  it('sorts the regions an operator must not trust to the top', () => {
    const map = coverageMap(
      [source({ coverage: ['US'], independence: 'a' }), source({ coverage: ['US'], independence: 'b' }), source({ coverage: ['US'], independence: 'c' })],
      [obs(40, -100, 'a')],
    )
    expect(map[0].status).toBe('dark')
    expect(map[map.length - 1].status).toBe('active')
  })

  it('covers every region in the output, including the empty ones', () => {
    // A region omitted because it had nothing is a blind spot hidden by the
    // very report meant to reveal it.
    expect(coverageMap([], [])).toHaveLength(Object.keys(REGION_LABELS).length)
  })
})

describe('coverageSummary', () => {
  it('reports how much of the world we can actually speak about', () => {
    const map = coverageMap(
      [
        source({ coverage: 'global', independence: 'a' }),
        source({ coverage: 'global', independence: 'b' }),
        source({ coverage: 'global', independence: 'c' }),
      ],
      [obs(51, 0, 'a')],
    )
    const summary = coverageSummary(map)
    expect(summary.dark).toBe(0)
    expect(summary.trustworthyRegions).toBe(summary.totalRegions)
  })

  it('counts the dark regions honestly when the catalogue is narrow', () => {
    const summary = coverageSummary(coverageMap([source({ coverage: ['US'] })], []))
    expect(summary.dark).toBe(Object.keys(REGION_LABELS).length - 1)
    expect(summary.trustworthyRegions).toBe(0)
  })
})
