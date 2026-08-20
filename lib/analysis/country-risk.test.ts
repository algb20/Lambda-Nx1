import { describe, expect, it } from 'vitest'
import {
  CATEGORY_BEARING,
  COMPARABLE_MARGIN,
  comparable,
  rankByBand,
  scoreAllCountries,
  scoreCountry,
  type CountrySignal,
} from './country-risk'

const NOW = Date.parse('2026-08-20T12:00:00Z')
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

let seq = 0
const signal = (over: Partial<CountrySignal> = {}): CountrySignal => ({
  category: 'conflict',
  categoryLabel: 'Armed conflict',
  countryIso: 'XX',
  country: 'Testland',
  title: `event ${seq++}`,
  severity: 0.7,
  alertLevel: null,
  observedAt: ago(1),
  at: ago(1),
  sourceKey: 'src_a',
  sourceUrl: 'https://example.org/a',
  independence: 'group_a',
  admiralty: null,
  ...over,
})

/** n signals across n distinct independence groups. */
const spread = (n: number, over: Partial<CountrySignal> = {}) =>
  Array.from({ length: n }, (_, i) =>
    signal({ independence: `group_${i}`, sourceKey: `src_${i}`, ...over }),
  )

describe('what the score is made of', () => {
  it('weighs what a category says about stability, not merely that it happened', () => {
    // The failure that puts seismically active, politically calm countries at
    // the top of every published instability ranking.
    const quake = scoreCountry(spread(6, { category: 'seismic', categoryLabel: 'Earthquake' }), 'XX', NOW)
    const conflict = scoreCountry(spread(6, { category: 'conflict' }), 'XX', NOW)
    expect(conflict.signal).toBeGreaterThan(quake.signal * 3)
    expect(CATEGORY_BEARING.seismic).toBeLessThan(CATEGORY_BEARING.conflict)
  })

  it('says which categories produced the number, with the strongest report named', () => {
    const risk = scoreCountry(
      [
        signal({ category: 'conflict', title: 'Border clash reported', severity: 0.9 }),
        signal({ category: 'conflict', title: 'Minor incident', severity: 0.2 }),
        signal({ category: 'health', categoryLabel: 'Health emergency', severity: 0.5 }),
      ],
      'XX',
      NOW,
    )
    const conflict = risk.components.find((c) => c.category === 'conflict')!
    expect(conflict.count).toBe(2)
    expect(conflict.strongest?.title).toBe('Border clash reported')
    expect(conflict.strongest?.sourceUrl).toBe('https://example.org/a')
    // Ordered by contribution, so the reader sees what drove it first.
    expect(risk.components[0].category).toBe('conflict')
  })

  it('lets age lower a contribution and never raise one', () => {
    const fresh = scoreCountry(spread(5, { observedAt: ago(1), at: ago(1) }), 'XX', NOW)
    const old = scoreCountry(spread(5, { observedAt: ago(240), at: ago(240) }), 'XX', NOW)
    expect(fresh.signal).toBeGreaterThan(old.signal)
  })

  /**
   * Dating an event from our receipt is how late detection in a thin region
   * comes to look like a fast-moving situation — the exact bias this module
   * exists to expose rather than commit.
   */
  it('ages an event from when it happened, not from when it reached us', () => {
    const late = spread(5, { observedAt: ago(200), at: ago(1) })
    const now = spread(5, { observedAt: ago(1), at: ago(1) })
    expect(scoreCountry(late, 'XX', NOW).signal).toBeLessThan(scoreCountry(now, 'XX', NOW).signal)
  })

  it('counts an ungraded report at a floor rather than inventing a severity', () => {
    const ungraded = scoreCountry(spread(5, { severity: 0 }), 'XX', NOW)
    const severe = scoreCountry(spread(5, { severity: 1 }), 'XX', NOW)
    expect(ungraded.signal).toBeGreaterThan(0)
    expect(ungraded.signal).toBeLessThan(severe.signal)
    expect(ungraded.components[0].measured).toBe(0)
  })

  it('stays inside 0–100 however much is thrown at it', () => {
    const flood = scoreCountry(spread(400, { severity: 1, category: 'conflict' }), 'XX', NOW)
    expect(flood.signal).toBeLessThanOrEqual(100)
    expect(flood.signal).toBeGreaterThanOrEqual(0)
  })
})

describe('observability — the number the field does not publish', () => {
  /**
   * The whole argument. An index built from reported events measures reporting,
   * and a country covered by one wire desk is being seen through one keyhole
   * however much volume comes through it.
   */
  it('counts independent origins, not the volume one origin produces', () => {
    const oneLoudOrigin = scoreCountry(
      Array.from({ length: 40 }, () => signal({ independence: 'group_a', sourceKey: 'src_a' })),
      'XX',
      NOW,
    )
    const fourQuietOrigins = scoreCountry(spread(4), 'XX', NOW)
    expect(oneLoudOrigin.origins).toBe(1)
    expect(fourQuietOrigins.origins).toBe(4)
    expect(fourQuietOrigins.observability).toBeGreaterThan(oneLoudOrigin.observability)
  })

  it('treats a source with no independence group as its own origin, never as a shared one', () => {
    const risk = scoreCountry(
      [
        signal({ independence: null, sourceKey: 'src_a' }),
        signal({ independence: null, sourceKey: 'src_b' }),
      ],
      'XX',
      NOW,
    )
    // Two ungrouped sources are two keyholes, not one — the opposite default
    // would silently merge unrelated feeds into a single false origin.
    expect(risk.origins).toBe(2)
  })
})

