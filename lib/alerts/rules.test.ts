import { describe, expect, it } from 'vitest'
import {
  MAX_BRANCH,
  MAX_DEPTH,
  RuleError,
  describeCondition,
  evaluate,
  haversineKm,
  matchRules,
  validateCondition,
  type AlertRule,
  type AlertSubject,
  type Condition,
} from './rules'

const NOW = Date.parse('2026-08-14T12:00:00.000Z')

function subject(over: Partial<AlertSubject> = {}): AlertSubject {
  return {
    id: 'e1',
    title: 'Magnitude 7.4 earthquake strikes off Tohoku coast',
    category: 'seismic',
    country: 'Japan',
    lat: 38.3,
    lon: 142.4,
    magnitude: 7.4,
    severity: 0.98,
    independentOrigins: 3,
    grade: 'confirmed',
    sourceRating: 'A',
    sources: ['usgs_quakes', 'jma_quakes', 'gdelt'],
    contested: false,
    observedAt: '2026-08-14T11:30:00.000Z',
    receivedAt: '2026-08-14T11:35:00.000Z',
    ...over,
  }
}

describe('validating a rule', () => {
  it('accepts a well-formed condition', () => {
    expect(() =>
      validateCondition({
        all: [
          { field: 'category', op: 'eq', value: 'seismic' },
          { field: 'magnitude', op: 'gte', value: 6.5 },
        ],
      }),
    ).not.toThrow()
  })

  it('refuses an unknown field instead of silently never matching', () => {
    expect(() =>
      validateCondition({ field: 'password' as never, op: 'eq', value: 'x' }),
    ).toThrow(RuleError)
  })

  it('refuses an operator the field cannot support, and says which it can', () => {
    // `magnitude contains "7"` would validate under a looser design and then
    // never fire — a rule that looks armed and is not.
    try {
      validateCondition({ field: 'magnitude', op: 'contains', value: '7' })
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as RuleError).message).toMatch(/does not support "contains"/)
      expect((err as RuleError).message).toMatch(/gte/)
    }
  })

  it('points at where in the tree the problem is', () => {
    try {
      validateCondition({
        all: [
          { field: 'category', op: 'eq', value: 'seismic' },
          { any: [{ field: 'magnitude', op: 'contains', value: 'x' }] },
        ],
      })
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as RuleError).path).toBe('all[1].any[0]')
    }
  })

  it('refuses an empty branch, which would otherwise match everything or nothing', () => {
    expect(() => validateCondition({ all: [] })).toThrow(/at least one/)
    expect(() => validateCondition({ any: [] })).toThrow(/at least one/)
  })

  it('refuses a tree nested past the limit', () => {
    let deep: Condition = { field: 'category', op: 'eq', value: 'seismic' }
    for (let i = 0; i <= MAX_DEPTH + 1; i++) deep = { not: deep }
    expect(() => validateCondition(deep)).toThrow(/nested deeper/)
  })

  it('refuses a branch with an absurd number of arms', () => {
    const arms = Array.from({ length: MAX_BRANCH + 1 }, () => ({
      field: 'category' as const,
      op: 'eq' as const,
      value: 'seismic',
    }))
    expect(() => validateCondition({ any: arms })).toThrow(/at most/)
  })

  it('refuses a geo value that is not a point and a radius', () => {
    expect(() =>
      validateCondition({ field: 'location', op: 'withinKm', value: { lat: 1, lon: 2 } as never }),
    ).toThrow(/lat, lon, km/)
    expect(() =>
      validateCondition({ field: 'location', op: 'withinKm', value: { lat: 1, lon: 2, km: 0 } }),
    ).toThrow(/positive radius/)
    expect(() =>
      validateCondition({ field: 'location', op: 'withinKm', value: { lat: 200, lon: 2, km: 5 } }),
    ).toThrow()
  })

  it('refuses a non-numeric threshold', () => {
    expect(() => validateCondition({ field: 'magnitude', op: 'gte', value: '6.5' })).toThrow(
      /finite number/,
    )
  })

  it('refuses an empty "in" list', () => {
    expect(() => validateCondition({ field: 'category', op: 'in', value: [] })).toThrow(
      /non-empty/,
    )
  })
})

