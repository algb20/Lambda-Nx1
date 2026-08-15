import { describe, expect, it } from 'vitest'
import { buildTimeline, severityBand, SEVERITY_BANDS } from './timeline'
import type { WorldEvent } from '../modules/world-events-shared'

const NOW = Date.parse('2026-08-15T12:00:00.000Z')
const DAY = 24 * 3600 * 1000

function event(partial: Partial<WorldEvent> & { severity: number }): WorldEvent {
  return {
    id: Math.random().toString(36),
    title: 'An event',
    category: 'world',
    categoryLabel: 'World news',
    color: '#fff',
    lat: null,
    lon: null,
    country: null,
    countryIso: null,
    magnitude: null,
    magnitudeUnit: null,
    alertLevel: null,
    at: new Date(NOW).toISOString(),
    observedAt: new Date(NOW).toISOString(),
    sourceKey: 'a_source',
    sourceUrl: null,
    independence: null,
    admiralty: null,
    confidence: 'unconfirmed',
    ...partial,
  }
}

const onDay = (daysAgo: number, severity: number, extra: Partial<WorldEvent> = {}) =>
  event({ severity, observedAt: new Date(NOW - daysAgo * DAY).toISOString(), ...extra })

describe('severityBand', () => {
  /**
   * The thresholds are anchored to the scale the engine publishes, so a reader
   * who knows GDACS reads the chart without a legend.
   */
  it('cuts where the agencies themselves cut', () => {
    expect(severityBand(0.9)).toBe('critical') // GDACS red
    expect(severityBand(0.66)).toBe('high') // GDACS orange
    expect(severityBand(0.33)).toBe('medium') // GDACS green
    expect(severityBand(0.1)).toBe('low')
  })

  /**
   * The distinction their model cannot express, and the reason this module
   * has six bands rather than five.
   */
  it('separates "no measure existed" from "measured and low"', () => {
    expect(severityBand(0)).toBe('unscored')
    expect(severityBand(0.001)).toBe('low')
    expect(severityBand(Number.NaN)).toBe('unscored')
  })
})

describe('buildTimeline', () => {
  it('buckets events onto the UTC day their source stated', () => {
    const t = buildTimeline([onDay(0, 0.9), onDay(1, 0.7), onDay(1, 0.2)], { days: 7, now: NOW })
    expect(t.days).toHaveLength(7)
    expect(t.days[6].counts.critical).toBe(1)
    expect(t.days[5].counts.high).toBe(1)
    expect(t.days[5].counts.low).toBe(1)
    expect(t.days[5].total).toBe(2)
  })

  /**
   * A gap means either a quiet day or a day we failed to collect. Closing it
   * silently turns an outage into a smooth line.
   */
  it('keeps empty days rather than skipping them', () => {
    const t = buildTimeline([onDay(0, 0.9)], { days: 5, now: NOW })
    expect(t.days).toHaveLength(5)
    expect(t.days.slice(0, 4).every((d) => d.total === 0)).toBe(true)
    expect(t.activeDays).toBe(1)
  })

  it('drops events outside the window instead of piling them on the edge', () => {
    // Clamping a 40-day-old report onto day one would invent a spike.
    const t = buildTimeline([onDay(40, 0.95), onDay(0, 0.95)], { days: 7, now: NOW })
    expect(t.days.reduce((n, d) => n + d.total, 0)).toBe(1)
  })

  it('counts independent origins per day, so echo is visible', () => {
    const t = buildTimeline(
      [
        onDay(0, 0.5, { independence: 'wire_a' }),
        onDay(0, 0.5, { independence: 'wire_a' }),
        onDay(0, 0.5, { independence: 'wire_a' }),
        onDay(0, 0.5, { independence: 'agency_b' }),
      ],
      { days: 3, now: NOW },
    )
    const today = t.days[2]
    expect(today.total).toBe(4)
    // Four reports, two origins. A chart plotting only volume would call this
    // a busy day.
    expect(today.origins).toBe(2)
  })

  it('falls back to the source key when a source declares no group', () => {
    const t = buildTimeline(
      [onDay(0, 0.5, { sourceKey: 'x' }), onDay(0, 0.5, { sourceKey: 'y' })],
      { days: 3, now: NOW },
    )
    expect(t.days[2].origins).toBe(2)
  })

  it('reports how many events are dated only by our own receipt', () => {
    const t = buildTimeline(
      [
        event({ severity: 0.5, observedAt: null, at: new Date(NOW).toISOString() }),
        onDay(0, 0.5),
      ],
      { days: 3, now: NOW },
    )
    expect(t.days[2].receiptDated).toBe(1)
    expect(t.verdict).toContain('placed by when we received them')
  })

  it('counts scored events apart from the total', () => {
    const t = buildTimeline([onDay(0, 0.9), onDay(0, 0), onDay(0, 0)], { days: 3, now: NOW })
    expect(t.days[2].total).toBe(3)
    expect(t.days[2].scored).toBe(1)
    expect(t.days[2].counts.unscored).toBe(2)
  })
})

