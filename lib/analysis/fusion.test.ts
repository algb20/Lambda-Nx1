import { describe, it, expect } from 'vitest'
import {
  couldBeSameEvent,
  findContradictions,
  fuseEvents,
  fusedId,
  fusionSummary,
  haversineKm,
  signalTime,
  type Signal,
} from './fusion'

/**
 * Fusion is the one place in this system where information can be destroyed.
 * A wrong merge turns two events into one and the second is simply gone; a
 * missed merge leaves a visible duplicate somebody can fix. Every test here
 * exists because of that asymmetry.
 */
const AT = '2026-08-14T03:00:00.000Z'

function signal(over: Partial<Signal> = {}): Signal {
  return {
    id: `s${Math.random()}`,
    title: 'M5.2 near Somewhere',
    independence: 'usgs',
    sourceKey: 'usgs_quakes_hour',
    admiralty: { source: 'A', info: 2 },
    lat: 40.0,
    lon: 30.0,
    observedAt: AT,
    receivedAt: AT,
    magnitude: 5.2,
    ...over,
  }
}

describe('haversineKm', () => {
  it('measures a known distance', () => {
    // London to Paris is ~344 km.
    const d = haversineKm(51.5074, -0.1278, 48.8566, 2.3522)
    expect(d).toBeGreaterThan(330)
    expect(d).toBeLessThan(360)
  })

  it('is zero for one point and symmetric between two', () => {
    expect(haversineKm(10, 20, 10, 20)).toBe(0)
    expect(haversineKm(10, 20, 30, 40)).toBeCloseTo(haversineKm(30, 40, 10, 20), 6)
  })
})

describe('signalTime', () => {
  it('prefers when it happened over when we received it', () => {
    const s = signal({ observedAt: '2026-08-14T01:00:00Z', receivedAt: '2026-08-14T05:00:00Z' })
    expect(signalTime(s)).toBe(Date.parse('2026-08-14T01:00:00Z'))
  })

  it('falls back to receipt only when no observation time exists', () => {
    const s = signal({ observedAt: null, receivedAt: '2026-08-14T05:00:00Z' })
    expect(signalTime(s)).toBe(Date.parse('2026-08-14T05:00:00Z'))
  })
})

describe('couldBeSameEvent', () => {
  it('joins two reports close in space and time', () => {
    const a = signal({ independence: 'usgs' })
    const b = signal({ independence: 'emsc', lat: 40.3, lon: 30.2 })
    expect(couldBeSameEvent(a, b)).toBe(true)
  })

  it('refuses reports far apart in space', () => {
    expect(couldBeSameEvent(signal(), signal({ lat: 10, lon: 10 }))).toBe(false)
  })

  it('refuses reports far apart in time', () => {
    const later = signal({ observedAt: '2026-08-15T22:00:00.000Z' })
    expect(couldBeSameEvent(signal(), later)).toBe(false)
  })

  it('never fuses on time alone when a coordinate is missing', () => {
    // "Something happened somewhere in the last six hours" describes most of
    // the news. Fusing on it would collapse unrelated events into one cluster
    // that then reads as heavily corroborated.
    const placed = signal()
    const unplaced = signal({ lat: null, lon: null, independence: 'reuters' })
    expect(couldBeSameEvent(placed, unplaced)).toBe(false)
    expect(couldBeSameEvent(unplaced, unplaced)).toBe(false)
  })
})

describe('fusedId', () => {
  it('is stable for the same event across runs', () => {
    // An alert needs to know "this is the event you were already watching".
    const first = fusedId(40.0, 30.0, Date.parse(AT))
    const laterInSameHour = fusedId(40.001, 30.001, Date.parse(AT) + 60_000)
    expect(first).toBe(laterInSameHour)
  })

  it('separates events far enough apart', () => {
    expect(fusedId(40, 30, Date.parse(AT))).not.toBe(fusedId(50, 30, Date.parse(AT)))
  })

  it('marks an unplaced event rather than inventing a coordinate', () => {
    expect(fusedId(null, null, Date.parse(AT))).toContain('unplaced')
  })
})

