import { describe, it, expect, vi } from 'vitest'
import {
  MAX_PER_RUN,
  SEVERITY_BAR,
  eventToCandidate,
  radarToCandidate,
  refKey,
  runAutoPublish,
  trendingToCandidate,
  utcDay,
  type PublishCandidate,
} from './autopublish'
import type { WorldEvent } from './world-events-shared'

function event(over: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id: 'e1',
    title: 'M 7.1 - 30km SW of Somewhere',
    category: 'seismic',
    categoryLabel: 'Earthquake',
    color: '#f97316',
    lat: 35.6,
    lon: 139.7,
    country: 'Japan',
    countryIso: 'JP',
    magnitude: 7.1,
    magnitudeUnit: 'moment magnitude',
    severity: 0.92,
    alertLevel: null,
    at: '2026-08-07T12:00:00Z',
    sourceKey: 'usgs_recent',
    sourceUrl: 'https://earthquake.usgs.gov/e/1',
    admiralty: { source: 'A', info: 1 },
    confidence: 'confirmed',
    ...over,
  }
}

describe('refKey and utcDay', () => {
  it('produces a stable, safe identity', () => {
    expect(refKey('event', 'M 7.1 — 30km SW of Somewhere!')).toBe(
      'event:m-7-1-30km-sw-of-somewhere',
    )
    // Same input, same key — that is what makes deduplication work.
    expect(refKey('event', 'Same thing')).toBe(refKey('event', 'Same thing'))
  })

  it('caps the key length so a very long headline cannot break storage', () => {
    expect(refKey('event', 'x'.repeat(500)).length).toBeLessThanOrEqual(86)
  })

  it('formats the day for idempotent daily digests', () => {
    expect(utcDay(new Date('2026-08-07T23:30:00Z'))).toBe('2026-08-07')
  })
})

describe('eventToCandidate — the threshold is the feature', () => {
  it('publishes an event that clears the bar', () => {
    const c = eventToCandidate(event())!
    expect(c).not.toBeNull()
    expect(c.kind).toBe('signal')
    expect(c.title).toContain('M 7.1')
    expect(c.sourceUrl).toBe('https://earthquake.usgs.gov/e/1')
  })

  it('refuses anything below the bar rather than filling the feed', () => {
    expect(eventToCandidate(event({ severity: SEVERITY_BAR - 0.01 }))).toBeNull()
    expect(eventToCandidate(event({ severity: 0 }))).toBeNull()
  })

  it('refuses an event with nowhere to send the reader', () => {
    expect(eventToCandidate(event({ sourceUrl: null }))).toBeNull()
  })

  /** Rule 2: nothing in the body that the source did not say. */
  it('writes only the fields the source provided', () => {
    const c = eventToCandidate(event({ alertLevel: 'Red' }))!
    expect(c.body).toContain('Japan')
    expect(c.body).toContain('7.1 moment magnitude')
    expect(c.body).toContain('Official alert level: Red')
    expect(c.body).toContain('Admiralty rating: A1')
    expect(c.body).toContain('Confidence: confirmed')
  })

  it('omits facts it does not have instead of writing a blank', () => {
    const c = eventToCandidate(
      event({ country: null, magnitude: null, magnitudeUnit: null, admiralty: null }),
    )!
    expect(c.body).not.toContain('Location:')
    expect(c.body).not.toContain('Measured:')
    expect(c.body).not.toContain('Admiralty')
    expect(c.body).not.toContain('null')
    expect(c.body).not.toContain('undefined')
  })

  it('gives the same event the same identity every run', () => {
    expect(eventToCandidate(event())!.refValue).toBe(eventToCandidate(event())!.refValue)
  })
})