describe('refusing a comparison the evidence cannot support', () => {
  it('will not rank two countries whose coverage differs too far', () => {
    const seen = scoreCountry(spread(8), 'XX', NOW)
    const unseen = scoreCountry([signal({ countryIso: 'YY', country: 'Thinland' })], 'YY', NOW)
    expect(seen.observability - unseen.observability).toBeGreaterThan(COMPARABLE_MARGIN)
    expect(comparable(seen, unseen)).toBe(false)
  })

  it('does rank two countries seen about equally well', () => {
    const a = scoreCountry(spread(5), 'XX', NOW)
    const b = scoreCountry(spread(5, { countryIso: 'YY', country: 'Otherland' }), 'YY', NOW)
    expect(comparable(a, b)).toBe(true)
  })

  /**
   * One flat list *is* the claim that every row is comparable to every other.
   * Bands are the refusal to make that claim.
   */
  it('returns bands rather than one list, each saying how well it is seen', () => {
    const risks = [
      scoreCountry(spread(10), 'XX', NOW),
      scoreCountry([signal({ countryIso: 'YY', country: 'Thinland' })], 'YY', NOW),
    ]
    const bands = rankByBand(risks)
    expect(bands.map((b) => b.label)).toEqual([
      'Densely observed',
      'Moderately observed',
      'Thinly observed',
    ])
    expect(bands.every((b) => b.note.length > 20)).toBe(true)
    // Every country lands in exactly one band.
    expect(bands.reduce((n, b) => n + b.countries.length, 0)).toBe(2)
    expect(bands[0].countries[0].iso).toBe('XX')
    expect(bands[2].countries[0].iso).toBe('YY')
  })

  it('sorts within a band by signal, since inside a band that is honest', () => {
    const busy = scoreCountry(spread(6, { severity: 1 }), 'XX', NOW)
    const calm = scoreCountry(spread(6, { countryIso: 'YY', country: 'Calmland', severity: 0.1 }), 'YY', NOW)
    const band = rankByBand([calm, busy]).find((b) => b.countries.length === 2)!
    expect(band.countries[0].iso).toBe('XX')
  })
})

describe('saying what the score cannot see', () => {
  /** There is no country for which a public-source feed sees everything. */
  it('never returns an empty blind-spot list', () => {
    for (const risk of [
      scoreCountry(spread(20), 'XX', NOW),
      scoreCountry([], 'ZZ', NOW),
      scoreCountry([signal()], 'XX', NOW),
    ]) {
      expect(risk.blindSpots.length).toBeGreaterThan(0)
    }
  })

  /**
   * "Quiet" and "unobserved" are opposite conclusions drawn from identical
   * data, and a reader given only a number cannot tell them apart.
   */
  it('says plainly that silence is not calm when nothing was reported', () => {
    const risk = scoreCountry([], 'ZZ', NOW)
    expect(risk.blindSpots[0]).toContain('unobserved')
    expect(risk.blindSpots[0]).toContain('never as "calm"')
    expect(risk.signal).toBe(0)
    expect(risk.observability).toBe(0)
  })

  it('warns when a country rests on too few origins to read', () => {
    const risk = scoreCountry([signal(), signal()], 'XX', NOW)
    expect(risk.blindSpots.join(' ')).toContain('independent origin')
    expect(risk.summary).toContain('Too thinly observed')
  })

  it('names how many reports carried no measurement', () => {
    const risk = scoreCountry([...spread(3, { severity: 0 }), ...spread(2, { severity: 0.8 })], 'XX', NOW)
    expect(risk.blindSpots.join(' ')).toContain('3 of 5 reports carried no measurement')
  })

  it('names how many reports published no time of occurrence', () => {
    const risk = scoreCountry(spread(4, { observedAt: null }), 'XX', NOW)
    expect(risk.blindSpots.join(' ')).toContain('4 reports published no time')
  })

  it('always states the standing limit of passive public collection', () => {
    const risk = scoreCountry(spread(9), 'XX', NOW)
    expect(risk.blindSpots.join(' ')).toContain('absence is not evidence')
  })
})

describe('scoring the whole feed', () => {
  it('scores each country that appears, and none that does not', () => {
    const risks = scoreAllCountries(
      [signal({ countryIso: 'AA' }), signal({ countryIso: 'BB' }), signal({ countryIso: null })],
      NOW,
    )
    expect(risks.map((r) => r.iso).sort()).toEqual(['AA', 'BB'])
  })

  /**
   * A zero would enter the ranking and be read as "calm" — the exact confusion
   * the whole module exists to prevent.
   */
  it('leaves a country with no signals out rather than scoring it zero', () => {
    expect(scoreAllCountries([signal({ countryIso: 'AA' })], NOW)).toHaveLength(1)
  })

  it('carries the country name through from whatever row had one', () => {
    const risks = scoreAllCountries(
      [signal({ countryIso: 'AA', country: null }), signal({ countryIso: 'AA', country: 'Aaland' })],
      NOW,
    )
    expect(risks[0].country).toBe('Aaland')
  })
})
