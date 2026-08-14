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
