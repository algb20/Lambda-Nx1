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
