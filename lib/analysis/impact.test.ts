import { describe, expect, it } from 'vitest'
import { assessImpact, corroborationBySubject } from './impact'

const NOW = Date.parse('2026-08-20T12:00:00Z')
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString()

const base = { at: ago(1), now: NOW }

describe('what makes a statement consequential', () => {
  /**
   * The ordering this whole gateway exists to produce. Measured against real
   * feeds: a sanctions designation and a presidential instrument must outrank a
   * director-general's visit, or the board is a chronological list wearing an
   * analysis label.
   */
  it('puts an act with force above a ceremonial appearance', () => {
    const sanctions = assessImpact({
      ...base,
      sourceKey: 'un_press',
      headline: 'Security Council Sanctions Committee Amends 21 Entries on Its Sanctions List',
    })
    const visit = assessImpact({
      ...base,
      sourceKey: 'who_news',
      headline: 'WHO Director-General visits Jordan to recognize collaboration on health',
    })
    expect(sanctions.score).toBeGreaterThan(visit.score + 30)
    // Low, not necessarily zero: an hour-old ceremonial item keeps the little
    // its issuing body lends it. The live WHO example scored 0 because it was
    // also months stale — two separate reasons, and asserting the combined
    // number would have tested the clock rather than the judgement.
    expect(visit.score).toBeLessThan(12)
  })

  it('names every factor that fired, with what it contributed', () => {
    const result = assessImpact({
      ...base,
      sourceKey: 'whitehouse',
      headline: 'Executive Order Adjusting Imports of Unmanned Aircraft Systems',
      corroboratingBodies: 3,
    })
    const labels = result.factors.map((f) => f.label)
    expect(labels).toContain('Issued by the White House')
    expect(labels).toContain('Executive instrument')
    expect(labels).toContain('3 independent institutions addressing it')
    // The score is never the whole story — every contribution is inspectable.
    expect(result.factors.reduce((n, f) => n + f.weight, 0)).toBeGreaterThan(0)
  })

  it('gives a sentence a reader can act on, not a bare number', () => {
    const result = assessImpact({
      ...base,
      sourceKey: 'fed_press',
      headline: 'FOMC statement on the target range for the federal funds rate',
    })
    expect(result.summary.length).toBeGreaterThan(30)
    expect(result.summary).not.toMatch(/^\d+$/)
  })

  /**
   * The first match wins by design, so a compound headline scores as the most
   * consequential thing it contains rather than the first word that matched.
   */
  it('scores a compound headline as its strongest instrument', () => {
    const result = assessImpact({
      ...base,
      sourceKey: 'ec_press',
      headline: 'Report on the review of the new sanctions package',
    })
    expect(result.factors.map((f) => f.label)).toContain('Sanctions or designations')
  })

  it('weighs who is speaking, not only what was said', () => {
    const headline = 'Joint statement on regional cooperation'
    const fed = assessImpact({ ...base, sourceKey: 'fed_press', headline })
    const unknown = assessImpact({ ...base, sourceKey: 'some_blog', headline })
    expect(fed.score).toBeGreaterThan(unknown.score)
  })

  /**
   * Decay only. If recency lifted, every routine notice published this hour
   * would outrank a sanctions package from yesterday.
   */
  it('lets age lower a score and never raise one', () => {
    const headline = 'Council adopts new sanctions regulation'
    const fresh = assessImpact({ sourceKey: 'ec_press', headline, at: ago(0.5), now: NOW })
    const old = assessImpact({ sourceKey: 'ec_press', headline, at: ago(72), now: NOW })
    expect(fresh.score).toBeGreaterThan(old.score)
    expect(fresh.factors.every((f) => f.label.startsWith('Published') === (f.weight <= 0))).toBe(true)
  })

  it('penalises a statement with no published time rather than assuming it is now', () => {
    const result = assessImpact({ sourceKey: 'un_press', headline: 'Resolution adopted', at: null, now: NOW })
    expect(result.factors.map((f) => f.label)).toContain('No published time stated')
  })

  /**
   * A subject covered by five bodies is not five times more consequential than
   * one covered by two, and an uncapped term would let corroboration alone
   * outrank a sanctions package.
   */
  it('caps corroboration so it cannot outrank the instrument itself', () => {
    const many = assessImpact({
      ...base,
      sourceKey: 'un_news',
      headline: 'Officials discuss the annual programme',
      corroboratingBodies: 40,
    })
    const sanctions = assessImpact({
      ...base,
      sourceKey: 'un_press',
      headline: 'New sanctions designations announced',
      corroboratingBodies: 1,
    })
    expect(sanctions.score).toBeGreaterThan(many.score)
  })

  it('never leaves the 0–100 range, whatever it is given', () => {
    const extreme = assessImpact({
      ...base,
      sourceKey: 'whitehouse',
      headline: 'Executive order imposing sanctions after Security Council resolution on tariffs',
      corroboratingBodies: 99,
    })
    expect(extreme.score).toBeGreaterThanOrEqual(0)
    expect(extreme.score).toBeLessThanOrEqual(100)
    expect(assessImpact({ ...base, sourceKey: 'x', headline: 'A workshop, a visit and a tribute' }).score)
      .toBeGreaterThanOrEqual(0)
  })
})

describe('counting who else is saying it', () => {
  it('finds a subject two institutions share', () => {
    const counts = corroborationBySubject([
      { sourceKey: 'un_press', headline: 'Security Council discusses Sudan humanitarian access' },
      { sourceKey: 'ec_press', headline: 'EU announces new funding for Sudan' },
      { sourceKey: 'whitehouse', headline: 'President signs order on domestic manufacturing' },
    ])
    expect(counts.get('Security Council discusses Sudan humanitarian access')).toBe(2)
    expect(counts.get('President signs order on domestic manufacturing')).toBe(1)
  })

  /**
   * "Statement" appearing in nine headlines is not nine bodies addressing one
   * subject, and without dropping such words every item would look corroborated.
   */
  it('ignores words that appear in every press release', () => {
    const counts = corroborationBySubject([
      { sourceKey: 'a', headline: 'Joint statement from the general secretary' },
      { sourceKey: 'b', headline: 'Press statement by the minister' },
      { sourceKey: 'c', headline: 'Daily press briefing statement' },
    ])
    expect(counts.get('Joint statement from the general secretary')).toBe(1)
  })

  it('counts institutions, not repetitions from one of them', () => {
    const counts = corroborationBySubject([
      { sourceKey: 'un_press', headline: 'Yemen ceasefire talks resume' },
      { sourceKey: 'un_press', headline: 'Yemen humanitarian corridor opened' },
    ])
    expect(counts.get('Yemen ceasefire talks resume')).toBe(1)
  })
})
