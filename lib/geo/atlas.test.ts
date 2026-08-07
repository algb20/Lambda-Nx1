import { describe, it, expect } from 'vitest'
import {
  ATLAS,
  countryAt,
  findCountry,
  pointInRing,
  representativePoint,
  ringArea,
  ringCentroid,
} from './atlas'
import { WORLD_ATLAS_POINTS, WORLD_COUNTRIES } from './world-atlas'

describe('the shipped atlas', () => {
  it('covers the world, not a sample of it', () => {
    expect(WORLD_COUNTRIES.length).toBeGreaterThan(150)
    expect(ATLAS).toHaveLength(WORLD_COUNTRIES.length)
  })

  it('has not been truncated by a bad regeneration', () => {
    const counted = WORLD_COUNTRIES.reduce(
      (n, c) => n + c.rings.reduce((m, r) => m + r.length / 2, 0),
      0,
    )
    expect(counted).toBe(WORLD_ATLAS_POINTS)
  })

  it('holds only well-formed rings inside real coordinate ranges', () => {
    for (const country of WORLD_COUNTRIES) {
      expect(country.rings.length).toBeGreaterThan(0)
      for (const ring of country.rings) {
        expect(ring.length % 2).toBe(0)
        expect(ring.length / 2).toBeGreaterThanOrEqual(3)
        for (let i = 0; i < ring.length; i += 2) {
          expect(Math.abs(ring[i])).toBeLessThanOrEqual(180)
          expect(Math.abs(ring[i + 1])).toBeLessThanOrEqual(90)
        }
      }
    }
  })

  it('never lets a ring wrap the antimeridian, which would streak across the map', () => {
    for (const country of WORLD_COUNTRIES) {
      for (const ring of country.rings) {
        for (let i = 2; i < ring.length; i += 2) {
          expect(Math.abs(ring[i] - ring[i - 2])).toBeLessThanOrEqual(180)
        }
      }
    }
  })
})

describe('ring geometry', () => {
  const square = [0, 0, 10, 0, 10, 10, 0, 10]

  it('measures area and centre of a known square', () => {
    expect(ringArea(square)).toBeCloseTo(100)
    const c = ringCentroid(square)
    expect(c.lon).toBeCloseTo(5)
    expect(c.lat).toBeCloseTo(5)
  })

  it('tests containment', () => {
    expect(pointInRing(5, 5, square)).toBe(true)
    expect(pointInRing(50, 5, square)).toBe(false)
    expect(pointInRing(5, -5, square)).toBe(false)
  })

  it('returns an interior point even for a concave ring whose centroid is outside', () => {
    // A "C" shape: its area centroid falls in the notch, outside the polygon.
    const c = [0, 0, 10, 0, 10, 3, 3, 3, 3, 7, 10, 7, 10, 10, 0, 10]
    const centroid = ringCentroid(c)
    expect(pointInRing(centroid.lat, centroid.lon, c)).toBe(false)
    const rep = representativePoint(c)
    expect(pointInRing(rep.lat, rep.lon, c)).toBe(true)
  })
})

describe('every country gets a usable representative point', () => {
  it('places the centroid inside the country itself', () => {
    // Not all shapes can satisfy this (archipelagos whose largest ring is tiny),
    // but the overwhelming majority must, or plotting lands in the sea.
    const inside = ATLAS.filter((s) =>
      s.rings.some((r) => pointInRing(s.centroid.lat, s.centroid.lon, r.coords)),
    )
    expect(inside.length / ATLAS.length).toBeGreaterThan(0.9)
  })

  it('puts well-known countries where they actually are', () => {
    const cases: Array<[string, number, number]> = [
      ['France', 46.5, 2.5],
      ['Japan', 37, 138],
      ['Brazil', -10, -52],
      ['Australia', -25, 134],
      ['Egypt', 27, 30],
    ]
    for (const [name, lat, lon] of cases) {
      const shape = findCountry(name)!
      expect(shape, name).toBeTruthy()
      expect(Math.abs(shape.centroid.lat - lat), name).toBeLessThan(8)
      expect(Math.abs(shape.centroid.lon - lon), name).toBeLessThan(8)
    }
  })
})

describe('findCountry', () => {
  it('resolves plain names, ISO codes and the aliases real feeds use', () => {
    expect(findCountry('France')?.iso).toBe('FR')
    expect(findCountry('  france ')?.iso).toBe('FR')
    expect(findCountry('FR')?.iso).toBe('FR')
    expect(findCountry('USA')?.iso).toBe('US')
    expect(findCountry('United States')?.iso).toBe('US')
    expect(findCountry('UK')?.iso).toBe('GB')
    expect(findCountry('Türkiye'.replace('ü', 'u'))?.name).toBe('Turkey')
    expect(findCountry('Czech Republic')?.name).toBe('Czechia')
    expect(findCountry('Burma')?.name).toBe('Myanmar')
  })

  it('resolves the abbreviations Natural Earth uses from their spelled-out names', () => {
    expect(findCountry('Bosnia and Herzegovina')?.name).toBe('Bosnia and Herz.')
    expect(findCountry('Democratic Republic of the Congo')?.name).toBe('Dem. Rep. Congo')
    expect(findCountry('South Sudan')?.name).toBe('S. Sudan')
  })

  it('keeps the two Congos and the two Koreas apart', () => {
    expect(findCountry('Congo')?.name).toBe('Congo')
    expect(findCountry('DR Congo')?.name).toBe('Dem. Rep. Congo')
    expect(findCountry('South Korea')?.name).toBe('South Korea')
    expect(findCountry('North Korea')?.name).toBe('North Korea')
  })

  it('returns null rather than guessing', () => {
    expect(findCountry('Atlantis')).toBeNull()
    expect(findCountry('')).toBeNull()
  })
})

describe('countryAt — click a coordinate, get the country', () => {
  it('identifies points inside well-known countries', () => {
    expect(countryAt(48.85, 2.35)?.iso).toBe('FR') // Paris
    expect(countryAt(35.68, 139.69)?.iso).toBe('JP') // Tokyo
    expect(countryAt(-33.87, 151.21)?.iso).toBe('AU') // Sydney
  })

  it('returns null in open ocean instead of snapping to the nearest land', () => {
    expect(countryAt(0, -140)).toBeNull()
    expect(countryAt(-40, -20)).toBeNull()
  })
})
