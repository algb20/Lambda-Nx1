import { describe, it, expect } from 'vitest'
import {
  corroborationBandOf,
  corroborationFactor,
  describeWindow,
  detectionLagMinutes,
  eventTimeMs,
  believableObservation,
  fusedByEventId,
  hasCoordinate,
  MAX_CLOCK_SKEW_MS,
  humanHours,
  lagBandOf,
  latencyProfile,
  newestObservation,
  operationalScore,
  untimedCount,
  rankEvents,
  timeExtent,
  timeHistogram,
  timedByReceipt,
  utcStamp,
  withinWindow,
  type FusedEventSummary,
  type WorldEvent,
} from './world-events-shared'

function event(over: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id: 'x',
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
    severity: 0,
    alertLevel: null,
    at: '2026-08-07T00:00:00Z',
    observedAt: null,
    independence: null,
    sourceKey: 'usgs_recent',
    sourceUrl: null,
    admiralty: { source: 'A', info: 1 },
    confidence: 'confirmed',
    ...over,
  }
}

function fusedEvent(over: Partial<FusedEventSummary> = {}): FusedEventSummary {
  return {
    id: 'evt:10,20:1',
    title: 'An event',
    lat: 10,
    lon: 20,
    observedAt: null,
    lastReceivedAt: '2026-08-07T00:00:00Z',
    magnitude: null,
    independentSources: 1,
    origins: ['usgs'],
    contradictions: [],
    signals: [
      {
        id: 'x',
        title: 'An event',
        sourceKey: 'usgs_recent',
        sourceUrl: null,
        independence: 'usgs',
        admiralty: { source: 'A', info: 1 },
        observedAt: null,
        receivedAt: '2026-08-07T00:00:00Z',
        magnitude: null,
      },
    ],
    basis: 'single',
    ...over,
  }
}

describe('eventTimeMs — when it happened, else when we heard', () => {
  it('prefers the source’s observation time over our receipt', () => {
    const e = event({ observedAt: '2026-08-06T00:00:00Z', at: '2026-08-07T00:00:00Z' })
    expect(eventTimeMs(e)).toBe(Date.parse('2026-08-06T00:00:00Z'))
    expect(timedByReceipt(e)).toBe(false)
  })

  it('falls back to receipt and admits it when the source published no time', () => {
    const e = event({ observedAt: null })
    expect(eventTimeMs(e)).toBe(Date.parse('2026-08-07T00:00:00Z'))
    expect(timedByReceipt(e)).toBe(true)
  })

  it('treats an unparseable observation time as no time at all', () => {
    const e = event({ observedAt: 'sometime last week' })
    expect(eventTimeMs(e)).toBe(Date.parse('2026-08-07T00:00:00Z'))
    expect(timedByReceipt(e)).toBe(true)
  })
})

describe('operationalScore ages from the event, not from the post', () => {
  it('does not treat a three-day-old bulletin as fresh because we just received it', () => {
    const now = Date.parse('2026-08-07T12:00:00Z')
    const old = event({ severity: 0.8, observedAt: '2026-08-04T12:00:00Z', at: '2026-08-07T12:00:00Z' })
    const fresh = event({ severity: 0.8, observedAt: '2026-08-07T11:00:00Z', at: '2026-08-07T12:00:00Z' })
    expect(operationalScore(old, now)).toBeLessThan(operationalScore(fresh, now))
    // Exactly one half-life old, so exactly half the score.
    expect(operationalScore(old, now) / operationalScore(fresh, now)).toBeCloseTo(0.5, 1)
  })
})

describe('withinWindow — outside the window is removed, not dimmed', () => {
  const window = {
    endMs: Date.parse('2026-08-07T12:00:00Z'),
    hours: 6,
    liveEdgeMs: Date.parse('2026-08-07T12:00:00Z'),
  }

  it('keeps what is inside and drops what is outside', () => {
    expect(withinWindow(event({ observedAt: '2026-08-07T11:00:00Z' }), window)).toBe(true)
    expect(withinWindow(event({ observedAt: '2026-08-07T06:00:00Z' }), window)).toBe(true)
    expect(withinWindow(event({ observedAt: '2026-08-07T05:59:00Z' }), window)).toBe(false)
    // Nothing after the cursor: scrubbing back must not show the future.
    expect(withinWindow(event({ observedAt: '2026-08-07T12:01:00Z' }), window)).toBe(false)
  })

  it('shows everything when the filter is off', () => {
    const off = { ...window, hours: null }
    expect(withinWindow(event({ observedAt: '2020-01-01T00:00:00Z' }), off)).toBe(true)
    expect(withinWindow(event({ at: 'not a date' }), off)).toBe(true)
  })

  it('excludes an event that cannot be timed at all rather than guessing where it goes', () => {
    expect(withinWindow({ observedAt: null, at: 'not a date' }, window)).toBe(false)
  })
})

