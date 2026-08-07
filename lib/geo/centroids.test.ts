import { describe, it, expect } from 'vitest'
import { centroidOf, isPlottable, pointsFromCountries, pointsFromEvidence } from './centroids'
import { countryAt } from './atlas'

describe('centroidOf', () => {
  it('resolves countries by name, alias and ISO code', () => {
    expect(centroidOf('France')).not.toBeNull()
    expect(centroidOf('usa')).toEqual(centroidOf('United States of America'))
    expect(centroidOf('  France ')).toEqual(centroidOf('france'))
    expect(centroidOf('Atlantis')).toBeNull()
  })

  it('returns a point that really is in that country', () => {
    const [lat, lon] = centroidOf('France')!
    expect(countryAt(lat, lon)?.iso).toBe('FR')
    const [jlat, jlon] = centroidOf('Japan')!
    expect(countryAt(jlat, jlon)?.iso).toBe('JP')
  })

  /**
   * The centroids used to be a hand-typed table of ~65 countries, so a signal
   * from anywhere else vanished without a trace. Deriving them from the shipped
   * outlines is what closed that hole — these countries were all previously
   * unplottable.
   */
  it('covers countries the old hand-written table never had', () => {
    for (const name of ['Mongolia', 'Bolivia', 'Zambia', 'Laos', 'Uzbekistan', 'Namibia']) {
      expect(centroidOf(name), name).not.toBeNull()
    }
  })
})

describe('pointsFromCountries', () => {
  it('aggregates to one weighted point per country, dropping unknowns', () => {
    const pts = pointsFromCountries(['United States', 'united states', 'France', null, 'Atlantis'])
    expect(pts).toHaveLength(2)
    const us = pts.find((p) => p.label.includes('United States'))!
    expect(us.weight).toBe(2)
    expect(pts.find((p) => p.label === 'France')?.weight).toBe(1)
  })

  it('merges aliases of the same country instead of splitting its count', () => {
    const pts = pointsFromCountries(['USA', 'United States', 'US', 'united states of america'])
    expect(pts).toHaveLength(1)
    expect(pts[0].weight).toBe(4)
  })
})

describe('isPlottable', () => {
  it('accepts real coordinates and rejects everything else', () => {
    expect(isPlottable(48.85, 2.35)).toBe(true)
    expect(isPlottable(-90, 180)).toBe(true)
    expect(isPlottable(91, 0)).toBe(false)
    expect(isPlottable(0, 181)).toBe(false)
    expect(isPlottable(NaN, 0)).toBe(false)
    expect(isPlottable('48', 2)).toBe(false)
  })
})

describe('pointsFromEvidence', () => {
  it('uses exact coordinates when present and country centroids otherwise', () => {
    const pts = pointsFromEvidence([
      { lat: 35.6, lon: 139.7, label: 'Tokyo quake' },
      { country: 'France' },
      { lat: 999, lon: 0, label: 'bad' },
      { label: 'no geo' },
    ])
    expect(pts).toHaveLength(2)
    const exact = pts.find((p) => p.label === 'Tokyo quake')!
    expect(exact.lat).toBe(35.6)
    expect(exact.lon).toBe(139.7)
    expect(pts.some((p) => p.label === 'France')).toBe(true)
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
      { lat: 38.2, lon: -117.9, country: null, label: '12km NW of Tonopah' },
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
    expect(points).toHaveLength(2)
    expect(points.some((p) => p.label === 'Tokyo quake')).toBe(true)
    expect(points.some((p) => p.label?.includes('Kenya'))).toBe(true)
  })

  it('refuses out-of-range coordinates instead of drawing them somewhere wrong', () => {
    expect(pointsFromEvidence([{ lat: 999, lon: 0, label: 'bad' }])).toHaveLength(0)
    expect(pointsFromEvidence([{ lat: NaN, lon: 10, label: 'bad' }])).toHaveLength(0)
  })
})
