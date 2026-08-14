import { describe, it, expect } from 'vitest'
import { scoreConfidence, explain, freshnessScore, completenessScore } from './confidence'
import { fuseEvents, type Signal } from './fusion'

/**
 * The two situations a single-number confidence cannot tell apart:
 *
 *   one national agency, measured, four minutes ago
 *   eight outlets, unmeasured, all repeating one wire from yesterday
 *
 * Averaged they land within a point of each other. These tests exist to keep
 * the four dimensions genuinely separable, and to keep the vocabulary honest —
 * a low score must always mean "we cannot support this", never "this is false".
 */
const NOW = Date.parse('2026-08-14T04:00:00.000Z')

function signal(over: Partial<Signal> = {}): Signal {
  return {
    id: `s${Math.random()}`,
    title: 'M5.2 near Somewhere',
    independence: 'usgs',
    sourceKey: 'usgs_quakes_hour',
    sourceUrl: 'https://earthquake.usgs.gov/x',
    admiralty: { source: 'A', info: 2 },
    lat: 40,
    lon: 30,
    observedAt: '2026-08-14T03:56:00.000Z', // four minutes before NOW
    receivedAt: '2026-08-14T03:57:00.000Z',
    magnitude: 5.2,
    ...over,
  }
}

const score = (signals: Signal[]) => scoreConfidence(fuseEvents(signals)[0], NOW)

describe('the four dimensions are genuinely separate', () => {
  it('separates a measured single agency from a syndicated crowd', () => {
    const agency = score([signal()])
    const crowd = score(
      Array.from({ length: 8 }, () =>
        signal({
          independence: 'ap',
          admiralty: { source: 'C', info: 4 },
          magnitude: null,
          observedAt: '2026-08-13T04:00:00.000Z', // a day earlier
        }),
      ),
    )

    expect(agency.reliability).toBeGreaterThan(crowd.reliability)
    expect(agency.freshness).toBeGreaterThan(crowd.freshness)
    expect(agency.completeness).toBeGreaterThan(crowd.completeness)
    // And the crowd is no better corroborated, because it is one origin.
    expect(crowd.corroboration).toBe(agency.corroboration)
  })

  it('rewards a second independent origin more than a hundred more reports', () => {
    // The single most important step in the model.
    const one = score([signal()])
    const twoOrigins = score([signal(), signal({ independence: 'emsc', lat: 40.2 })])
    const manyOneOrigin = score(Array.from({ length: 100 }, () => signal()))

    expect(twoOrigins.corroboration).toBeGreaterThan(one.corroboration)
    expect(manyOneOrigin.corroboration).toBe(one.corroboration)
  })
})

describe('freshnessScore', () => {
  it('decays with age instead of falling off a cliff', () => {
    expect(freshnessScore(5)).toBe(100)
    expect(freshnessScore(120)).toBe(85)
    expect(freshnessScore(600)).toBe(65)
    expect(freshnessScore(20_000)).toBe(10)
  })

  it('refuses a nonsensical age rather than scoring it', () => {
    expect(freshnessScore(-10)).toBe(0)
    expect(freshnessScore(Number.NaN)).toBe(0)
  })
})

describe('completenessScore', () => {
  it('counts only an observed time, never a receipt time', () => {
    // Receipt time is always present; counting it would make the dimension
    // meaningless and would quietly reward events we know least about.
    const withObserved = completenessScore(fuseEvents([signal()])[0])
    const withoutObserved = completenessScore(fuseEvents([signal({ observedAt: null })])[0])
    expect(withObserved).toBeGreaterThan(withoutObserved)
  })

  it('scores an unplaced event lower than a placed one', () => {
    const placed = completenessScore(fuseEvents([signal()])[0])
    const unplaced = completenessScore(fuseEvents([signal({ lat: null, lon: null })])[0])
    expect(placed).toBeGreaterThan(unplaced)
  })
})

describe('grading', () => {
  it('never grades a single source as confirmed, however authoritative', () => {
    // Corroboration is what the word means.
    const single = score([signal()])
    expect(single.reliability).toBe(100)
    expect(single.grade).not.toBe('confirmed')
  })

  it('grades two strong independent agencies as confirmed', () => {
    const both = score([signal(), signal({ independence: 'emsc', lat: 40.2 })])
    expect(both.grade).toBe('confirmed')
  })

  it('caps a contested event below settled, whatever the agreement elsewhere', () => {
    // Sources disagreeing about where something happened means the event is
    // not established, however many of them there are.
    const contested = score([
      signal(),
      signal({ independence: 'emsc', lat: 40.8 }),
      signal({ independence: 'jma', lat: 40.1 }),
    ])
    expect(contested.overall).toBeLessThanOrEqual(60)
    expect(contested.grade).not.toBe('confirmed')
  })
})

describe('the vocabulary never claims a thing is false', () => {
  it('uses only support-flavoured grades', () => {
    const weak = score([
      signal({ admiralty: { source: 'E', info: 5 }, observedAt: null, lat: null, lon: null, magnitude: null, sourceUrl: null }),
    ])
    // Absence of evidence is not evidence of absence, and the grade must not
    // imply otherwise.
    expect(['unconfirmed', 'possible']).toContain(weak.grade)
    expect(explain(weak)).not.toMatch(/false|untrue|unlikely|debunk/i)
  })

  it('lists what is not known rather than omitting it', () => {
    const weak = score([signal({ observedAt: null, lat: null, lon: null })])
    expect(weak.unknowns.join(' ')).toMatch(/when this happened/i)
    expect(weak.unknowns.join(' ')).toMatch(/cannot be placed/i)
    expect(weak.unknowns.join(' ')).toMatch(/not corroborated/i)
  })
})

describe('explain', () => {
  it('shows the arithmetic, not a description of it', () => {
    const breakdown = score([signal(), signal({ independence: 'emsc', lat: 40.2 })])
    const text = explain(breakdown)
    expect(text).toContain(String(breakdown.overall))
    expect(text).toContain('Reliability')
    expect(text).toContain('2 independent sources')
    expect(text).toContain('Admiralty')
  })

  it('names the republication rather than counting it as agreement', () => {
    const breakdown = score([
      signal({ independence: 'ap' }),
      signal({ independence: 'ap' }),
      signal({ independence: 'ap' }),
    ])
    expect(explain(breakdown)).toMatch(/3 reports from 1 origins/)
    expect(explain(breakdown)).toMatch(/republication/)
  })

  it('states a disagreement in the explanation', () => {
    const breakdown = score([signal({ magnitude: 5.0 }), signal({ independence: 'emsc', magnitude: 6.4 })])
    expect(explain(breakdown)).toMatch(/Sources disagree/)
  })
})

describe('determinism', () => {
  it('gives the same answer for the same inputs', () => {
    // A score nobody can reproduce is a score nobody should act on.
    const signals = [signal(), signal({ independence: 'emsc', lat: 40.2 })]
    expect(scoreConfidence(fuseEvents(signals)[0], NOW)).toEqual(
      scoreConfidence(fuseEvents(signals)[0], NOW),
    )
  })
})
