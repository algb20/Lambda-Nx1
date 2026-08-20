import { describe, expect, it } from 'vitest'
import { RELATIVE_LIMIT_MS, displayTime, utcLabel } from './time'

const NOW = Date.parse('2026-08-20T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('the relative window', () => {
  it('says "now" for anything under a minute', () => {
    expect(displayTime(ago(30_000), { now: NOW })?.label).toMatch(/now/i)
  })

  it('counts minutes, then hours', () => {
    expect(displayTime(ago(42 * 60_000), { now: NOW })?.label).toMatch(/42/)
    expect(displayTime(ago(3 * 3_600_000), { now: NOW })?.label).toMatch(/3/)
  })

  /**
   * The defect this module was written for: the app showed "1h ago" beside news
   * that happened days earlier. Past a day the answer is a date, and a date
   * cannot drift.
   */
  it('switches to a date once past a day, and never says "6 days ago"', () => {
    const sixDays = displayTime(ago(6 * 24 * 3_600_000), { now: NOW, locale: 'en' })
    expect(sixDays?.label).not.toMatch(/ago|day/i)
    expect(sixDays?.label).toMatch(/14|Aug/)
    expect(sixDays?.relative).toBe(false)
  })

  it('draws the line exactly at twenty-four hours', () => {
    expect(displayTime(ago(RELATIVE_LIMIT_MS - 1000), { now: NOW })?.relative).toBe(true)
    expect(displayTime(ago(RELATIVE_LIMIT_MS + 1000), { now: NOW })?.relative).toBe(false)
  })

  it('drops the year for this year and keeps it for another', () => {
    expect(displayTime('2026-02-03T10:00:00Z', { now: NOW, locale: 'en' })?.label).not.toMatch(/2026/)
    expect(displayTime('2024-02-03T10:00:00Z', { now: NOW, locale: 'en' })?.label).toMatch(/2024/)
  })

  /**
   * Publisher clocks run a few seconds ahead of ours all the time. "in 4
   * seconds" beside a live bulletin reads as a bug.
   */
  it('treats a slightly future stamp as now rather than counting forward', () => {
    expect(displayTime(new Date(NOW + 4000).toISOString(), { now: NOW })?.label).toMatch(/now/i)
  })
})

describe('speaking the reader’s language', () => {
  /**
   * Arabic has a dual: two hours is «ساعتين», not «٢ ساعة». Hand-built strings
   * get this wrong in Arabic, Russian, Polish and a dozen others, which is why
   * the formatting is the runtime's job and not ours.
   */
  it('uses the locale’s own plural forms', () => {
    const two = displayTime(ago(2 * 3_600_000), { now: NOW, locale: 'ar' })?.label ?? ''
    expect(two).toMatch(/ساعت/)
    expect(displayTime(ago(2 * 3_600_000), { now: NOW, locale: 'en' })?.label).toMatch(/2 hours ago/)
  })

  it('formats the date in the reader’s language too', () => {
    const fr = displayTime('2026-02-03T10:00:00Z', { now: NOW, locale: 'fr' })?.label ?? ''
    expect(fr).toMatch(/fév|févr/i)
  })
})

describe('the event’s own time zone', () => {
  /**
   * `+09:00` on a Japanese bulletin is a fact about where the event happened,
   * not formatting. A reader in Riyadh should see the hour Tokyo reported, since
   * that is the hour every other account of the event will use.
   */
  it('renders the stated offset as the source’s own wall clock', () => {
    const shown = displayTime('2026-08-20T09:46:00Z', {
      now: NOW,
      locale: 'en',
      offsetMinutes: 9 * 60,
      place: 'Tokyo',
    })
    // 09:46 UTC is 18:46 in Tokyo.
    expect(shown?.title).toMatch(/6:46|18:46/)
    expect(shown?.title).toContain('UTC+9')
    expect(shown?.title).toContain('Tokyo')
  })

  it('handles a half-hour offset', () => {
    expect(utcLabel(-210)).toBe('UTC-3:30')
    expect(utcLabel(330)).toBe('UTC+5:30')
    expect(utcLabel(0)).toBe('UTC')
  })

  /**
   * A zone guessed from a country is wrong for every country wide enough to have
   * more than one. Saying "your time" is the honest answer.
   */
  it('says whose time it is when the source stated no zone', () => {
    const shown = displayTime(ago(3 * 24 * 3_600_000), { now: NOW, locale: 'en' })
    expect(shown?.title).toMatch(/your time/i)
    expect(shown?.title).toMatch(/no time zone/i)
  })

  it('always names a zone — an unlabelled stamp is why people mistrust stamps', () => {
    for (const offset of [null, 0, 60, -480]) {
      const shown = displayTime(ago(1000), { now: NOW, offsetMinutes: offset })
      expect(shown?.title).toMatch(/UTC|your time|GMT|[+-]\d/)
    }
  })
})

describe('refusing to invent a time', () => {
  it('returns null rather than a fabricated stamp', () => {
    expect(displayTime(null)).toBeNull()
    expect(displayTime(undefined)).toBeNull()
    expect(displayTime('')).toBeNull()
    expect(displayTime('not a date')).toBeNull()
  })
})
