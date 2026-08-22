import { describe, expect, it } from 'vitest'
import { statedFilingDetail } from './boards'

/**
 * The court board once printed `filed 2028-04-13` in the same voice as a real
 * date. The sort was never fooled — `publicationTime` had already refused the
 * date, so the row aged by receipt — but the reader was, which is the half of
 * the bug that reaches a person.
 */
describe('statedFilingDetail', () => {
  const NOW = Date.parse('2026-08-22T00:00:00Z')

  it('says nothing when the court stated nothing', () => {
    expect(statedFilingDetail(undefined, NOW)).toBeUndefined()
    expect(statedFilingDetail('', NOW)).toBeUndefined()
  })

  it('reads a real filing date plainly', () => {
    expect(statedFilingDetail('2026-08-14', NOW)).toBe('filed 2026-08-14')
  })

  it('marks the date the courthouse index put in the future', () => {
    // The measured case, from the live board.
    expect(statedFilingDetail('2028-04-13', NOW)).toBe(
      'filing date as the court states it: 2028-04-13 — not yet reached',
    )
  })

  it('marks a date from before there were computers to file on', () => {
    expect(statedFilingDetail('1801-03-04', NOW)).toBe(
      'filing date as the court states it: 1801-03-04 — outside the plausible range',
    )
  })

  it('marks a value that is not a date at all', () => {
    expect(statedFilingDetail('n/a', NOW)).toBe(
      'filing date as the court states it: n/a — unreadable',
    )
  })

  it('quotes the court rather than hiding what it said', () => {
    // Suppressing the field would make the page tidier and the record poorer.
    for (const stated of ['2028-04-13', '1801-03-04', 'n/a']) {
      expect(statedFilingDetail(stated, NOW)).toContain(stated)
    }
  })
})
