import { describe, expect, it } from 'vitest'
import { staleFeeds, stalenessNote, STALE_AFTER_DAYS } from './staleness'
import type { Evidence } from '../engine/types'

const NOW = Date.parse('2026-08-15T00:00:00.000Z')
const daysAgo = (n: number) => new Date(NOW - n * 24 * 3600 * 1000).toISOString()

function report(sourceKey: string, publishedAt: string | null): Evidence {
  return {
    claim: `${sourceKey} item`,
    sourceKey,
    retrievedAt: new Date(NOW).toISOString(),
    publishedAt,
    confidence: 'unconfirmed',
  }
}

describe('staleFeeds', () => {
  /**
   * The case this module exists for: a feed that returns 200 and a valid
   * document whose newest item is four years old. Every other health check
   * calls it healthy.
   */
  it('names a feed that answers but has stopped publishing', () => {
    const stale = staleFeeds(
      [report('thedailystar_bd', daysAgo(1480)), report('thedailystar_bd', daysAgo(1490))],
      NOW,
    )
    expect(stale).toHaveLength(1)
    expect(stale[0].sourceKey).toBe('thedailystar_bd')
    expect(stale[0].daysSilent).toBe(1480)
    expect(stale[0].items).toBe(2)
  })

  it('judges a feed by its newest item, not its oldest', () => {
    // A feed carrying one pinned evergreen item from 2019 alongside today's
    // reporting is publishing normally.
    const stale = staleFeeds([report('bbc_arabic', daysAgo(2500)), report('bbc_arabic', daysAgo(1))], NOW)
    expect(stale).toEqual([])
  })

  /**
   * The real Der Spiegel case, which is why the measurement is on the newest
   * item and not on item age. Its feed carries long-form pieces four months old
   * *alongside* today's reporting. A rule looking at item age would condemn it.
   */
  it('leaves an archive-bearing feed alone while it still publishes', () => {
    const spiegel = [
      report('spiegel_international', daysAgo(120)),
      report('spiegel_international', daysAgo(95)),
      report('spiegel_international', daysAgo(2)),
    ]
    expect(staleFeeds(spiegel, NOW)).toEqual([])
    expect(STALE_AFTER_DAYS).toBe(90)
  })

  it('flags a feed the day it crosses the threshold, not before', () => {
    expect(staleFeeds([report('x', daysAgo(89))], NOW)).toEqual([])
    expect(staleFeeds([report('x', daysAgo(91))], NOW)).toHaveLength(1)
  })

  /**
   * A feed publishing only undated items is a *dating* problem, reported
   * elsewhere. Calling it stale would invent the timestamp whose absence is the
   * finding.
   */
  it('ignores feeds that state no publication time at all', () => {
    expect(staleFeeds([report('undated_feed', null), report('undated_feed', null)], NOW)).toEqual([])
  })

  it('ignores an unparseable timestamp rather than treating it as ancient', () => {
    expect(staleFeeds([report('bad', 'last tuesday')], NOW)).toEqual([])
  })

  it('reports a feed that contributed nothing as nothing — that is a different fault', () => {
    expect(staleFeeds([], NOW)).toEqual([])
  })

  it('orders longest-dead first, the order someone fixing them would work in', () => {
    const stale = staleFeeds(
      [report('recent', daysAgo(100)), report('ancient', daysAgo(900)), report('mid', daysAgo(300))],
      NOW,
    )
    expect(stale.map((s) => s.sourceKey)).toEqual(['ancient', 'mid', 'recent'])
  })
})

describe('stalenessNote', () => {
  it('says nothing when every feed is publishing', () => {
    expect(stalenessNote([])).toBeNull()
  })

  it('names the worst offender and counts the rest', () => {
    const note = stalenessNote(staleFeeds([report('a', daysAgo(900)), report('b', daysAgo(200))], NOW))
    expect(note).toContain('2 feeds')
    expect(note).toContain('a last published 900 days ago')
    expect(note).toContain('1 other feed')
  })

  it('reads correctly for a single stale feed', () => {
    const note = stalenessNote(staleFeeds([report('solo', daysAgo(400))], NOW))
    expect(note).toContain('1 feed answers but has stopped publishing')
    expect(note).not.toContain('other')
  })
})
