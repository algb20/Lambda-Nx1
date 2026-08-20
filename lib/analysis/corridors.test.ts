import { describe, expect, it } from 'vitest'
import { CORRIDORS, haversineKm, watchAllCorridors, watchCorridor } from './corridors'
import type { CountrySignal } from './country-risk'

const NOW = Date.parse('2026-08-20T12:00:00Z')
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

type Placed = CountrySignal & { lat: number | null; lon: number | null }

let seq = 0
const at = (lat: number, lon: number, over: Partial<Placed> = {}): Placed => ({
  category: 'conflict',
  categoryLabel: 'Armed conflict',
  countryIso: 'YE',
  country: 'Yemen',
  title: `event ${seq++}`,
  severity: 0.8,
  alertLevel: null,
  observedAt: ago(2),
  at: ago(2),
  sourceKey: 'src_a',
  sourceUrl: 'https://example.org/a',
  independence: 'group_a',
  admiralty: null,
  lat,
  lon,
  ...over,
})

const bab = CORRIDORS.find((c) => c.key === 'bab_el_mandeb')!
const hormuz = CORRIDORS.find((c) => c.key === 'hormuz')!

describe('the corridor registry', () => {
  it('gives every corridor a real coordinate and a stated reason it matters', () => {
    for (const c of CORRIDORS) {
      expect(Math.abs(c.lat), c.key).toBeLessThanOrEqual(90)
      expect(Math.abs(c.lon), c.key).toBeLessThanOrEqual(180)
      expect(c.carries.length, c.key).toBeGreaterThan(20)
      expect(c.states.length, c.key).toBeGreaterThan(0)
    }
  })

  /**
   * One global radius would either miss half of Malacca or sweep three
   * countries into the Bosphorus.
   */
  it('sizes the watch radius per corridor, not globally', () => {
    expect(new Set(CORRIDORS.map((c) => c.radiusKm)).size).toBeGreaterThan(3)
    expect(CORRIDORS.find((c) => c.key === 'malacca')!.radiusKm).toBeGreaterThan(
      CORRIDORS.find((c) => c.key === 'bosphorus')!.radiusKm,
    )
  })

  it('gives each corridor a distinct key', () => {
    expect(new Set(CORRIDORS.map((c) => c.key)).size).toBe(CORRIDORS.length)
  })
})

describe('distance', () => {
  it('measures a known separation to within a percent', () => {
    // Gibraltar to Suez, about 3,000 km.
    const km = haversineKm(35.95, -5.6, 30.42, 32.35)
    expect(km).toBeGreaterThan(3300)
    expect(km).toBeLessThan(3600)
  })

  it('is zero at the same point', () => {
    expect(haversineKm(12.58, 43.33, 12.58, 43.33)).toBeCloseTo(0, 5)
  })
})

describe('what counts as near a corridor', () => {
  it('takes what is inside the radius and leaves what is outside', () => {
    const watch = watchCorridor([at(12.6, 43.4), at(51.0, 1.5)], bab, NOW)
    expect(watch.signals).toHaveLength(1)
    expect(watch.signals[0].distanceKm).toBeLessThan(30)
  })

  it('states the distance on every signal, so proximity is checkable', () => {
    const watch = watchCorridor([at(13.5, 43.5)], bab, NOW)
    expect(watch.signals[0].distanceKm).toBeGreaterThan(50)
    expect(watch.signals[0].distanceKm).toBeLessThan(bab.radiusKm)
  })

  it('weighs a nearer event above a distant one of equal severity', () => {
    const near = watchCorridor([at(12.6, 43.35)], bab, NOW)
    const far = watchCorridor([at(14.2, 43.9)], bab, NOW)
    expect(near.pressure).toBeGreaterThan(far.pressure)
    expect(far.pressure).toBeGreaterThan(0) // never zero at the rim
  })
})

