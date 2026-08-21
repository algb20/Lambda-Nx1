import { describe, expect, it } from 'vitest'
import { legibleTitle } from './legible'

/**
 * The rows a reader could not read.
 *
 * Every case here was measured on the live board, not imagined: 37 of 4340
 * events carried a headline that stated nothing — 31 bare Japanese sea areas
 * from JMA, 4 NASA event codes, 2 coin tickers.
 */

const base = { category: 'world', magnitude: null, sourceKey: 'x' } as const

describe('a headline that already says something is never touched', () => {
  it.each([
    'Former premier of China Zhu Rongji dies at the age of 97',
    'Apollo Global confirms data breach after hackers target financial firms',
    'زلزال بقوة 6.7 درجة قبالة سواحل بيرو',
    'M 6.7 - 31 km NW of Aniso, Peru',
  ])('leaves %s exactly as published', (title) => {
    expect(legibleTitle({ ...base, title })).toBe(title)
  })

  /**
   * The guard that keeps this from becoming noise. A long CJK headline is a
   * sentence, not a bare place name, and prefixing it would be an insult to a
   * reader who can read it.
   */
  it('leaves a real CJK sentence alone', () => {
    const sentence = '中国前総理の朱鎔基氏が九十七歳で死去したと国営メディアが報じた'
    expect(legibleTitle({ ...base, title: sentence, category: 'seismic' })).toBe(sentence)
  })
})

describe('a bare place name is given the event it belongs to', () => {
  /** The live case: 31 rows like this, none saying an earthquake had happened. */
  it('says what happened, and keeps the publisher’s own words', () => {
    const out = legibleTitle({
      title: '八丈島東方沖',
      category: 'seismic',
      magnitude: 4.7,
      sourceKey: 'jma_quakes',
    })
    expect(out).toBe('Earthquake M4.7 — 八丈島東方沖')
  })

  it('still names the event when no magnitude was published', () => {
    const out = legibleTitle({
      title: '沖縄本島近海',
      category: 'seismic',
      magnitude: null,
      sourceKey: 'jma_quakes',
    })
    expect(out).toBe('Earthquake — 沖縄本島近海')
  })

  /**
   * The place name is never translated. A reader who cannot read it can still
   * act on "Earthquake M4.7", and translating would be a claim the publisher
   * did not make.
   */
  it('does not translate the location', () => {
    expect(legibleTitle({ title: '奄美大島北西沖', category: 'seismic', magnitude: 3.1, sourceKey: 'jma_quakes' }))
      .toContain('奄美大島北西沖')
  })

  it('adds nothing for a category with no plain noun to add', () => {
    expect(legibleTitle({ title: '茨城県沖', category: 'world', magnitude: null, sourceKey: 'x' }))
      .toBe('茨城県沖')
  })
})

describe('a publisher’s code is expanded by that publisher’s glossary', () => {
  it.each([
    ['CME', 'Coronal mass ejection (CME)'],
    ['RBE', 'Radiation belt enhancement (RBE)'],
    ['SEP', 'Solar energetic particle event (SEP)'],
    ['FLR', 'Solar flare (FLR)'],
  ])('expands %s', (code, expected) => {
    expect(legibleTitle({ title: code, category: 'space', magnitude: null, sourceKey: 'nasa_donki' }))
      .toBe(expected)
  })

  /**
   * Scoped to the source that owns the vocabulary. `CME` is the Chicago
   * Mercantile Exchange in a financial feed, and a global code table would
   * eventually publish "Coronal mass ejection" over a futures headline.
   */
  it('does not apply NASA’s glossary to another publisher', () => {
    const out = legibleTitle({ title: 'CME', category: 'markets', magnitude: null, sourceKey: 'coingecko_trending' })
    expect(out).not.toContain('Coronal')
  })

  it('leaves an unknown code from a known publisher alone rather than guessing', () => {
    expect(legibleTitle({ title: 'ZZZ', category: 'space', magnitude: null, sourceKey: 'nasa_donki' }))
      .toBe('Space weather — ZZZ')
  })
})

describe('it never invents', () => {
  it('adds no location that was not published', () => {
    const out = legibleTitle({ title: '八丈島東方沖', category: 'seismic', magnitude: 4.7, sourceKey: 'jma_quakes' })
    expect(out).not.toMatch(/Tokyo|Japan|near/i)
  })

  it('adds no magnitude when none was measured', () => {
    const out = legibleTitle({ title: 'XYZ', category: 'seismic', magnitude: null, sourceKey: 'jma_quakes' })
    expect(out).not.toMatch(/M\d/)
  })

  it('handles an empty headline without producing a lone prefix', () => {
    // `toEvent` drops empty claims before this is reached; if that ever changes,
    // "Earthquake — " is not an acceptable row.
    expect(legibleTitle({ ...base, title: '   ' })).toBe('')
  })
})
