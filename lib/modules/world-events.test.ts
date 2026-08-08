import { describe, it, expect } from 'vitest'
import {
  CATEGORY_META,
  REGION_LABEL,
  dedupeEvents,
  operationalScore,
  regionOf,
  severityOf,
  type WorldEvent,
} from './world-events'

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
    sourceKey: 'usgs_recent',
    sourceUrl: null,
    admiralty: { source: 'A', info: 1 },
    confidence: 'confirmed',
    ...over,
  }
}

describe('severityOf', () => {
  it('scales earthquake magnitude across the feed range', () => {
    expect(severityOf('seismic', 2.5, null)).toBe(0)
    expect(severityOf('seismic', 5, null)).toBeCloseTo(0.5, 2)
    expect(severityOf('seismic', 7.5, null)).toBe(1)
    // Above the saturation point it stays at the top rather than exceeding it.
    expect(severityOf('seismic', 9.1, null)).toBe(1)
  })

  it('scales fire area logarithmically and converts km² to acres', () => {
    const small = severityOf('wildfire', 100, 'acres')
    const large = severityOf('wildfire', 500_000, 'acres')
    expect(large).toBeGreaterThan(small)
    expect(large).toBeLessThanOrEqual(1)
    // The same real area must score the same whichever unit it arrived in.
    expect(severityOf('wildfire', 404.7, 'km²')).toBeCloseTo(severityOf('wildfire', 100_000, 'acres'), 2)
  })

  it('never invents a severity where nothing was measured', () => {
    expect(severityOf('humanitarian', null, null)).toBe(0)
    expect(severityOf('world', null, null)).toBe(0)
    expect(severityOf('storm', null, null)).toBe(0)
    expect(severityOf('flood', 5, 'metres')).toBe(0)
  })

  it('floors a tsunami alert high regardless of magnitude', () => {
    expect(severityOf('seismic', 3, null, true)).toBeGreaterThanOrEqual(0.9)
    // …but never drags a bigger measured value down.
    expect(severityOf('seismic', 9, null, true)).toBe(1)
  })
})

describe('dedupeEvents', () => {
  it('collapses the same event reported at the same place by two feeds', () => {
    const merged = dedupeEvents([
      event({ id: 'a', sourceKey: 'usgs_recent', admiralty: { source: 'A', info: 1 } }),
      event({ id: 'b', sourceKey: 'gdelt', admiralty: { source: 'C', info: 3 } }),
    ])
    expect(merged).toHaveLength(1)
    // The instrument reading survives, not the headline about it.
    expect(merged[0].sourceKey).toBe('usgs_recent')
  })

  it('keeps genuinely different events apart', () => {
    const merged = dedupeEvents([
      event({ id: 'a', lat: 10, lon: 20 }),
      event({ id: 'b', lat: 40, lon: 20 }),
      event({ id: 'c', lat: 10, lon: 20, category: 'wildfire' }),
    ])
    expect(merged).toHaveLength(3)
  })

  it('dedupes unplaceable events by title instead of dropping them', () => {
    const merged = dedupeEvents([
      event({ id: 'a', lat: null, lon: null, title: 'Summit concludes' }),
      event({ id: 'b', lat: null, lon: null, title: 'Summit concludes' }),
      event({ id: 'c', lat: null, lon: null, title: 'Something else' }),
    ])
    expect(merged).toHaveLength(2)
  })
})

describe('CATEGORY_META', () => {
  it('gives every category a label and a colour the legend can render', () => {
    for (const [key, meta] of Object.entries(CATEGORY_META)) {
      expect(meta.label.length, key).toBeGreaterThan(0)
      expect(meta.color, key).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('does not reuse one colour for two categories, which would make the map unreadable', () => {
    const colors = Object.values(CATEGORY_META).map((m) => m.color.toLowerCase())
    expect(new Set(colors).size).toBe(colors.length)
  })
})

describe('operationalScore — the board has to look live', () => {
  it('ranks a fresh event above an equally severe old one', () => {
    const now = Date.parse('2026-08-07T12:00:00Z')
    const fresh = event({ severity: 0.8, at: '2026-08-07T11:00:00Z' })
    const old = event({ severity: 0.8, at: '2026-08-01T11:00:00Z' })
    expect(operationalScore(fresh, now)).toBeGreaterThan(operationalScore(old, now))
  })

  it('still puts a big fresh event above a small fresh one', () => {
    const now = Date.parse('2026-08-07T12:00:00Z')
    const big = event({ severity: 0.9, at: '2026-08-07T11:00:00Z' })
    const small = event({ severity: 0.1, at: '2026-08-07T11:00:00Z' })
    expect(operationalScore(big, now)).toBeGreaterThan(operationalScore(small, now))
  })

  it('keeps a very recent zero-severity event on the board at all', () => {
    const now = Date.parse('2026-08-07T12:00:00Z')
    expect(operationalScore(event({ severity: 0, at: '2026-08-07T11:59:00Z' }), now)).toBeGreaterThan(0)
  })

  it('halves the score roughly every 72 hours', () => {
    const now = Date.parse('2026-08-07T12:00:00Z')
    const nowEvt = event({ severity: 0.95, at: '2026-08-07T12:00:00Z' })
    const later = event({ severity: 0.95, at: '2026-08-04T12:00:00Z' })
    expect(operationalScore(later, now) / operationalScore(nowEvt, now)).toBeCloseTo(0.5, 2)
  })

  it('does not blow up on an unparseable timestamp', () => {
    expect(Number.isFinite(operationalScore(event({ at: 'not a date' })))).toBe(true)
  })
})

describe('regionOf', () => {
  it('places well-known coordinates in the region an operator expects', () => {
    expect(regionOf(40.7, -74)).toBe('americas') // New York
    expect(regionOf(48.85, 2.35)).toBe('europe') // Paris
    expect(regionOf(-1.3, 36.8)).toBe('africa') // Nairobi
    expect(regionOf(24.7, 46.7)).toBe('middle-east') // Riyadh
    expect(regionOf(35.7, 139.7)).toBe('asia-pacific') // Tokyo
    expect(regionOf(-77, 166)).toBe('polar') // McMurdo
  })

  it('gives every coordinate exactly one region', () => {
    for (let lat = -85; lat <= 85; lat += 17) {
      for (let lon = -175; lon <= 175; lon += 35) {
        expect(REGION_LABEL[regionOf(lat, lon)], `${lat},${lon}`).toBeTruthy()
      }
    }
  })
})
