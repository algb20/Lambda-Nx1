import { describe, expect, it } from 'vitest'
import type { Evidence } from '@/lib/engine/types'
import { toEvent } from './world-events'

/**
 * The seam between the engine and the board.
 *
 * These tests exist because of a defect that survived every other test in the
 * project: the live board reported **125 events and 0 source-stated times**.
 * Nothing was throwing, no source was failing, and every unit test passed —
 * the sources wrote the agency's timestamp into `retrievedAt`, and this mapping
 * read `data.observedAt`, so the two halves simply never met. A bug that lives
 * in a seam is only catchable at the seam.
 */
const base: Evidence = {
  claim: 'M 5.4 — 20km S of Somewhere',
  sourceKey: 'usgs_recent',
  retrievedAt: '2026-08-14T12:00:00.000Z',
  confidence: 'confirmed',
}

describe('toEvent — the time contract', () => {
  it('carries a source-stated publication time onto the event', () => {
    const event = toEvent({ ...base, publishedAt: '2026-08-14T09:30:00.000Z' }, 0)
    expect(event?.observedAt).toBe('2026-08-14T09:30:00.000Z')
  })

  it('keeps the two times apart, so detection lag is a real measurement', () => {
    const event = toEvent({ ...base, publishedAt: '2026-08-14T09:30:00.000Z' }, 0)
    expect(event?.at).toBe('2026-08-14T12:00:00.000Z')
    expect(event?.observedAt).not.toBe(event?.at)
  })

  it('reports no time rather than substituting the retrieval time', () => {
    expect(toEvent({ ...base }, 0)?.observedAt).toBeNull()
    expect(toEvent({ ...base, publishedAt: null }, 0)?.observedAt).toBeNull()
  })

  /**
   * The catalogue carried the time in the payload bag before `publishedAt`
   * became canonical. An archived record replayed from that era must not lose
   * its date on the way through.
   */
  it('still reads a time left in the payload bag by an older record', () => {
    const event = toEvent(
      { ...base, data: { observedAt: '2026-08-13T00:00:00.000Z', lat: 1, lon: 2 } },
      0,
    )
    expect(event?.observedAt).toBe('2026-08-13T00:00:00.000Z')
  })

  it('prefers the canonical field when a record carries both', () => {
    const event = toEvent(
      {
        ...base,
        publishedAt: '2026-08-14T09:30:00.000Z',
        data: { observedAt: '2020-01-01T00:00:00.000Z' },
      },
      0,
    )
    expect(event?.observedAt).toBe('2026-08-14T09:30:00.000Z')
  })
})

/**
 * Which evidence decides an item's category.
 *
 * The board filed 52% of everything as `world` because a source could only
 * declare what it *is*, never what a given item was about. These tests pin the
 * order the two kinds of evidence are trusted in.
 */
describe('toEvent — the category contract', () => {
  const news = (title: string, topics: string[]) =>
    toEvent({ ...base, claim: title, sourceKey: 'somefeed', data: { topics } }, 0)?.category

  it('trusts a single-purpose source over any word in a headline', () => {
    // A seismic network publishing an oddly-worded title is still seismic.
    expect(news('Network status update for the week', ['earthquake'])).toBe('seismic')
  })

  it('reads the headline when the source can only say "news"', () => {
    expect(news('Cholera outbreak spreads in the north', ['news'])).toBe('health')
    expect(news('Magnitude 6.2 earthquake strikes the coast', ['news'])).toBe('seismic')
  })

  /**
   * `['news', 'conflict']` is a general newsroom with a beat; `['cyber-advisory',
   * 'news']` is a single-subject publication. The records already tell them
   * apart by writing topics most-specific-first, so nothing new has to be
   * declared for this to work.
   */
  it('does not let a newsroom’s beat label an item it does not describe', () => {
    // Middle East Eye publishing an oil-price story is not armed conflict.
    expect(news('Oil climbs over $1 a barrel on supply concerns', ['news', 'conflict'])).toBe(
      'world',
    )
    // The same outlet's actual conflict reporting still lands correctly.
    expect(news('Air strike reported in the northern district', ['news', 'conflict'])).toBe(
      'conflict',
    )
  })

  it('keeps a single-subject publication on its subject', () => {
    // Krebs: `['cyber-advisory', 'news']`. An advisory whose headline names no
    // keyword is still an advisory.
    expect(news('Patch Tuesday, August 2026 edition', ['cyber-advisory', 'news'])).toBe('cyber')
  })

  it('leaves genuinely general reporting in world, which is a real category', () => {
    expect(news('Parties to conduct primaries in new constituencies', ['news'])).toBe('world')
  })

  it('does not file network measurement as a security event', () => {
    // 110 RIPE Atlas and OONI observations were landing in `cyber`, inflating
    // the security picture with routine reachability data.
    expect(news('ae-dxb-as15412-client.anchors.atlas.ripe.net', ['connectivity'])).toBe(
      'infrastructure',
    )
  })

})