describe('describeWindow — the window said in words', () => {
  const liveEdgeMs = Date.parse('2026-08-14T09:12:00Z')

  it('says the filter is off rather than implying a window', () => {
    expect(describeWindow({ endMs: liveEdgeMs, hours: null, liveEdgeMs })).toMatch(/time filter is off/)
  })

  it('names the span and the moment at the live edge', () => {
    const said = describeWindow({ endMs: liveEdgeMs, hours: 24, liveEdgeMs })
    expect(said).toContain('24 hours')
    expect(said).toContain('up to now')
    expect(said).toContain('14 Aug 09:12 UTC')
  })

  it('says how far back the cursor has been dragged', () => {
    const said = describeWindow({ endMs: liveEdgeMs - 8 * 3_600_000, hours: 6, liveEdgeMs })
    expect(said).toContain('6 hours')
    expect(said).toContain('14 Aug 01:12 UTC')
    expect(said).toContain('8h behind the live edge')
  })
})

describe('utcStamp and humanHours', () => {
  it('formats in UTC, identically wherever it runs', () => {
    expect(utcStamp(Date.parse('2026-01-03T04:05:00Z'))).toBe('3 Jan 04:05 UTC')
    expect(utcStamp(Number.NaN)).toBe('unknown')
  })

  it('uses the unit a person would use', () => {
    expect(humanHours(0.25)).toBe('15m')
    expect(humanHours(5)).toBe('5h')
    expect(humanHours(50)).toBe('2d')
    // Never rounds a real duration down to nothing.
    expect(humanHours(0.001)).toBe('1m')
  })

  /**
   * The bug a reader found on the globe page: one event, two ages.
   *
   * The significance rows read "3h old" while the unplaceable list read
   * "2 hours ago" for the very same advisory, because this function rounded and
   * `lib/ui/time.ts` floored. Someone shown one instant with two ages has no
   * reason to trust any time on the page.
   *
   * Both clocks floor now, and this is the assertion that keeps them together —
   * it compares against the arithmetic `relativeOrDate` actually performs
   * rather than against a hard-coded string, so a change to either side has to
   * be a deliberate change to both.
   */
  it('agrees with the relative clock on the same instant', () => {
    for (const hours of [1.4, 2.6, 2.99, 5.5, 12.7, 23.9]) {
      const flooredElsewhere = Math.floor(Math.floor(hours * 60) / 60)
      expect(humanHours(hours), `${hours}h disagreed with the relative clock`).toBe(
        `${flooredElsewhere}h`,
      )
    }
  })

  /**
   * And the direction matters, not only the agreement. Rounding 2.6 hours up to
   * "3h" claims more elapsed time than has passed — on a surface whose whole
   * argument is freshness, overstating age is the error that misleads.
   */
  it('never claims more time has passed than actually has', () => {
    expect(humanHours(2.9)).toBe('2h')
    expect(humanHours(0.98)).toBe('58m')
    expect(humanHours(47.9)).toBe('47h')
  })
})

