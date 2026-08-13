import { describe, it, expect } from 'vitest'
import { countFindings, historyTitle } from './history'

/**
 * Every gateway returns its evidence under a different key. A per-gateway
 * counter would be sixteen places to forget one, and the symptom would be a
 * history row reading "0 findings" next to a report full of them.
 */
describe('countFindings reads whatever shape the gateway returned', () => {
  it('counts a flat findings array', () => {
    expect(countFindings({ findings: [1, 2, 3] })).toBe(3)
  })

  it('counts the domain gateway’s object of sections', () => {
    expect(
      countFindings({
        sections: { dns: [1, 2], registration: [3], subdomains: [], hosting: [4] },
      }),
    ).toBe(4)
  })

  it('counts an array of section groups', () => {
    expect(
      countFindings({ sections: [{ findings: [1, 2] }, { findings: [3] }, { findings: [] }] }),
    ).toBe(3)
  })

  it('counts the email gateway’s two separate lists', () => {
    expect(countFindings({ breaches: [1, 2], profiles: [3] })).toBe(3)
  })

  it('counts news items and reference facts', () => {
    expect(countFindings({ items: [1, 2, 3, 4] })).toBe(4)
    expect(countFindings({ facts: [1, 2] })).toBe(2)
    expect(countFindings({ found: [1] })).toBe(1)
  })

  it('adds up a report that carries several of them at once', () => {
    expect(countFindings({ findings: [1], items: [2, 3], sections: { a: [4] } })).toBe(4)
  })

  /** Guessing a number would be worse than reporting none. */
  it('returns zero rather than guessing when it recognises nothing', () => {
    expect(countFindings({ summary: 'nothing array-shaped here' })).toBe(0)
    expect(countFindings({})).toBe(0)
    expect(countFindings(null)).toBe(0)
    expect(countFindings('a string')).toBe(0)
    expect(countFindings(undefined)).toBe(0)
  })

  it('is not confused by a non-array under a key it knows', () => {
    expect(countFindings({ findings: 'many' })).toBe(0)
    expect(countFindings({ sections: { dns: 'not an array' } })).toBe(0)
  })

  it('survives a null inside a section group', () => {
    expect(countFindings({ sections: [null, { findings: [1] }] })).toBe(1)
  })
})

describe('historyTitle', () => {
  it('reads as a person would say it', () => {
    expect(historyTitle('ownership', 'Nestle')).toBe('Ownership: Nestle')
    expect(historyTitle('domain', 'example.com')).toBe('Domain: example.com')
  })

  it('names the gateway alone when the run had no subject', () => {
    expect(historyTitle('board', '')).toBe('Board')
    expect(historyTitle('board', '   ')).toBe('Board')
  })

  it('stays inside what a row and a column can hold', () => {
    expect(historyTitle('domain', 'x'.repeat(500)).length).toBe(200)
  })
})