describe('the trend', () => {
  const heavy = (daysAgo: number, n: number) =>
    Array.from({ length: n }, () => onDay(daysAgo, 0.95))

  it('reads worsening when the recent half carries more serious events', () => {
    const t = buildTimeline([...heavy(5, 1), ...heavy(1, 6)], { days: 6, now: NOW })
    expect(t.trend).toBe('worsening')
  })

  it('reads easing when the earlier half did', () => {
    const t = buildTimeline([...heavy(5, 6), ...heavy(1, 1)], { days: 6, now: NOW })
    expect(t.trend).toBe('easing')
  })

  it('reads steady for ordinary variation rather than calling every wobble', () => {
    const t = buildTimeline([...heavy(5, 4), ...heavy(1, 4)], { days: 6, now: NOW })
    expect(t.trend).toBe('steady')
  })

  /**
   * "Steady at zero" would imply we measured something and it held. We did not.
   */
  it('says insufficient when nothing serious happened in either half', () => {
    const t = buildTimeline([onDay(1, 0), onDay(5, 0.1)], { days: 6, now: NOW })
    expect(t.trend).toBe('insufficient')
  })

  it('says insufficient rather than guessing from too few days', () => {
    expect(buildTimeline([onDay(0, 0.9)], { days: 3, now: NOW }).trend).toBe('insufficient')
  })

  /**
   * Volume is the wrong measure: a feed publishing its backlog would read as a
   * crisis, and unscored events cannot move a severity trend without asserting
   * a severity nobody measured.
   */
  it('is not moved by a flood of unscored events', () => {
    const flood = Array.from({ length: 200 }, () => onDay(1, 0))
    const t = buildTimeline([...heavy(5, 3), ...heavy(1, 3), ...flood], { days: 6, now: NOW })
    expect(t.trend).toBe('steady')
  })
})

describe('the verdict', () => {
  it('calls an empty window a collection failure, not a quiet world', () => {
    const t = buildTimeline([], { days: 7, now: NOW })
    expect(t.verdict).toContain('collection failure')
  })

  it('states how many events carry no severity measure at all', () => {
    const t = buildTimeline([onDay(0, 0.9), onDay(0, 0)], { days: 7, now: NOW })
    expect(t.verdict).toContain('no severity measure')
    expect(t.verdict).toContain('counted apart rather than as low')
  })

  it('reports the critical and high count the header shows', () => {
    const t = buildTimeline([onDay(0, 0.95), onDay(1, 0.7), onDay(2, 0.1)], { days: 7, now: NOW })
    expect(t.criticalHigh).toBe(2)
    expect(t.verdict).toContain('2 critical or high')
  })
})

describe('the band table', () => {
  it('gives every band a label and a colour, so the legend cannot disagree', () => {
    for (const b of SEVERITY_BANDS) {
      expect(b.label.length).toBeGreaterThan(0)
      expect(b.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('is ordered most-severe-first, which severityBand relies on', () => {
    const mins = SEVERITY_BANDS.map((b) => b.min)
    expect([...mins].sort((a, b) => b - a)).toEqual(mins)
  })
})
