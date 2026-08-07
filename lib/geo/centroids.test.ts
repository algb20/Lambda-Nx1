import { describe, it, expect } from 'vitest'
import { centroidOf, pointsFromCountries, pointsFromEvidence } from './centroids'

describe('centroidOf', () => {
  it('resolves known countries (with aliases), null otherwise', () => {
    expect(centroidOf('United States')).toEqual([39.8, -98.6])
    expect(centroidOf('usa')).toEqual([39.8, -98.6])
    expect(centroidOf('  France ')).toEqual([46.2, 2.2])
    expect(centroidOf('Atlantis')).toBeNull()
  })
})

describe('pointsFromCountries', () => {
  it('aggregates to one weighted point per known country, dropping unknowns', () => {
    const pts = pointsFromCountries(['United States', 'united states', 'France', null, 'Atlantis'])
    expect(pts).toHaveLength(2)
    const us = pts.find((p) => p.label === 'United States')!
    expect(us.weight).toBe(2)
    expect(us.lat).toBe(39.8)
    expect(pts.find((p) => p.label === 'France')?.weight).toBe(1)
  })
})

describe('pointsFromEvidence', () => {
  it('uses exact coordinates when present and country centroids otherwise', () => {
    const pts = pointsFromEvidence([
      { lat: 35.6, lon: 139.7, label: 'Tokyo quake' }, // exact
      { country: 'France' }, // centroid fallback
      { lat: 999, lon: 0, label: 'bad' }, // out-of-range → dropped
      { label: 'no geo' }, // nothing → dropped
    ])
    expect(pts).toHaveLength(2)
    const exact = pts.find((p) => p.label === 'Tokyo quake')!
    expect(exact.lat).toBe(35.6)
    expect(exact.lon).toBe(139.7)
    expect(pts.find((p) => p.label === 'France')?.lat).toBe(46.2)
    expect(pts.some((p) => p.label === 'bad')).toBe(false)
  })
})

/**
 * Regression: the live world map plotted nothing for weeks because it read only
 * `country`, while the topic-less news feed places items by *coordinate*
 * (USGS epicentres) — GDELT, the country-tagged source, needs a topic and is
 * skipped there. These assert the shape the globe actually receives.
 */
describe('pointsFromEvidence — the topic-less news feed', () => {
  it('plots a USGS quake by its exact epicentre, with no country present', () => {
    const points = pointsFromEvidence([
      { lat: 38.2, lon: -117.9, place: null, country: null, label: '12km NW of Tonopah' } as never,
    ])
    expect(points).toHaveLength(1)
    expect(points[0].lat).toBeCloseTo(38.2)
    expect(points[0].lon).toBeCloseTo(-117.9)
    expect(points[0].label).toBe('12km NW of Tonopah')
  })

  it('still aggregates country-tagged items that carry no coordinates', () => {
    const points = pointsFromEvidence([
      { country: 'France', label: 'France' },
      { country: 'France', label: 'France' },
    ])
    expect(points).toHaveLength(1)
    expect(points[0].weight).toBe(2)
  })

  it('mixes both kinds in one feed rather than dropping either', () => {
    const points = pointsFromEvidence([
      { lat: 35.7, lon: 139.7, label: 'Tokyo quake' },
      { country: 'Kenya', label: 'Kenya' },
      { label: 'a headline with no location at all' },
    ])
    // Exact + country survive; the unplaceable item is dropped, not faked.
    expect(points).toHaveLength(2)
    expect(points.some((p) => p.label === 'Tokyo quake')).toBe(true)
    expect(points.some((p) => p.label?.includes('Kenya'))).toBe(true)
  })

  it('refuses out-of-range coordinates instead of drawing them somewhere wrong', () => {
    expect(pointsFromEvidence([{ lat: 999, lon: 0, label: 'bad' }])).toHaveLength(0)
    expect(pointsFromEvidence([{ lat: NaN, lon: 10, label: 'bad' }])).toHaveLength(0)
  })
})