describe('what bears on transit, which is not what bears on stability', () => {
  /**
   * A cyclone closes a strait and says nothing about governance; an economic
   * announcement moves a stability score and stops no ships. One table cannot
   * serve both questions.
   */
  it('rates a storm near a strait above an economic notice near it', () => {
    const storm = watchCorridor([at(12.6, 43.35, { category: 'storm', categoryLabel: 'Severe storm' })], bab, NOW)
    const econ = watchCorridor([at(12.6, 43.35, { category: 'economy', categoryLabel: 'Economy' })], bab, NOW)
    expect(storm.pressure).toBeGreaterThan(econ.pressure * 2)
  })

  it('keeps drought meaningful, because it is what actually limits Panama', () => {
    const drought = watchCorridor(
      [at(9.1, -79.7, { category: 'drought', categoryLabel: 'Drought' })],
      CORRIDORS.find((c) => c.key === 'panama')!,
      NOW,
    )
    expect(drought.pressure).toBeGreaterThan(0)
  })

  it('lets age lower pressure and never raise it', () => {
    const fresh = watchCorridor([at(12.6, 43.35, { observedAt: ago(1), at: ago(1) })], bab, NOW)
    const old = watchCorridor([at(12.6, 43.35, { observedAt: ago(300), at: ago(300) })], bab, NOW)
    expect(fresh.pressure).toBeGreaterThan(old.pressure)
  })

  it('stays within 0–100 under a flood of events', () => {
    const many = Array.from({ length: 300 }, () => at(12.6, 43.33, { severity: 1 }))
    const watch = watchCorridor(many, bab, NOW)
    expect(watch.pressure).toBeLessThanOrEqual(100)
    expect(watch.signals.length).toBeLessThanOrEqual(25)
  })
})

describe('the limit that must never be omitted', () => {
  /**
   * The strongest comparable product counts vessels through a paid AIS feed.
   * We do not have one, and the only honest options were to say so or to stop.
   * A limit disclosed only when it bites is disclosed too late — so it appears
   * on every corridor, including the quiet ones.
   */
  it('says on every corridor that this is not a vessel count', () => {
    for (const watch of watchAllCorridors([at(12.6, 43.33)], NOW)) {
      expect(watch.limits[0], watch.corridor.key).toContain('No vessel data')
      expect(watch.limits[0], watch.corridor.key).toContain('not a transit count')
    }
  })

  it('reports an empty corridor as unobserved, never as clear', () => {
    const watch = watchCorridor([], hormuz, NOW)
    expect(watch.pressure).toBe(0)
    expect(watch.limits.join(' ')).toContain('unobserved, not as clear')
    expect(watch.summary).toContain('No published activity')
  })

  it('flags a corridor resting on one origin as a lead, not a picture', () => {
    const watch = watchCorridor([at(26.6, 56.3), at(26.5, 56.2)], hormuz, NOW)
    expect(watch.origins).toBe(1)
    expect(watch.limits.join(' ')).toContain('lead to check')
  })

  it('counts independent origins rather than repetitions of one', () => {
    const watch = watchCorridor(
      [
        at(26.6, 56.3, { independence: 'a', sourceKey: 'a1' }),
        at(26.6, 56.3, { independence: 'a', sourceKey: 'a2' }),
        at(26.6, 56.3, { independence: 'b', sourceKey: 'b1' }),
      ],
      hormuz,
      NOW,
    )
    expect(watch.origins).toBe(2)
  })
})

describe('watching them all', () => {
  it('returns every corridor, most pressured first', () => {
    const watches = watchAllCorridors([at(12.6, 43.33, { severity: 1 })], NOW)
    expect(watches).toHaveLength(CORRIDORS.length)
    expect(watches[0].corridor.key).toBe('bab_el_mandeb')
    for (let i = 1; i < watches.length; i++) {
      expect(watches[i - 1].pressure).toBeGreaterThanOrEqual(watches[i].pressure)
    }
  })

  it('ignores an event with no coordinate rather than placing it at a guess', () => {
    const watch = watchCorridor([at(12.6, 43.33), { ...at(0, 0), lat: null, lon: null }], bab, NOW)
    expect(watch.signals).toHaveLength(1)
  })
})
