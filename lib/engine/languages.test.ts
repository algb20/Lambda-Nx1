import { describe, expect, it } from 'vitest'
import { canonicalLanguage, distinctLanguages } from './languages'

describe('canonicalLanguage', () => {
  it('resolves an ISO 639-1 code to the language it stands for', () => {
    expect(canonicalLanguage('ar')).toBe('Arabic')
    expect(canonicalLanguage('EN')).toBe('English')
    expect(canonicalLanguage('zh')).toBe('Chinese')
  })

  it('resolves a language written in its own script', () => {
    expect(canonicalLanguage('العربية')).toBe('Arabic')
    expect(canonicalLanguage('عربي')).toBe('Arabic')
    expect(canonicalLanguage('español')).toBe('Spanish')
    expect(canonicalLanguage('中文')).toBe('Chinese')
  })

  it('resolves a demonym used in place of the language', () => {
    // Measured: `persian`, `irani` and `iranian` all came back from the live
    // catalogue and were counted as three languages.
    expect(canonicalLanguage('iranian')).toBe('Persian')
    expect(canonicalLanguage('irani')).toBe('Persian')
    expect(canonicalLanguage('farsi')).toBe('Persian')
  })

  it('drops a regional qualifier that names a variety, not a language', () => {
    expect(canonicalLanguage('American English')).toBe('English')
    expect(canonicalLanguage('brazilian portuguese')).toBe('Portuguese')
  })

  it('keeps a qualifier whose remainder is not a language', () => {
    // "Sign Language" must never become "Language".
    expect(canonicalLanguage('sign language')).toBe('Sign Language')
  })

  it('folds a truncation only when it can mean one thing', () => {
    // The measured case: `arabi` is a prefix of exactly one language.
    expect(canonicalLanguage('arabi')).toBe('Arabic')
    // `ara` also prefixes Aragonese, so it is left as written rather than
    // guessed at — three characters is below the floor in any case.
    expect(canonicalLanguage('ara')).toBe('Ara')
  })

  /**
   * The hazard the ordering exists for. `romani` is a prefix of `romanian` and
   * is also a language; folding it would erase a language rather than merge a
   * spelling. It is only safe because Romani has a canonical entry that the
   * exact lookup reaches first.
   */
  it('never folds a known language into a longer one it prefixes', () => {
    expect(canonicalLanguage('romani')).not.toBe('Romanian')
    expect(canonicalLanguage('romanian')).toBe('Romanian')
  })

  it('keeps a language it does not recognise rather than dropping it', () => {
    // Luganda came back from the live catalogue. A count that silently drops
    // what it cannot name is worse than one that is a spelling too high.
    expect(canonicalLanguage('luganda')).toBe('Luganda')
    expect(canonicalLanguage('kriolu kabuverdianu')).toBe('Kriolu Kabuverdianu')
  })

  it('answers null only for a string that names nothing', () => {
    expect(canonicalLanguage('')).toBeNull()
    expect(canonicalLanguage('   ')).toBeNull()
    expect(canonicalLanguage('---')).toBeNull()
    expect(canonicalLanguage('123')).toBeNull()
  })
})

describe('distinctLanguages', () => {
  /**
   * The exact figure that was wrong on the live page. Saudi Arabia's stations
   * reported these seven names, and the gateway's headline claim — how many
   * languages a place is broadcasting in — said seven.
   */
  it('counts the Saudi Arabia result as the four languages it is', () => {
    const asPublished = ['ar', 'arabi', 'arabic', 'العربية', 'english', 'filipino', 'kurdish']
    expect(distinctLanguages(asPublished)).toEqual(['Arabic', 'English', 'Kurdish', 'Tagalog'])
  })

  it('counts the global sample without its duplicates', () => {
    const asPublished = ['english', 'american english', 'persian', 'irani', 'iranian', 'arabic', 'عربي']
    expect(distinctLanguages(asPublished)).toEqual(['Arabic', 'English', 'Persian'])
  })

  it('is stable and sorted, so two equal results read the same', () => {
    expect(distinctLanguages(['zulu', 'akan'])).toEqual(distinctLanguages(['akan', 'zulu']))
  })
})