describe('fuseEvents', () => {
  it('collapses many reports of one event into one', () => {
    const reports = [
      signal({ independence: 'usgs' }),
      signal({ independence: 'emsc', lat: 40.2 }),
      signal({ independence: 'reuters', lat: 40.1, magnitude: null, admiralty: { source: 'B', info: 3 } }),
    ]
    const events = fuseEvents(reports)
    expect(events).toHaveLength(1)
    expect(events[0].signals).toHaveLength(3)
    expect(events[0].independentSources).toBe(3)
  })

  it('counts origins, not reports', () => {
    // Twenty outlets on one wire is one confirmation. This is the whole point.
    const wire = Array.from({ length: 20 }, () => signal({ independence: 'ap', admiralty: { source: 'B', info: 3 } }))
    const [event] = fuseEvents(wire)
    expect(event.signals).toHaveLength(20)
    expect(event.independentSources).toBe(1)
  })

  it('keeps genuinely separate events apart', () => {
    const events = fuseEvents([signal(), signal({ lat: -20, lon: -60, independence: 'emsc' })])
    expect(events).toHaveLength(2)
  })

  it('takes the earliest observation as when it happened', () => {
    const events = fuseEvents([
      signal({ observedAt: '2026-08-14T03:00:00.000Z' }),
      signal({ independence: 'emsc', observedAt: '2026-08-14T02:30:00.000Z' }),
    ])
    // An event is identified by when the world moved, not when we heard.
    expect(events[0].observedAt).toBe('2026-08-14T02:30:00.000Z')
  })

  it('takes the latest receipt as when our picture last changed', () => {
    const events = fuseEvents([
      signal({ receivedAt: '2026-08-14T03:00:00.000Z' }),
      signal({ independence: 'emsc', receivedAt: '2026-08-14T04:00:00.000Z' }),
    ])
    expect(events[0].lastReceivedAt).toBe('2026-08-14T04:00:00.000Z')
  })

  it('presents the best-rated source’s version', () => {
    const events = fuseEvents([
      signal({ independence: 'blog', title: 'Big quake somewhere!', admiralty: { source: 'D', info: 4 } }),
      signal({ independence: 'usgs', title: 'M5.2 - 14km NE of Somewhere', admiralty: { source: 'A', info: 2 } }),
    ])
    expect(events[0].title).toBe('M5.2 - 14km NE of Somewhere')
  })

  it('leaves an unplaced report as its own event rather than absorbing it', () => {
    const events = fuseEvents([signal(), signal({ lat: null, lon: null, independence: 'reliefweb' })])
    expect(events).toHaveLength(2)
    expect(events.some((e) => e.lat === null)).toBe(true)
  })

  it('handles an empty input', () => {
    expect(fuseEvents([])).toEqual([])
  })
})

describe('findContradictions', () => {
  it('reports a location disagreement between origins', () => {
    // Silently taking the majority would hide the one fact a reader most needs.
    const found = findContradictions([
      signal({ independence: 'usgs', lat: 40.0 }),
      signal({ independence: 'emsc', lat: 40.7 }),
    ])
    expect(found).toHaveLength(1)
    expect(found[0].field).toBe('location')
    expect(found[0].between).toEqual(expect.arrayContaining(['usgs', 'emsc']))
  })

  it('reports a magnitude disagreement', () => {
    const found = findContradictions([
      signal({ independence: 'usgs', magnitude: 5.2 }),
      signal({ independence: 'emsc', magnitude: 6.1 }),
    ])
    expect(found.some((c) => c.field === 'magnitude')).toBe(true)
  })

  it('stays quiet when sources agree within normal variation', () => {
    // Two agencies naming different nearby settlements is not a disagreement.
    expect(
      findContradictions([
        signal({ independence: 'usgs', magnitude: 5.2, lat: 40.0 }),
        signal({ independence: 'emsc', magnitude: 5.3, lat: 40.05 }),
      ]),
    ).toEqual([])
  })

  it('says nothing about a single source', () => {
    expect(findContradictions([signal()])).toEqual([])
  })
})

describe('fusionSummary', () => {
  it('reports how much was collapsed, so the count is not mistaken for less coverage', () => {
    const signals = [
      signal({ independence: 'usgs' }),
      signal({ independence: 'emsc', lat: 40.2 }),
      signal({ independence: 'jma', lat: -20, lon: -60 }),
    ]
    const summary = fusionSummary(signals, fuseEvents(signals))
    expect(summary.signals).toBe(3)
    expect(summary.events).toBe(2)
    expect(summary.duplicatesRemoved).toBe(1)
    expect(summary.corroborated).toBe(1)
  })

  it('counts contested events separately from corroborated ones', () => {
    const signals = [
      signal({ independence: 'usgs', magnitude: 5.0 }),
      signal({ independence: 'emsc', magnitude: 6.5, lat: 40.1 }),
    ]
    const summary = fusionSummary(signals, fuseEvents(signals))
    expect(summary.corroborated).toBe(1)
    expect(summary.contested).toBe(1)
  })
})
