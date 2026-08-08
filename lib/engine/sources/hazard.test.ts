import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  gdacsAlerts,
  gdacsSeverity,
  hazardSources,
  issPosition,
  nwsAlerts,
  nwsCentroid,
  nwsSeverity,
  whoOutbreaks,
} from './hazard'

const input = { capability: 'world_events' as const, value: '' }

function ok(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response
}
function fail(): Response {
  return { ok: false, json: async () => ({}) } as unknown as Response
}

afterEach(() => vi.resetAllMocks())

describe('every hazard source is passive and declares its hosts', () => {
  it('holds the guarantee that makes the guardrail meaningful', () => {
    for (const s of hazardSources) {
      expect(s.passive, s.key).toBe(true)
      expect(s.hosts.length, s.key).toBeGreaterThan(0)
      expect(s.capability, s.key).toBe('world_events')
    }
  })
})

describe('agency-assigned severity', () => {
  it('maps the GDACS alert vocabulary', () => {
    expect(gdacsSeverity('Red')).toBe(1)
    expect(gdacsSeverity('orange')).toBeCloseTo(0.66)
    expect(gdacsSeverity('Green')).toBeCloseTo(0.33)
    expect(gdacsSeverity(null)).toBe(0)
    expect(gdacsSeverity('nonsense')).toBe(0)
  })

  it('maps the NWS severity vocabulary', () => {
    expect(nwsSeverity('Extreme')).toBe(1)
    expect(nwsSeverity('Severe')).toBe(0.75)
    expect(nwsSeverity('Moderate')).toBe(0.5)
    expect(nwsSeverity('Minor')).toBe(0.25)
    expect(nwsSeverity(undefined)).toBe(0)
  })
})

describe('gdacsAlerts', () => {
  it('carries the official alert level through as the severity', async () => {
    const ctx = {
      fetch: vi.fn(async () =>
        ok({
          features: [
            {
              properties: {
                eventtype: 'TC',
                eventname: 'Cyclone Ilsa',
                alertlevel: 'Red',
                country: 'Australia',
                fromdate: '2026-08-05T00:00:00Z',
                url: { report: 'https://gdacs.org/report/1' },
                severitydata: { severity: 185, severitytext: 'km/h' },
              },
              geometry: { type: 'Point', coordinates: [120.1, -18.2] },
            },
          ],
        }),
      ),
    }
    const [e] = await gdacsAlerts.run(input, ctx)
    expect(e.claim).toBe('Cyclone Ilsa — Red alert')
    expect(e.admiralty).toEqual({ source: 'A', info: 2 })
    const d = e.data as Record<string, unknown>
    expect(d.category).toBe('storm')
    expect(d.assignedSeverity).toBe(1)
    expect(d.lat).toBe(-18.2)
    expect(d.lon).toBe(120.1)
    expect(d.magnitude).toBe(185)
    expect(e.retrievedAt).toBe('2026-08-05T00:00:00Z')
  })

  it('drops entries with no coordinate or no name', async () => {
    const ctx = {
      fetch: vi.fn(async () =>
        ok({
          features: [
            { properties: { eventname: 'No geometry', alertlevel: 'Red' } },
            { properties: {}, geometry: { coordinates: [1, 2] } },
            { properties: { eventname: 'Bad coords' }, geometry: { coordinates: [999, 2] } },
          ],
        }),
      ),
    }
    expect(await gdacsAlerts.run(input, ctx)).toEqual([])
  })
})

describe('nwsCentroid', () => {
  it('reduces an alert polygon to one interior-ish point', () => {
    expect(
      nwsCentroid({
        type: 'Polygon',
        coordinates: [
          [
            [-100, 30],
            [-90, 30],
            [-90, 40],
            [-100, 40],
          ],
        ],
      }),
    ).toEqual([-95, 35])
  })

  it('accepts a bare point and refuses anything unusable', () => {
    expect(nwsCentroid({ type: 'Point', coordinates: [-95, 35] })).toEqual([-95, 35])
    expect(nwsCentroid(null)).toBeNull()
    expect(nwsCentroid({ coordinates: 'nope' as never })).toBeNull()
    expect(nwsCentroid({ coordinates: [] })).toBeNull()
  })
})

describe('nwsAlerts', () => {
  it('identifies itself to the agency, as the NWS requires', async () => {
    const ctx = {
      fetch: vi.fn(async (_url: string, init?: RequestInit) => {
        void init
        return ok({ features: [] })
      }),
    }
    await nwsAlerts.run(input, ctx)
    const init = ctx.fetch.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('Lambda NX')
  })

  it('maps an active warning with the agency severity', async () => {
    const ctx = {
      fetch: vi.fn(async () =>
        ok({
          features: [
            {
              properties: {
                event: 'Tornado Warning',
                headline: 'Tornado Warning issued for Cleburne County',
                severity: 'Extreme',
                urgency: 'Immediate',
                areaDesc: 'Cleburne, AL',
                effective: '2026-08-07T18:00:00Z',
                '@id': 'https://api.weather.gov/alerts/urn:oid:1',
              },
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [-86, 33],
                    [-85, 33],
                    [-85, 34],
                    [-86, 34],
                  ],
                ],
              },
            },
          ],
        }),
      ),
    }
    const [e] = await nwsAlerts.run(input, ctx)
    expect(e.claim).toContain('Tornado Warning')
    const d = e.data as Record<string, unknown>
    expect(d.assignedSeverity).toBe(1)
    expect(d.urgency).toBe('Immediate')
    expect(d.lat).toBe(33.5)
    expect(d.country).toBe('United States of America')
  })
})

describe('whoOutbreaks', () => {
  it('maps outbreak news to confirmed, unplaceable evidence', async () => {
    const ctx = {
      fetch: vi.fn(async () =>
        ok({
          value: [
            {
              Title: 'Cholera — Global situation',
              ItemDefaultUrl: '/emergencies/disease-outbreak-news/item/2026-DON001',
              PublicationDateAndTime: '2026-08-06T09:00:00Z',
            },
          ],
        }),
      ),
    }
    const [e] = await whoOutbreaks.run(input, ctx)
    expect(e.claim).toBe('Cholera — Global situation')
    expect(e.sourceUrl).toBe('https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON001')
    expect(e.admiralty).toEqual({ source: 'A', info: 2 })
    const d = e.data as Record<string, unknown>
    expect(d.category).toBe('health')
    // No coordinate: the module lists it rather than plotting a guess.
    expect(d.lat).toBeUndefined()
  })

  it('returns nothing when the feed is unavailable', async () => {
    const ctx = { fetch: vi.fn(async () => fail()) }
    expect(await whoOutbreaks.run(input, ctx)).toEqual([])
  })
})

describe('issPosition', () => {
  it('reads the published sub-satellite point rather than propagating an orbit', async () => {
    const ctx = {
      fetch: vi.fn(async () => ok({ latitude: -12.5, longitude: 44.2, altitude: 421.3, velocity: 27500 })),
    }
    const [e] = await issPosition.run(input, ctx)
    expect(e.claim).toContain('421 km')
    const d = e.data as Record<string, unknown>
    expect(d.lat).toBe(-12.5)
    expect(d.lon).toBe(44.2)
    expect(d.category).toBe('space')
  })

  it('reports nothing rather than a fabricated position', async () => {
    const ctx = { fetch: vi.fn(async () => ok({ latitude: 'x', longitude: null })) }
    expect(await issPosition.run(input, ctx)).toEqual([])
  })
})
