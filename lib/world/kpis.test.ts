import { describe, expect, it } from 'vitest'
import {
  ageWords,
  buildKpis,
  CATALOGUE_SIZE,
  DEAD_AFTER_MS,
  STALE_AFTER_MS,
  type Kpi,
} from './kpis'
import type { WorldEventsReport } from '@/lib/modules/world-events-shared'

const NOW = Date.parse('2026-08-27T12:00:00.000Z')
const agoMs = (ms: number) => new Date(NOW - ms).toISOString()

/**
 * A report with nothing wrong with it. Each test bends one field, so a failure
 * names the field rather than the fixture.
 */
function report(over: Partial<WorldEventsReport> = {}): WorldEventsReport {
  return {
    generatedAt: agoMs(0),
    events: [],
    unplaceable: [],
    categories: [
      { category: 'seismic', label: 'Earthquake', color: '#f97316', count: 12 },
      { category: 'flood', label: 'Flood', color: '#3b82f6', count: 3 },
      { category: 'cyber', label: 'Cyber', color: '#8b5cf6', count: 0 },
    ],
    regions: [],
    hotspots: [],
    sourceHealth: [],
    timeline: { days: [], bands: [] },
    fused: [],
    fusion: {
      signals: 40,
      events: 30,
      corroborated: 18,
      contested: 0,
      duplicatesRemoved: 10,
    },
    coverage: [],
    coverageSummary: {
      dark: 0,
      thin: 2,
      quiet: 4,
      active: 6,
      trustworthyRegions: 10,
      totalRegions: 12,
    },
    summary: {
      total: 20,
      placed: 15,
      newestAt: agoMs(30 * 60_000),
      untimed: 0,
      sources: [],
      sourcesOk: 9,
      sourcesEmpty: 2,
      sourcesFailed: 0,
    },
    ...over,
  } as WorldEventsReport
}

const byKey = (kpis: Kpi[], key: string): Kpi => {
  const found = kpis.find((k) => k.key === key)
  if (!found) throw new Error(`no KPI "${key}"`)
  return found
}

describe('age in words', () => {
  it('says "just now" below a minute rather than "0m ago"', () => {
    expect(ageWords(30_000)).toBe('just now')
  })

  it('counts minutes below an hour', () => {
    expect(ageWords(45 * 60_000)).toBe('45m ago')
  })

  it('counts hours up to two days, so "36h" is not rounded to "1d"', () => {
    // A day and a half of lag is a fact an operator acts on. Rounded to "1d" it
    // reads as the same staleness as 25 hours, which it is not.
    expect(ageWords(36 * 3_600_000)).toBe('36h ago')
  })

  it('counts days beyond two', () => {
    expect(ageWords(72 * 3_600_000)).toBe('3d ago')
  })

  /**
   * Deliberately coarse. Minutes inside an hours-old figure claim a precision
   * the publisher's own rounded timestamp does not have.
   */
  it('never quotes minutes alongside hours', () => {
    expect(ageWords(2 * 3_600_000 + 14 * 60_000)).toBe('2h ago')
  })
})