describe('evaluating a rule', () => {
  it('matches a straightforward threshold', () => {
    expect(evaluate({ field: 'magnitude', op: 'gte', value: 6.5 }, subject(), NOW)).toBe(true)
    expect(evaluate({ field: 'magnitude', op: 'gte', value: 8 }, subject(), NOW)).toBe(false)
  })

  it('asks about the evidence, not only about the world', () => {
    // The condition no threshold-based alerting tool can express.
    const corroborated: Condition = { field: 'independentOrigins', op: 'gte', value: 3 }
    expect(evaluate(corroborated, subject(), NOW)).toBe(true)
    expect(evaluate(corroborated, subject({ independentOrigins: 1 }), NOW)).toBe(false)
  })

  it('can watch for disagreement between sources', () => {
    const contested: Condition = { field: 'contested', op: 'eq', value: true }
    expect(evaluate(contested, subject({ contested: true }), NOW)).toBe(true)
    expect(evaluate(contested, subject(), NOW)).toBe(false)
  })

  it('compares strings without caring about case', () => {
    expect(evaluate({ field: 'country', op: 'eq', value: 'japan' }, subject(), NOW)).toBe(true)
  })

  it('matches a named source among several', () => {
    expect(evaluate({ field: 'sources', op: 'contains', value: 'jma_quakes' }, subject(), NOW)).toBe(
      true,
    )
    expect(evaluate({ field: 'sources', op: 'contains', value: 'nobody' }, subject(), NOW)).toBe(
      false,
    )
    expect(
      evaluate({ field: 'sources', op: 'in', value: ['nobody', 'gdelt'] }, subject(), NOW),
    ).toBe(true)
  })

  it('fires inside a radius and not outside it', () => {
    const nearTohoku: Condition = {
      field: 'location',
      op: 'withinKm',
      value: { lat: 38.0, lon: 142.0, km: 100 },
    }
    expect(evaluate(nearTohoku, subject(), NOW)).toBe(true)
    expect(evaluate(nearTohoku, subject({ lat: -33.9, lon: 151.2 }), NOW)).toBe(false)
  })

  it('does not place a subject with no coordinate inside any radius', () => {
    const anywhere: Condition = {
      field: 'location',
      op: 'withinKm',
      value: { lat: 0, lon: 0, km: 20_000 },
    }
    expect(evaluate(anywhere, subject({ lat: null, lon: null }), NOW)).toBe(false)
  })

  it('reads recency from the source-stated time', () => {
    expect(
      evaluate({ field: 'observedAt', op: 'newerThanMinutes', value: 60 }, subject(), NOW),
    ).toBe(true)
    expect(
      evaluate({ field: 'observedAt', op: 'newerThanMinutes', value: 10 }, subject(), NOW),
    ).toBe(false)
  })

  it('treats an undated subject as not recent, rather than as brand new', () => {
    // The alternative would page someone about an event of unknown age.
    expect(
      evaluate({ field: 'observedAt', op: 'newerThanMinutes', value: 60 }, subject({ observedAt: null }), NOW),
    ).toBe(false)
  })

  it('never fires on a value it could not read', () => {
    expect(
      evaluate({ field: 'magnitude', op: 'lt', value: 100 }, subject({ magnitude: null }), NOW),
    ).toBe(false)
  })

  it('lets a negation be true of an unknown, which is the correct reading', () => {
    // "Tell me when it is not about Japan" is satisfied by something whose
    // country nobody stated: an unknown place is not Japan.
    const notJapan: Condition = { not: { field: 'country', op: 'eq', value: 'Japan' } }
    expect(evaluate(notJapan, subject({ country: null }), NOW)).toBe(true)
    expect(evaluate(notJapan, subject(), NOW)).toBe(false)
  })

  it('combines conditions the way the tree says', () => {
    const rule: Condition = {
      all: [
        { field: 'category', op: 'in', value: ['seismic', 'volcano'] },
        { any: [{ field: 'magnitude', op: 'gte', value: 7 }, { field: 'severity', op: 'gte', value: 0.9 }] },
        { not: { field: 'grade', op: 'eq', value: 'unverified' } },
      ],
    }
    expect(evaluate(rule, subject(), NOW)).toBe(true)
    expect(evaluate(rule, subject({ magnitude: 4, severity: 0.2 }), NOW)).toBe(false)
    expect(evaluate(rule, subject({ grade: 'unverified' }), NOW)).toBe(false)
  })
})

describe('describing a rule', () => {
  it('says what fired, so the alert does not have to be looked up', () => {
    const text = describeCondition({
      all: [
        { field: 'category', op: 'eq', value: 'seismic' },
        { field: 'independentOrigins', op: 'gte', value: 2 },
        { field: 'location', op: 'withinKm', value: { lat: 35.7, lon: 139.7, km: 300 } },
      ],
    })
    expect(text).toBe(
      'category is seismic and independentOrigins is at least 2 and location is within 300 km of 35.7, 139.7',
    )
  })

  it('reads an "any" branch as a choice', () => {
    expect(
      describeCondition({ any: [{ field: 'grade', op: 'eq', value: 'confirmed' }, { field: 'contested', op: 'eq', value: true }] }),
    ).toBe('(grade is confirmed or contested is true)')
  })
})

describe('running the rules', () => {
  const rules: AlertRule[] = [
    {
      id: 'r1',
      name: 'Large corroborated quakes',
      enabled: true,
      condition: {
        all: [
          { field: 'category', op: 'eq', value: 'seismic' },
          { field: 'magnitude', op: 'gte', value: 6.5 },
          { field: 'independentOrigins', op: 'gte', value: 2 },
        ],
      },
    },
    {
      id: 'r2',
      name: 'Paused rule',
      enabled: false,
      condition: { field: 'category', op: 'eq', value: 'seismic' },
    },
  ]

  it('returns each match with the rule that caught it, in words', () => {
    const hits = matchRules(rules, [subject(), subject({ id: 'e2', magnitude: 3 })], NOW)
    expect(hits).toHaveLength(1)
    expect(hits[0].rule.id).toBe('r1')
    expect(hits[0].subject.id).toBe('e1')
    expect(hits[0].because).toMatch(/independentOrigins is at least 2/)
  })

  it('does not run a paused rule', () => {
    expect(matchRules([rules[1]], [subject()], NOW)).toEqual([])
  })
})

describe('distance', () => {
  it('measures a known separation to within a kilometre', () => {
    // Tokyo to Osaka, ~400 km by great circle.
    const d = haversineKm(35.6895, 139.6917, 34.6937, 135.5023)
    expect(d).toBeGreaterThan(390)
    expect(d).toBeLessThan(410)
  })

  it('is zero for a point against itself', () => {
    expect(haversineKm(10, 20, 10, 20)).toBe(0)
  })
})
