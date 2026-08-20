import { describe, expect, it } from 'vitest'
import { MAX_FUTURE_SKEW_MS, publicationTime, publicationZoneOffset } from './observed'

describe('publicationTime', () => {
  it('reads ISO-8601, the format most agencies publish', () => {
    expect(publicationTime('2026-08-05T00:00:00Z')).toBe('2026-08-05T00:00:00.000Z')
  })

  it('reads RFC-822, the format every RSS pubDate uses', () => {
    expect(publicationTime('Wed, 05 Aug 2026 00:00:00 GMT')).toBe('2026-08-05T00:00:00.000Z')
  })

  it("reads GDELT's compact stamp, which Date cannot parse unaided", () => {
    expect(new Date('20260814T031500Z').getTime()).toBeNaN()
    expect(publicationTime('20260814T031500Z')).toBe('2026-08-14T03:15:00.000Z')
  })

  /**
   * The distinction agencies never label. USGS publishes milliseconds and
   * several open-data portals publish seconds, both as bare integers.
   */
  it('tells epoch milliseconds from epoch seconds by magnitude', () => {
    const ms = publicationTime(1786680000000)
    const sec = publicationTime(1786680000)
    expect(ms).toBe('2026-08-14T04:00:00.000Z')
    expect(sec).toBe(ms)
  })

  it('accepts a quoted integer, because JSON feeds quote their numbers', () => {
    expect(publicationTime('1786680000000')).toBe('2026-08-14T04:00:00.000Z')
  })

  /**
   * Not a per-source hack: this is Drupal's stock RSS date, so it arrives from
   * a large share of government and regulator feeds at once.
   */
  it("reads the CMS date format Date.parse rejects outright", () => {
    expect(Date.parse('Friday, August 14, 2026 - 09:46')).toBeNaN()
    expect(publicationTime('Friday, August 14, 2026 - 09:46')).toBe('2026-08-14T09:46:00.000Z')
  })

  it('assumes UTC for a zoneless date instead of the host machine', () => {
    // Read as local time this would differ between a laptop and the deployed
    // host, which is a bug nobody sees until the two answers are compared.
    expect(publicationTime('Friday, August 14, 2026 - 09:46:30')).toBe('2026-08-14T09:46:30.000Z')
  })

  it('returns null for anything it cannot parse, never the current time', () => {
    for (const bad of [undefined, null, '', '   ', 'sometime last week', {}, [], NaN, true]) {
      expect(publicationTime(bad)).toBeNull()
    }
  })

  /**
   * The reason this module exists rather than a bare `Date.parse`: a malformed
   * feed date must not become a freshness claim in either direction.
   */
  it('rejects a date before the epoch as a parse artefact', () => {
    expect(Number.isFinite(Date.parse('0001-01-01T00:00:00Z'))).toBe(true)
    expect(publicationTime('0001-01-01T00:00:00Z')).toBeNull()
  })

  it('rejects a date far in the future — nothing is observed before it happens', () => {
    const wayAhead = new Date(Date.now() + 400 * 24 * 3600 * 1000).toISOString()
    expect(publicationTime(wayAhead)).toBeNull()
  })

  /**
   * This test used to assert the opposite, and it was the bug written down.
   *
   * A forward `effective` time is a real thing agencies publish — but it is not
   * *when the bulletin was issued*, which is what this function returns and what
   * the ranking ages events by. Accepting six hours ahead meant a row could be
   * fresher than anything that had actually happened, and take the top of the
   * board on that strength alone.
   */
  it('refuses a time six hours ahead: that is not when it was published', () => {
    const soon = new Date(Date.now() + 6 * 3600 * 1000).toISOString()
    expect(publicationTime(soon)).toBeNull()
  })
})

describe('publicationZoneOffset', () => {
  /**
   * The offset is a fact about *where* something happened, not formatting. A
   * Japanese bulletin saying `+09:00` is telling us the event happened at that
   * hour in Japan — which is the hour every other account of it will use.
   */
  it('reads an ISO offset in both written forms', () => {
    expect(publicationZoneOffset('2026-08-14T18:46:00+09:00')).toBe(540)
    expect(publicationZoneOffset('2026-08-14T18:46:00+0900')).toBe(540)
    expect(publicationZoneOffset('2026-08-14T05:46:00-04:00')).toBe(-240)
  })

  it('reads a half-hour and a three-quarter-hour zone', () => {
    expect(publicationZoneOffset('2026-08-14T18:46:00+05:30')).toBe(330)
    expect(publicationZoneOffset('2026-08-14T18:46:00+05:45')).toBe(345)
  })

  it('treats a trailing Z as the real answer zero, not as absent', () => {
    expect(publicationZoneOffset('2026-08-14T09:46:00Z')).toBe(0)
    expect(publicationZoneOffset('20260814T031500Z')).toBe(0)
  })

  it('reads the named zones RSS pubDate still uses', () => {
    expect(publicationZoneOffset('Thu, 14 Aug 2026 09:46:00 GMT')).toBe(0)
    expect(publicationZoneOffset('Thu, 14 Aug 2026 09:46:00 EDT')).toBe(-240)
    expect(publicationZoneOffset('Thu, 14 Aug 2026 09:46:00 PST')).toBe(-480)
  })

  it('reads a numeric RFC-822 offset', () => {
    expect(publicationZoneOffset('Thu, 14 Aug 2026 09:46:00 +0300')).toBe(180)
  })

  /**
   * Null, not zero. A feed that stated no zone has not said "UTC" — and showing
   * a reader a confident UTC stamp for a time nobody located is the kind of
   * quiet wrongness this module exists to refuse.
   */
  it('answers null when the source stated no zone at all', () => {
    expect(publicationZoneOffset('2026-08-14T09:46:00')).toBeNull()
    expect(publicationZoneOffset('2026-08-14')).toBeNull()
    expect(publicationZoneOffset('Friday, August 14, 2026 - 09:46')).toBeNull()
    expect(publicationZoneOffset(1786806360000)).toBeNull()
    expect(publicationZoneOffset(null)).toBeNull()
  })
})

/**
 * A publication time that has not happened yet is not a fact about the world —
 * and because the ranking decays severity by age, it is also the single most
 * damaging kind of wrong date: an event stamped tomorrow is fresher than
 * everything real, so it takes the top of the board and reorders the rest
 * around itself. Measured live: a hurricane-centre bulletin dated 33 hours
 * ahead, because its feed publishes the *next* advisory time.
 */
describe('a time that has not happened yet', () => {
  it('accepts a small skew, because publishers\' clocks drift', () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    expect(publicationTime(soon)).not.toBeNull()
  })

  it('refuses a bulletin dated tomorrow rather than ranking it above everything real', () => {
    const tomorrow = new Date(Date.now() + 33 * 60 * 60 * 1000).toISOString()
    expect(publicationTime(tomorrow)).toBeNull()
  })

  it('refuses anything past the stated skew, exactly', () => {
    const past = new Date(Date.now() + MAX_FUTURE_SKEW_MS + 60_000).toISOString()
    expect(publicationTime(past)).toBeNull()
  })
})