describe('the live edge is the observation, not the fetch', () => {
  it('reads good while the newest observation is fresh', () => {
    expect(byKey(buildKpis(report(), NOW), 'edge').tone).toBe('good')
  })

  it('warns once the newest observation passes the stale line', () => {
    const r = report()
    r.summary.newestAt = agoMs(STALE_AFTER_MS + 60_000)
    expect(byKey(buildKpis(r, NOW), 'edge').tone).toBe('warn')
  })

  it('calls it bad past a day, which is an outage rather than a lag', () => {
    const r = report()
    r.summary.newestAt = agoMs(DEAD_AFTER_MS + 60_000)
    expect(byKey(buildKpis(r, NOW), 'edge').tone).toBe('bad')
  })

  /**
   * The failure this figure exists to prevent: a board that refreshed a second
   * ago showing a picture from yesterday, with a green dot for the fetch.
   * `generatedAt` is deliberately *now* here and the tone is still bad.
   */
  it('ignores how recently we fetched', () => {
    const r = report({ generatedAt: agoMs(0) })
    r.summary.newestAt = agoMs(DEAD_AFTER_MS + 3_600_000)
    const edge = byKey(buildKpis(r, NOW), 'edge')
    expect(edge.tone).toBe('bad')
    // Twenty-five hours, and still counted in hours rather than rounded to
    // "1d" — that is the threshold above, not an accident of this fixture.
    expect(edge.value).toBe('25h ago')
  })

  it('says it cannot be known rather than showing zero', () => {
    const r = report()
    r.summary.newestAt = null
    const edge = byKey(buildKpis(r, NOW), 'edge')
    expect(edge.value).toBe('—')
    expect(edge.tone).toBe('warn')
    expect(edge.detail).toContain('cannot be established')
  })

  it('names how many events could not be aged, so "—" is explicable', () => {
    const r = report()
    r.summary.newestAt = null
    r.summary.untimed = 10
    expect(byKey(buildKpis(r, NOW), 'edge').detail).toContain('all 10 events arrived undated')
  })

  it('says how many are excluded when only some carry a time', () => {
    const r = report()
    r.summary.untimed = 3
    expect(byKey(buildKpis(r, NOW), 'edge').detail).toContain('3 events in this run carry no')
  })

  it('treats an unparseable timestamp as unknown, not as 1970', () => {
    const r = report()
    r.summary.newestAt = 'not a date'
    expect(byKey(buildKpis(r, NOW), 'edge').value).toBe('—')
  })
})

describe('a refused feed is not an empty one', () => {
  it('reads good when every feed answered', () => {
    expect(byKey(buildKpis(report(), NOW), 'feeds').tone).toBe('good')
  })

  /**
   * The measured production fault, as an assertion. `/api/chain` reported
   * 13 sources OK and 0 failed over an empty board, because refusals were being
   * returned as empty lists. Now a refusal reaches the strip.
   */
  it('warns as soon as one feed refuses, even with plenty answering', () => {
    const r = report()
    r.summary.sourcesFailed = 1
    const feeds = byKey(buildKpis(r, NOW), 'feeds')
    expect(feeds.tone).toBe('warn')
    expect(feeds.detail).toContain('1 refused')
  })

  it('calls it bad when nothing answered with data at all', () => {
    const r = report()
    r.summary.sourcesOk = 0
    r.summary.sourcesFailed = 4
    expect(byKey(buildKpis(r, NOW), 'feeds').tone).toBe('bad')
  })

  it('counts refusals inside the denominator, so the ratio is honest', () => {
    const r = report()
    r.summary.sourcesOk = 9
    r.summary.sourcesEmpty = 2
    r.summary.sourcesFailed = 3
    // 9 of 14 — not 9 of 11, which would hide the refusals from the ratio too.
    expect(byKey(buildKpis(r, NOW), 'feeds').unit).toBe('of 14')
  })

  it('names an empty answer as the world being quiet, not as a fault', () => {
    const feeds = byKey(buildKpis(report(), NOW), 'feeds')
    expect(feeds.detail).toContain('None refused')
  })
})

describe('events that could not be placed are stated, not dropped', () => {
  it('shows placed against the true total', () => {
    const placed = byKey(buildKpis(report(), NOW), 'placed')
    expect(placed.value).toBe('15')
    expect(placed.unit).toBe('of 20')
  })

  it('names how many arrived with no coordinate', () => {
    expect(byKey(buildKpis(report(), NOW), 'placed').detail).toContain('5 events')
  })

  /**
   * Events held but none drawable is the exact state that reads as "nothing is
   * happening" on every map that does not say otherwise.
   */
  it('calls it bad when events exist and none could be drawn', () => {
    const r = report()
    r.summary.placed = 0
    expect(byKey(buildKpis(r, NOW), 'placed').tone).toBe('bad')
  })

  it('stays neutral on a genuinely empty run', () => {
    const r = report()
    r.summary.total = 0
    r.summary.placed = 0
    expect(byKey(buildKpis(r, NOW), 'placed').tone).toBe('neutral')
  })
})

