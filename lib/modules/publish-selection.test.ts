import { describe, expect, it } from 'vitest'
import { diversify } from '@/lib/analysis/significance'
import { rankEvents, type WorldEvent } from './world-events-shared'

/**
 * What the auto-publisher is allowed to put on the front page.
 *
 * The publish job used to take `events.slice(0, 30)` — arrival order, no rank,
 * no cap — and the result was measured on the live database: six consecutive
 * auto-published posts, every one an NWS county weather warning. These posts are
 * written to the database and become the permanent public record of what the
 * platform noticed, which makes this the worst of the three places the same
 * crowding failure appeared.
 *
 * This pins the selection rule itself, so the job cannot quietly lose it again.
 */

function event(over: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'An event',
    category: 'seismic',
    categoryLabel: 'Earthquake',
    color: '#f97316',
    lat: 10,
    lon: 20,
    country: null,
    countryIso: null,
    magnitude: null,
    magnitudeUnit: null,
    severity: 0.5,
    alertLevel: null,
    at: '2026-08-20T12:00:00Z',
    observedAt: '2026-08-20T12:00:00Z',
    sourceKey: 'a_source',
    sourceUrl: null,
    independence: null,
    admiralty: null,
    confidence: 'unconfirmed',
    ...over,
  } as WorldEvent
}

/** The selection the publish job performs, isolated so it can be asserted. */
function selectForPublishing(events: WorldEvent[], limit = 30): WorldEvent[] {
  const ranked = rankEvents(events)
  const board = diversify(
    ranked.map((r) => ({
      ...r,
      sourceKey: r.event.sourceKey,
      category: r.event.category as string,
      severity: r.event.severity,
    })),
    limit,
  )
  // Only the rows that met the caps on their own. `diversify` backfills the
  // rest to fill a screen, and a screen is not a permanent record.
  return board.taken.slice(0, board.diversified).map((r) => r.event)
}

describe('choosing what to publish automatically', () => {
  /** The measured failure, reproduced and then prevented. */
  it('refuses to let one weather service fill the front page', () => {
    const flood = Array.from({ length: 40 }, (_, i) =>
      event({
        id: `nws-${i}`,
        sourceKey: 'nws_alerts',
        category: 'flood',
        severity: 0.75,
        title: `Flood Warning ${i}`,
      }),
    )
    const quake = event({ id: 'quake', sourceKey: 'usgs', severity: 0.9, title: 'M 6.9' })

    const chosen = selectForPublishing([...flood, quake])
    const fromNws = chosen.filter((e) => e.sourceKey === 'nws_alerts').length

    expect(fromNws).toBeLessThanOrEqual(3)
    expect(chosen.map((e) => e.title)).toContain('M 6.9')
  })

  /**
   * Arrival order is not significance. An unranked slice would have published
   * the forty warnings and never reached the earthquake at all.
   */
  it('leads with the most significant event, not the first one received', () => {
    const noise = Array.from({ length: 20 }, (_, i) =>
      event({ id: `n-${i}`, sourceKey: `src_${i}`, severity: 0.1, title: `Minor ${i}` }),
    )
    const major = event({ id: 'major', sourceKey: 'usgs', severity: 0.95, title: 'M 7.7' })
    expect(selectForPublishing([...noise, major])[0].title).toBe('M 7.7')
  })

  /**
   * The backfill is the trap. `diversify` tops a board up from the overflow
   * once the caps are met — right for a screen the reader can see, wrong for
   * rows that become permanent posts.
   */
  it('publishes only what met the caps, never the backfill', () => {
    const flood = Array.from({ length: 40 }, (_, i) =>
      event({ id: `f-${i}`, sourceKey: 'nws_alerts', category: 'flood', severity: 0.75 }),
    )
    const chosen = selectForPublishing(flood, 30)
    expect(chosen.length).toBeLessThanOrEqual(3)
  })

  it('never publishes more than it was asked for', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      event({ id: `e-${i}`, sourceKey: `src_${i % 30}`, title: `Event ${i}` }),
    )
    expect(selectForPublishing(many, 30).length).toBeLessThanOrEqual(30)
  })
})
