import { describe, it, expect } from 'vitest'
import { centroidOf, pointsFromCountries } from './centroids'

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