describe('corroboration is counted in origins', () => {
  it('reads good at half the events or better with nothing contested', () => {
    expect(byKey(buildKpis(report(), NOW), 'corroboration').tone).toBe('good')
  })

  it('warns when sources disagree, however well corroborated the rest is', () => {
    const r = report()
    r.fusion.contested = 2
    const k = byKey(buildKpis(r, NOW), 'corroboration')
    expect(k.tone).toBe('warn')
    expect(k.detail).toContain('2 events are contested')
  })

  it('says origins rather than reports, since that is the whole claim', () => {
    expect(byKey(buildKpis(report(), NOW), 'corroboration').detail).toContain(
      'independent origins',
    )
  })
})

describe('the regions we cannot see into', () => {
  it('adds dark and thin together, since neither can be trusted as quiet', () => {
    const k = byKey(buildKpis(report(), NOW), 'blind')
    expect(k.value).toBe('2')
    expect(k.unit).toBe('of 12')
  })

  it('warns as soon as one region is fully dark', () => {
    const r = report()
    r.coverageSummary.dark = 1
    expect(byKey(buildKpis(r, NOW), 'blind').tone).toBe('warn')
  })

  it('reads good when nothing is dark, even with thin coverage', () => {
    expect(byKey(buildKpis(report(), NOW), 'blind').tone).toBe('good')
  })

  it('says silence there is not calm', () => {
    const r = report()
    r.coverageSummary.dark = 3
    expect(byKey(buildKpis(r, NOW), 'blind').detail).toContain('not calm')
  })
})

describe('categories reporting', () => {
  it('counts only categories with an event, against the whole catalogue', () => {
    const k = byKey(buildKpis(report(), NOW), 'categories')
    // Two of the three fixture categories carry a count; `cyber` is silent.
    expect(k.value).toBe('2')
    expect(k.unit).toBe(`of ${CATALOGUE_SIZE} kinds`)
  })

  it('has a catalogue large enough to be worth stating', () => {
    expect(CATALOGUE_SIZE).toBeGreaterThan(20)
  })
})

describe('the strip as a whole', () => {
  it('never divides by zero on an empty report', () => {
    const empty = report({
      categories: [],
      fusion: { signals: 0, events: 0, corroborated: 0, contested: 0, duplicatesRemoved: 0 },
      coverageSummary: {
        dark: 0,
        thin: 0,
        quiet: 0,
        active: 0,
        trustworthyRegions: 0,
        totalRegions: 0,
      },
      summary: {
        total: 0,
        placed: 0,
        newestAt: null,
        untimed: 0,
        sources: [],
        sourcesOk: 0,
        sourcesEmpty: 0,
        sourcesFailed: 0,
      },
    })
    const kpis = buildKpis(empty, NOW)
    for (const k of kpis) {
      expect(k.value, k.key).not.toContain('NaN')
      expect(k.unit ?? '', k.key).not.toContain('NaN')
      expect(k.detail, k.key).not.toContain('NaN')
    }
  })

  it('gives every figure a sentence a reader can hold it to', () => {
    for (const k of buildKpis(report(), NOW)) {
      expect(k.detail.length, k.key).toBeGreaterThan(40)
      expect(k.label.length, k.key).toBeLessThanOrEqual(14)
    }
  })

  it('keeps the keys stable, since the strip is laid out by key', () => {
    expect(buildKpis(report(), NOW).map((k) => k.key)).toEqual([
      'placed',
      'edge',
      'feeds',
      'corroboration',
      'blind',
      'categories',
    ])
  })
})
