import { describe, expect, it } from 'vitest'
import { publicationTime } from './observed'

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

  it('allows a forward-dated alert, because agencies legitimately publish one', () => {
    const soon = new Date(Date.now() + 6 * 3600 * 1000).toISOString()
    expect(publicationTime(soon)).toBe(soon)
  })
})
