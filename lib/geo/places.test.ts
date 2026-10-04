import { describe, expect, it } from 'vitest'
import {
  chooseLabels,
  haversineKm,
  LABEL_BUDGET,
  LABEL_SEPARATION_PX,
  nearestPlace,
  PLACES,
  type Place,
} from './places'

/**
 * The reference layer, and the rule that decides what it shows.
 *
 * Every layer the map had was a view of the event set, so nothing on the canvas
 * said where anything *is*. These hold the new one to the property that makes it
 * worth having: even coverage chosen in pixels, not a population threshold that
 * empties one continent and floods another.
 */

const at = (place: Place, x: number, y: number) => ({ x, y, item: place })
const fake = (name: string, opts: Partial<Place> = {}): Place => ({
  name,
  lat: 0,
  lon: 0,
  countryIso: 'XX',
  population: 0,
  isCapital: false,
  ...opts,
})

describe('the data that ships', () => {
  it('covers the world rather than one region', () => {
    expect(PLACES.length).toBeGreaterThan(1000)
    const countries = new Set(PLACES.map((p) => p.countryIso).filter(Boolean))
    expect(countries.size).toBeGreaterThan(200)
  })

  it('leads with national capitals, because the order is the selection rule', () => {
    const firstNonCapital = PLACES.findIndex((p) => !p.isCapital)
    expect(firstNonCapital).toBeGreaterThan(150)
    // Nothing after the capitals may be a capital: a single sort, not a shuffle.
    expect(PLACES.slice(firstNonCapital).some((p) => p.isCapital)).toBe(false)
  })

  it('orders the rest by population, descending', () => {
    const rest = PLACES.filter((p) => !p.isCapital)
    for (let i = 1; i < rest.length; i += 1) {
      expect(rest[i].population).toBeLessThanOrEqual(rest[i - 1].population)
    }
  })

  it('carries coordinates that are real and on Earth', () => {
    for (const p of PLACES) {
      expect(Number.isFinite(p.lat) && Number.isFinite(p.lon)).toBe(true)
      expect(Math.abs(p.lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(p.lon)).toBeLessThanOrEqual(180)
    }
  })

  /** Null Island again: a place at exactly 0,0 is a missing coordinate. */
  it('holds nothing at 0,0', () => {
    expect(PLACES.filter((p) => p.lat === 0 && p.lon === 0)).toEqual([])
  })

  it('names every place', () => {
    expect(PLACES.filter((p) => !p.name.trim())).toEqual([])
  })
})

describe('choosing which labels to draw', () => {
  it('draws nothing at all when the budget is zero', () => {
    const pts = PLACES.slice(0, 20).map((p, i) => at(p, i * 200, 0))
    expect(chooseLabels(pts, { budget: 0 })).toEqual([])
  })

  /**
   * `minimal` means minimal. A reader who asked for the least possible chrome
   * did not ask for a thousand city names.
   */
  it('gives the minimal density no labels, and each level more than the last', () => {
    expect(LABEL_BUDGET.minimal).toBe(0)
    expect(LABEL_BUDGET.balanced).toBeGreaterThan(0)
    expect(LABEL_BUDGET.intelligence).toBeGreaterThan(LABEL_BUDGET.balanced)
    expect(LABEL_BUDGET.extreme).toBeGreaterThan(LABEL_BUDGET.intelligence)
  })

  it('never exceeds the budget it was given', () => {
    const pts = PLACES.slice(0, 400).map((p, i) => at(p, (i % 40) * 300, Math.floor(i / 40) * 300))
    expect(chooseLabels(pts, { budget: 12 })).toHaveLength(12)
  })

  /**
   * The whole point of clustering rather than thresholding: two anchors closer
   * than a word's width are one label, and the more important one wins.
   */
  it('collapses overlapping places into the more important one', () => {
    const big = fake('Capital', { isCapital: true, population: 9_000_000 })
    const small = fake('Suburb', { population: 4000 })
    const picked = chooseLabels(
      [at(big, 100, 100), at(small, 108, 104)],
      { budget: 10 },
    )
    expect(picked).toHaveLength(1)
    expect(picked[0].place.name).toBe('Capital')
    expect(picked[0].represents).toBe(2)
  })

  it('keeps places that are far enough apart to read', () => {
    const a = fake('A')
    const b = fake('B')
    const picked = chooseLabels(
      [at(a, 0, 0), at(b, LABEL_SEPARATION_PX * 3, 0)],
      { budget: 10 },
    )
    expect(picked.map((p) => p.place.name)).toEqual(['A', 'B'])
  })

  /**
   * The failure a population threshold produces, stated as a test: a sparse
   * region must keep its small city, and a crowded one must not drown.
   *
   * Twelve European places packed into one corner and one African place alone:
   * a global population cut-off keeps the twelve and drops the one. Spatial
   * selection keeps the one, which is the label that carries information.
   */
  it('keeps a small isolated place while collapsing a dense cluster', () => {
    const dense = Array.from({ length: 12 }, (_, i) =>
      at(fake(`Dense${i}`, { population: 5_000_000 - i }), 100 + i * 4, 100 + i * 3),
    )
    const lonely = at(fake('Lonely', { population: 40_000 }), 900, 600)
    const picked = chooseLabels([...dense, lonely], { budget: 10 })
    const names = picked.map((p) => p.place.name)
    expect(names).toContain('Lonely')
    expect(names.filter((n) => n.startsWith('Dense')).length).toBeLessThan(4)
  })

  it('is deterministic, so a label does not jitter while the globe spins', () => {
    const pts = PLACES.slice(0, 200).map((p, i) => at(p, (i * 37) % 900, (i * 53) % 600))
    const a = chooseLabels(pts, { budget: 25 }).map((p) => p.place.name)
    const b = chooseLabels(pts, { budget: 25 }).map((p) => p.place.name)
    expect(a).toEqual(b)
  })

  it('handles an empty screen without throwing', () => {
    expect(chooseLabels([], { budget: 40 })).toEqual([])
  })
})

describe('naming a coordinate in text', () => {
  it('finds the city an event actually happened near', () => {
    // Tokyo, to three decimals, is 35.687 / 139.749 in the shipped data.
    expect(nearestPlace(35.69, 139.75)?.name).toBe('Tokyo')
    expect(nearestPlace(48.86, 2.35)?.name).toBe('Paris')
  })

  it('says nothing rather than guessing, out in the ocean', () => {
    // Point Nemo, the most remote place on Earth.
    expect(nearestPlace(-48.87, -123.39)).toBeNull()
  })

  it('refuses a coordinate that is not one', () => {
    expect(nearestPlace(Number.NaN, 10)).toBeNull()
    expect(nearestPlace(10, Number.POSITIVE_INFINITY)).toBeNull()
  })

  /**
   * Measured on the sphere, not in raw degrees. A degree of longitude is 111 km
   * at the equator and 19 km at Reykjavík, and the naive version names the wrong
   * city for everything near the poles.
   */
  it('measures distance on the sphere', () => {
    const equator = haversineKm(0, 0, 0, 1)
    const arctic = haversineKm(80, 0, 80, 1)
    expect(equator).toBeGreaterThan(110)
    expect(equator).toBeLessThan(112)
    expect(arctic).toBeLessThan(20)
  })

  it('is zero for a point against itself', () => {
    expect(haversineKm(51.5, -0.12, 51.5, -0.12)).toBe(0)
  })
})