describe('timeExtent and timeHistogram', () => {
  const events = [
    event({ observedAt: '2026-08-07T00:00:00Z' }),
    event({ observedAt: '2026-08-07T06:00:00Z' }),
    event({ observedAt: '2026-08-07T11:59:00Z' }),
  ]

  it('reports the span the data actually covers', () => {
    const extent = timeExtent(events)
    expect(extent?.oldestMs).toBe(Date.parse('2026-08-07T00:00:00Z'))
    expect(extent?.newestMs).toBe(Date.parse('2026-08-07T11:59:00Z'))
  })

  it('has no span when nothing can be timed', () => {
    expect(timeExtent([{ observedAt: null, at: 'not a date' }])).toBeNull()
    expect(timeExtent([])).toBeNull()
  })

  it('counts real reports into equal slices and ignores what falls outside', () => {
    const start = Date.parse('2026-08-07T00:00:00Z')
    const end = Date.parse('2026-08-07T12:00:00Z')
    const bars = timeHistogram(
      [...events, event({ observedAt: '2026-08-06T00:00:00Z' })],
      start,
      end,
      4,
    )
    expect(bars).toEqual([1, 0, 1, 1])
    expect(bars.reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('survives a zero-width span instead of dividing by it', () => {
    const t = Date.parse('2026-08-07T00:00:00Z')
    expect(timeHistogram(events, t, t, 5)).toEqual([0, 0, 0, 0, 0])
  })
})

describe('detectionLatency — how long between the world moving and us seeing it', () => {
  it('measures the real gap', () => {
    expect(
      detectionLagMinutes(event({ observedAt: '2026-08-07T00:00:00Z', at: '2026-08-07T00:20:00Z' })),
    ).toBe(20)
  })

  it('has no answer when the source published no time, rather than assuming zero', () => {
    expect(detectionLagMinutes(event({ observedAt: null }))).toBeNull()
  })

  it('refuses a negative latency instead of reporting one', () => {
    expect(
      detectionLagMinutes(event({ observedAt: '2026-08-07T01:00:00Z', at: '2026-08-07T00:00:00Z' })),
    ).toBeNull()
  })

  it('bands a lag into the class an operator reads', () => {
    expect(lagBandOf(3).key).toBe('immediate')
    expect(lagBandOf(30).key).toBe('fast')
    expect(lagBandOf(200).key).toBe('slow')
    expect(lagBandOf(5000).key).toBe('late')
  })

  it('profiles a set with a median and counts what it could not time', () => {
    const profile = latencyProfile([
      event({ observedAt: '2026-08-07T00:00:00Z', at: '2026-08-07T00:05:00Z' }), // 5m
      event({ observedAt: '2026-08-07T00:00:00Z', at: '2026-08-07T00:45:00Z' }), // 45m
      event({ observedAt: '2026-08-07T00:00:00Z', at: '2026-08-07T09:00:00Z' }), // 9h
      event({ observedAt: null }),
    ])
    expect(profile.timed).toBe(3)
    expect(profile.untimed).toBe(1)
    expect(profile.medianMinutes).toBe(45)
    expect(profile.bands.find((b) => b.key === 'immediate')?.count).toBe(1)
    expect(profile.bands.find((b) => b.key === 'late')?.count).toBe(1)
  })

  it('has no median when nothing in the set could be timed', () => {
    expect(latencyProfile([event({ observedAt: null })]).medianMinutes).toBeNull()
  })
})

describe('corroboration', () => {
  it('never draws a contested event in the colour that means settled', () => {
    expect(corroborationBandOf(5, true).key).toBe('contested')
    expect(corroborationBandOf(3, false).key).toBe('strong')
    expect(corroborationBandOf(2, false).key).toBe('corroborated')
    expect(corroborationBandOf(1, false).key).toBe('single')
  })

  it('caps how far agreement can lift a rank', () => {
    expect(corroborationFactor(1)).toBe(1)
    expect(corroborationFactor(2)).toBeCloseTo(1.2)
    expect(corroborationFactor(4)).toBeCloseTo(1.6)
    expect(corroborationFactor(40)).toBeCloseTo(1.6)
  })
})

describe('fusedByEventId', () => {
  it('finds the cluster from any one of the reports inside it', () => {
    const cluster = fusedEvent({
      independentSources: 2,
      signals: [
        { ...fusedEvent().signals[0], id: 'a', independence: 'usgs' },
        { ...fusedEvent().signals[0], id: 'b', independence: 'emsc' },
      ],
    })
    const index = fusedByEventId([cluster])
    expect(index.get('a')).toBe(cluster)
    expect(index.get('b')).toBe(cluster)
    expect(index.get('c')).toBeUndefined()
  })
})

describe('rankEvents — the order has to be defensible', () => {
  const now = Date.parse('2026-08-07T12:00:00Z')

  it('lifts a corroborated event above an identical uncorroborated one', () => {
    const alone = event({ id: 'alone', severity: 0.5, observedAt: '2026-08-07T11:00:00Z' })
    const agreed = event({ id: 'agreed', severity: 0.5, observedAt: '2026-08-07T11:00:00Z' })
    const fused = fusedByEventId([
      fusedEvent({
        independentSources: 3,
        signals: [{ ...fusedEvent().signals[0], id: 'agreed' }],
      }),
    ])
    const [first, second] = rankEvents([alone, agreed], { now, fused })
    expect(first.event.id).toBe('agreed')
    expect(first.origins).toBe(3)
    expect(second.origins).toBe(1)
  })

  it('never lets agreement outrank a much more severe event', () => {
    const major = event({ id: 'major', severity: 0.95, observedAt: '2026-08-07T11:00:00Z' })
    const carried = event({ id: 'carried', severity: 0.1, observedAt: '2026-08-07T11:00:00Z' })
    const fused = fusedByEventId([
      fusedEvent({
        independentSources: 9,
        signals: [{ ...fusedEvent().signals[0], id: 'carried' }],
      }),
    ])
    expect(rankEvents([carried, major], { now, fused })[0].event.id).toBe('major')
  })

  it('ranks against the cursor, so scrubbing back reconstructs the order of that moment', () => {
    const earlier = event({ id: 'earlier', severity: 0.6, observedAt: '2026-08-05T12:00:00Z' })
    const later = event({ id: 'later', severity: 0.5, observedAt: '2026-08-07T11:00:00Z' })
    expect(rankEvents([earlier, later], { now })[0].event.id).toBe('later')
    // At a cursor before the later event existed, the earlier one leads.
    const cursor = Date.parse('2026-08-05T13:00:00Z')
    expect(rankEvents([earlier, later], { now: cursor })[0].event.id).toBe('earlier')
  })

  it('explains every placement in facts the record actually carries', () => {
    const [ranked] = rankEvents(
      [
        event({
          magnitude: 6.1,
          magnitudeUnit: 'Mww',
          severity: 0.72,
          observedAt: '2026-08-07T09:00:00Z',
        }),
      ],
      { now },
    )
    expect(ranked.reasons).toEqual(['6.1 Mww measured', '3h old', 'single origin'])
  })

  /**
   * The verdict belongs to the ranking, not to a component. Every surface — the
   * globe, the panels, the MCP tools — reads this one field, so none of them can
   * interrupt a reader on evidence the others would not.
   */
  it('carries a breaking verdict on every ranked row', () => {
    const [ranked] = rankEvents([event({ observedAt: '2026-08-07T11:00:00Z' })], { now })
    expect(ranked.breaking).toEqual({ breaking: false, reasons: [] })
  })

  it('calls a severe report from a quiet publisher breaking, and says why', () => {
    const [ranked] = rankEvents(
      [event({ id: 'rare', severity: 0.8, observedAt: '2026-08-07T11:00:00Z' })],
      { now },
    )
    expect(ranked.breaking.breaking).toBe(true)
    expect(ranked.breaking.reasons.join(' ')).toContain('severe')
  })

  /**
   * The measured failure this whole mechanism exists for: NWS issues county
   * warnings all day and each grades to the same severity. If routine volume
   * could set off a banner, the banner would fire continuously and be worth
   * nothing at the one moment it matters.
   */
  it('refuses to call routine high-severity volume breaking', () => {
    const flood = Array.from({ length: 12 }, (_, i) =>
      event({
        id: `flood-${i}`,
        sourceKey: 'nws_alerts',
        category: 'flood',
        severity: 0.75,
        observedAt: '2026-08-07T11:00:00Z',
      }),
    )
    for (const row of rankEvents(flood, { now })) {
      expect(row.breaking.breaking).toBe(false)
    }
  })

  /** "Breaking" about yesterday is not breaking, however severe. */
  it('will not call a stale report breaking', () => {
    const [ranked] = rankEvents(
      [event({ id: 'old', severity: 0.95, observedAt: '2026-08-05T11:00:00Z' })],
      { now },
    )
    expect(ranked.breaking.breaking).toBe(false)
  })

  it('says when a severity was never graded rather than implying one', () => {
    const [ranked] = rankEvents([event({ observedAt: '2026-08-07T11:00:00Z' })], { now })
    expect(ranked.reasons[0]).toBe('no severity graded')
  })

  it('marks an age taken from our receipt as exactly that', () => {
    const [ranked] = rankEvents([event({ observedAt: null, at: '2026-08-07T10:00:00Z' })], { now })
    expect(ranked.byReceipt).toBe(true)
    expect(ranked.reasons[1]).toBe('2h old by receipt')
  })

  it('names an agency alert level ahead of any number we could derive', () => {
    const [ranked] = rankEvents(
      [event({ alertLevel: 'Red', severity: 0.9, magnitude: 3, observedAt: '2026-08-07T11:00:00Z' })],
      { now },
    )
    expect(ranked.reasons[0]).toBe('Red alert from the source')
  })

  it('reports disagreement as a reason of its own', () => {
    const fused = fusedByEventId([
      fusedEvent({
        independentSources: 2,
        contradictions: [{ field: 'location', detail: 'differ by 80 km', between: ['usgs', 'emsc'] }],
        signals: [{ ...fusedEvent().signals[0], id: 'x' }],
      }),
    ])
    const [ranked] = rankEvents([event({ observedAt: '2026-08-07T11:00:00Z' })], { now, fused })
    expect(ranked.contested).toBe(true)
    expect(ranked.reasons).toContain('origins disagree')
  })

  it('is deterministic for identical events, so a refresh keeps the same lead', () => {
    const a = event({ id: 'b-second', severity: 0.4, observedAt: '2026-08-07T11:00:00Z' })
    const b = event({ id: 'a-first', severity: 0.4, observedAt: '2026-08-07T11:00:00Z' })
    expect(rankEvents([a, b], { now })[0].event.id).toBe('a-first')
    expect(rankEvents([b, a], { now })[0].event.id).toBe('a-first')
  })
})

/**
 * The live edge is the publisher's time, never ours.
 *
 * Found by reading a running board rather than the code: the KPI strip printed
 * **Live edge — just now** in green while the panel beside it listed the same
 * ten items as "3 hours ago", "21 hours ago" and "Aug 26". The reducer behind
 * it summed over `at`, which is `retrievedAt` — our own clock, stamped on each
 * record as it arrived. It could not have returned anything else.
 *
 * Four surfaces quoted that figure as "is this live?": the board header, the
 * pinned gateways, the standing brief's "Newest", and the strip. All four were
 * answering a question nobody asked — *did we just make a request?* — in the
 * voice of one that matters.
 */
describe('newestObservation — the publisher’s clock, not ours', () => {
  const ev = (observedAt: string | null) => ({ observedAt })

  it('takes the newest publisher time', () => {
    expect(
      newestObservation([
        ev('2026-08-20T10:00:00.000Z'),
        ev('2026-08-27T09:00:00.000Z'),
        ev('2026-08-25T23:00:00.000Z'),
      ]),
    ).toBe('2026-08-27T09:00:00.000Z')
  })

  it('returns null when nobody stated a time, rather than inventing one', () => {
    expect(newestObservation([ev(null), ev(null)])).toBeNull()
  })

  it('skips undated events instead of letting them sink the answer', () => {
    expect(newestObservation([ev(null), ev('2026-08-27T09:00:00.000Z'), ev(null)])).toBe(
      '2026-08-27T09:00:00.000Z',
    )
  })

  it('treats an unparseable string as no time, not as 1970', () => {
    expect(newestObservation([ev('shortly'), ev('2026-08-20T10:00:00.000Z')])).toBe(
      '2026-08-20T10:00:00.000Z',
    )
    expect(newestObservation([ev('shortly')])).toBeNull()
  })

  it('is null for an empty run', () => {
    expect(newestObservation([])).toBeNull()
  })

  /**
   * The regression itself. A run whose every event was retrieved *now* but
   * published hours ago must report the publication time — the whole defect was
   * that these two are different and the wrong one was read.
   */
  it('never reports the present moment for a run of older reports', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString()
    const newest = newestObservation([ev(threeHoursAgo), ev(threeHoursAgo)])
    expect(newest).toBe(threeHoursAgo)
    expect(Date.now() - Date.parse(newest as string)).toBeGreaterThan(2 * 3_600_000)
  })
})

describe('untimedCount — why the edge can be unknown', () => {
  const ev = (observedAt: string | null) => ({ observedAt })

  it('counts the events carrying no time', () => {
    expect(untimedCount([ev(null), ev('2026-08-27T09:00:00.000Z'), ev(null)])).toBe(2)
  })

  it('counts an unparseable time as untimed', () => {
    expect(untimedCount([ev('shortly')])).toBe(1)
  })

  it('counts nothing when every event is dated', () => {
    expect(untimedCount([ev('2026-08-27T09:00:00.000Z')])).toBe(0)
  })

  /** The pair has to agree: all untimed is exactly when the edge is unknown. */
  it('agrees with newestObservation about when the edge is unknowable', () => {
    const all = [ev(null), ev('nope'), ev(null)]
    expect(untimedCount(all)).toBe(all.length)
    expect(newestObservation(all)).toBeNull()
  })
})

/**
 * Null Island, as a regression.
 *
 * The globe's point branches cast `event.lat as number` off records that the
 * ranking deliberately includes without coordinates. The cast satisfied the
 * compiler and changed nothing at runtime: `null` coerced to `0`, and ten
 * events with no location were drawn as one cluster mark labelled **10** in the
 * Gulf of Guinea — while the page's own badge read `0 of 10 on the map` and the
 * sentence under it said there was nothing to plot.
 */
describe('hasCoordinate — nothing is plotted at a guess', () => {
  it('accepts a real coordinate', () => {
    expect(hasCoordinate({ lat: 35.6, lon: 139.7 })).toBe(true)
  })

  it('rejects an event with no location rather than sending it to 0,0', () => {
    expect(hasCoordinate({ lat: null, lon: null })).toBe(false)
  })

  it('rejects a half-located event, which would plot on a meridian at random', () => {
    expect(hasCoordinate({ lat: 35.6, lon: null })).toBe(false)
    expect(hasCoordinate({ lat: null, lon: 139.7 })).toBe(false)
  })

  /**
   * The equator and the prime meridian are real places. A truthiness check —
   * the obvious shorter version — would silently refuse to draw Quito, São Tomé
   * and every event on the Greenwich line.
   */
  it('accepts zero, because 0° is a latitude and not a missing value', () => {
    expect(hasCoordinate({ lat: 0, lon: 0 })).toBe(true)
    expect(hasCoordinate({ lat: 0, lon: 6.6 })).toBe(true)
  })

  it('rejects NaN, which projects to the same fabricated place as null', () => {
    expect(hasCoordinate({ lat: Number.NaN, lon: 10 })).toBe(false)
  })

  it('rejects an infinite coordinate', () => {
    expect(hasCoordinate({ lat: Number.POSITIVE_INFINITY, lon: 10 })).toBe(false)
  })
})

/**
 * A publisher's clock can be wrong, and one wrong clock was pinning the board.
 *
 * Read from the deployed site: `newestAt` was **44.5 minutes after the sweep
 * that produced it**. Fifteen events carried future timestamps, all from one
 * outlet, spread evenly ahead of the present — a publisher stamping local time
 * as UTC, not fifteen things that had not happened yet.
 *
 * `ageWords` clamps a negative age to zero, so those rendered as "just now", and
 * because `newestObservation` takes the newest of everything, one bad clock
 * pinned the whole live edge to "just now" permanently. That is the fault fixed
 * earlier the same day arriving through a different door: then it was *our*
 * clock reported as the world's freshness, now it was a publisher's.
 */
describe('believableObservation — a future observation is a bad clock', () => {
  const NOW = Date.parse('2026-08-27T23:58:03.788Z')

  it('accepts a time in the past', () => {
    expect(believableObservation('2026-08-27T22:00:00.000Z', NOW)).toBe(true)
  })

  /** The measured case: 44.5 minutes ahead of the sweep that found it. */
  it('rejects the 44-minute lead measured in production', () => {
    expect(believableObservation('2026-08-28T00:42:33.000Z', NOW)).toBe(false)
  })

  /**
   * Not zero tolerance. Clocks disagree by seconds, and an item published a
   * moment before we read it can legitimately carry a stamp slightly ahead.
   */
  it('allows ordinary clock skew', () => {
    expect(believableObservation(new Date(NOW + 60_000).toISOString(), NOW)).toBe(true)
    expect(believableObservation(new Date(NOW + MAX_CLOCK_SKEW_MS - 1).toISOString(), NOW)).toBe(
      true,
    )
  })

  it('refuses anything past the skew allowance', () => {
    expect(believableObservation(new Date(NOW + MAX_CLOCK_SKEW_MS + 1000).toISOString(), NOW)).toBe(
      false,
    )
  })

  it('treats a missing or unparseable time as unbelievable, not as now', () => {
    expect(believableObservation(null, NOW)).toBe(false)
    expect(believableObservation('shortly', NOW)).toBe(false)
  })

  /**
   * Rejected rather than clamped. Clamping to now would hide the bad clock and
   * produce the same false "just now" — the event becomes *untimed*, which the
   * model already has a word for and which `summary.untimed` counts on screen.
   */
  it('makes a future-dated event untimed, so the count shows it', () => {
    const ev = (observedAt: string | null) => ({ observedAt })
    const future = '2026-08-28T00:42:33.000Z'
    const rejected = believableObservation(future, NOW) ? future : null
    expect(rejected).toBeNull()
    expect(untimedCount([ev(rejected)])).toBe(1)
    expect(newestObservation([ev(rejected), ev('2026-08-27T20:00:00.000Z')])).toBe(
      '2026-08-27T20:00:00.000Z',
    )
  })
})