describe('trendingToCandidate', () => {
  const subject = (rank: number, corroborated = true) => ({
    title: `Subject ${rank}`,
    url: `https://en.wikipedia.org/wiki/S${rank}`,
    views: 100_000 - rank,
    corroborated,
    rank,
  })

  it('publishes one daily brief, not one post per subject', () => {
    const c = trendingToCandidate([subject(1), subject(2), subject(3)], '2026-08-07')!
    expect(c.kind).toBe('research')
    expect(c.title).toContain('2026-08-07')
    expect(c.body).toContain('Subject 1')
    expect(c.body).toContain('Subject 3')
  })

  it('stays silent when too little was corroborated to be worth a post', () => {
    expect(trendingToCandidate([subject(1), subject(2)])).toBeNull()
    expect(
      trendingToCandidate([subject(1, false), subject(2, false), subject(3, false)]),
    ).toBeNull()
    expect(trendingToCandidate([])).toBeNull()
  })

  it('is idempotent per day, so re-running the job cannot repost it', () => {
    const a = trendingToCandidate([subject(1), subject(2), subject(3)], '2026-08-07')!
    const b = trendingToCandidate([subject(4), subject(5), subject(6)], '2026-08-07')!
    expect(a.refValue).toBe(b.refValue)
  })
})

describe('radarToCandidate', () => {
  const finding = (i: number, url: string | null = `https://example.com/${i}`) => ({
    title: `Finding ${i}`,
    url,
    sourceKey: 'cisa_kev',
    admiralty: { source: 'A', info: 1 },
  })

  it('digests the sweep with a grade and a link per item', () => {
    const c = radarToCandidate([finding(1), finding(2), finding(3)], '2026-08-07')!
    expect(c.kind).toBe('research')
    expect(c.body).toContain('[A1]')
    expect(c.body).toContain('cisa_kev')
    expect(c.body).toContain('https://example.com/1')
  })

  it('drops items with no link and stays silent if too few remain', () => {
    expect(radarToCandidate([finding(1), finding(2, null), finding(3, null)])).toBeNull()
  })
})

describe('runAutoPublish', () => {
  const candidate = (refValue: string): PublishCandidate => ({
    kind: 'signal',
    title: refValue,
    body: 'body',
    sourceUrl: 'https://example.com',
    refValue,
    locale: 'en',
  })

  it('publishes the new ones and counts the rest', async () => {
    const published: string[] = []
    const result = await runAutoPublish(
      [candidate('a'), candidate('b'), null, candidate('c')],
      {
        alreadyPublished: async (ref) => ref === 'b',
        publish: async (c) => {
          published.push(c.refValue)
        },
      },
    )
    expect(published).toEqual(['a', 'c'])
    expect(result.considered).toBe(4)
    expect(result.skippedAsDuplicate).toBe(1)
    expect(result.skippedBelowBar).toBe(1)
  })

  it('never floods the feed, however bad the day', async () => {
    const published: string[] = []
    const many = Array.from({ length: 40 }, (_, i) => candidate(`e${i}`))
    const result = await runAutoPublish(many, {
      alreadyPublished: async () => false,
      publish: async (c) => {
        published.push(c.refValue)
      },
    })
    expect(published).toHaveLength(MAX_PER_RUN)
    expect(result.published).toHaveLength(MAX_PER_RUN)
  })

  /** A scheduled job that stops on the first error publishes nothing all week. */
  it('keeps going when one write fails', async () => {
    const published: string[] = []
    await runAutoPublish([candidate('a'), candidate('bad'), candidate('c')], {
      alreadyPublished: async () => false,
      publish: async (c) => {
        if (c.refValue === 'bad') throw new Error('write failed')
        published.push(c.refValue)
      },
    })
    expect(published).toEqual(['a', 'c'])
  })

  /** A duplicate on the front page is worse than a post that waits a run. */
  it('skips rather than risks a duplicate when the dedup check itself fails', async () => {
    const publish = vi.fn()
    const result = await runAutoPublish([candidate('a')], {
      alreadyPublished: async () => {
        throw new Error('db down')
      },
      publish,
    })
    expect(publish).not.toHaveBeenCalled()
    expect(result.published).toEqual([])
    expect(result.skippedAsDuplicate).toBe(1)
  })
})
