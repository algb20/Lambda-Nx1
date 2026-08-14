import { describe, it, expect, vi, afterEach } from 'vitest'
import { eonetCoordinate, nasaEonet, usgsRecentQuakes } from './world-events'

const ctx = { fetch: vi.fn() }

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response
}

afterEach(() => vi.resetAllMocks())

describe('eonetCoordinate', () => {
  it('reads a Point', () => {
    expect(eonetCoordinate({ type: 'Point', coordinates: [-120.5, 39.2] })).toEqual([-120.5, 39.2])
  })

  it('averages a Polygon ring into one plottable point', () => {
    const polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [10, 0],
          [20, 0],
          [20, 10],
          [10, 10],
        ],
      ],
    }
    expect(eonetCoordinate(polygon)).toEqual([15, 5])
  })

  it('refuses malformed geometry rather than defaulting to null island', () => {
    expect(eonetCoordinate(undefined)).toBeNull()
    expect(eonetCoordinate({ coordinates: 'nope' as never })).toBeNull()
    expect(eonetCoordinate({ coordinates: [999, 0] })).toBeNull()
    expect(eonetCoordinate({ coordinates: [null, null] as never })).toBeNull()
    expect(eonetCoordinate({ coordinates: [] })).toBeNull()
  })
})

describe('nasaEonet', () => {
  it('is a passive, keyless source on its declared host', () => {
    expect(nasaEonet.passive).toBe(true)
    expect(nasaEonet.hosts).toEqual(['eonet.gsfc.nasa.gov'])
    expect(nasaEonet.capability).toBe('world_events')
  })

  it('maps open events to graded, geolocated evidence', async () => {
    ctx.fetch.mockResolvedValue(
      jsonResponse({
        events: [
          {
            id: 'EONET_1',
            title: 'Wildfire - Sierra',
            link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1',
            categories: [{ id: 'wildfires', title: 'Wildfires' }],
            sources: [{ id: 'InciWeb', url: 'https://inciweb.example/1' }],
            geometry: [
              { date: '2026-08-01T00:00:00Z', type: 'Point', coordinates: [-100, 20] },
              {
                date: '2026-08-05T00:00:00Z',
                type: 'Point',
                coordinates: [-120.5, 39.2],
                magnitudeValue: 12000,
                magnitudeUnit: 'acres',
              },
            ],
          },
        ],
      }),
    )
    const [ev] = await nasaEonet.run({ capability: 'world_events', value: '' }, ctx)
    expect(ev.claim).toBe('Wildfire - Sierra')
    expect(ev.sourceKey).toBe('nasa_eonet')
    // The reporting observatory is preferred over the API record.
    expect(ev.sourceUrl).toBe('https://inciweb.example/1')
    expect(ev.admiralty).toEqual({ source: 'A', info: 2 })
    const data = ev.data as Record<string, unknown>
    // The most recent observation wins — a moving event must plot where it is now.
    expect(data.lat).toBe(39.2)
    expect(data.lon).toBe(-120.5)
    expect(data.category).toBe('wildfire')
    expect(data.magnitude).toBe(12000)
    // The observatory's own date is the publication time; `retrievedAt` is when
    // we asked. Writing the former into the latter is the bug that left every
    // event on the live board undateable.
    expect(ev.publishedAt).toBe('2026-08-05T00:00:00.000Z')
    expect(ev.retrievedAt).not.toBe('2026-08-05T00:00:00Z')
    expect(Date.now() - Date.parse(ev.retrievedAt)).toBeLessThan(5000)
  })

  it('says a date is missing rather than stamping the fetch time on it', async () => {
    ctx.fetch.mockResolvedValue(
      jsonResponse({
        events: [
          {
            id: 'x',
            title: 'Undated fire',
            categories: [{ id: 'wildfires' }],
            geometry: [{ type: 'Point', coordinates: [10, 20] }],
          },
        ],
      }),
    )
    const [ev] = await nasaEonet.run({ capability: 'world_events', value: '' }, ctx)
    expect(ev.publishedAt).toBeNull()
  })

  it('drops events it cannot place instead of guessing a coordinate', async () => {
    ctx.fetch.mockResolvedValue(
      jsonResponse({
        events: [
          { id: 'a', title: 'No geometry at all', categories: [{ id: 'floods' }] },
          { id: 'b', title: 'Bad coords', geometry: [{ coordinates: [500, 500] }] },
          { id: 'c', geometry: [{ coordinates: [1, 1] }] },
        ],
      }),
    )
    expect(await nasaEonet.run({ capability: 'world_events', value: '' }, ctx)).toEqual([])
  })

  /**
   * A provider we could not reach must surface as a failure, not as "no events".
   * Swallowing it showed a green light on the Source Integrity panel for a feed
   * that had been blind all day.
   */
  it('reports a failed or unparseable response instead of an empty day', async () => {
    ctx.fetch.mockResolvedValue(jsonResponse({}, false))
    await expect(nasaEonet.run({ capability: 'world_events', value: '' }, ctx)).rejects.toThrow(
      /nasa_eonet/,
    )
    ctx.fetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)
    await expect(nasaEonet.run({ capability: 'world_events', value: '' }, ctx)).rejects.toThrow(
      /not JSON/,
    )
  })

  it('still returns an empty list when the feed genuinely has no open events', async () => {
    ctx.fetch.mockResolvedValue(jsonResponse({ events: [] }))
    expect(await nasaEonet.run({ capability: 'world_events', value: '' }, ctx)).toEqual([])
  })
})

describe('usgsRecentQuakes', () => {
  it('maps the GeoJSON feed to instrument-grade evidence', async () => {
    ctx.fetch.mockResolvedValue(
      jsonResponse({
        features: [
          {
            properties: {
              mag: 5.4,
              place: '20km S of Somewhere',
              time: 1_780_000_000_000,
              url: 'https://earthquake.usgs.gov/e/1',
              title: 'M 5.4 - 20km S of Somewhere',
              tsunami: 1,
            },
            geometry: { coordinates: [139.7, 35.6, 10] },
          },
        ],
      }),
    )
    const [ev] = await usgsRecentQuakes.run({ capability: 'world_events', value: '' }, ctx)
    expect(ev.claim).toContain('tsunami alert')
    expect(ev.admiralty).toEqual({ source: 'A', info: 1 })
    expect(ev.confidence).toBe('confirmed')
    const data = ev.data as Record<string, unknown>
    expect(data.lat).toBe(35.6)
    expect(data.lon).toBe(139.7)
    expect(data.depthKm).toBe(10)
    expect(data.category).toBe('seismic')
    expect(data.tsunami).toBe(true)
    // The origin time — the moment the ground moved — kept apart from the
    // moment we read the feed, so detection lag is a real number.
    expect(ev.publishedAt).toBe(new Date(1_780_000_000_000).toISOString())
    expect(Date.parse(ev.retrievedAt)).toBeGreaterThan(1_780_000_000_000)
  })

  it('skips features missing a title or coordinates', async () => {
    ctx.fetch.mockResolvedValue(
      jsonResponse({
        features: [
          { properties: { title: 'no geometry' } },
          { geometry: { coordinates: [1, 2] } },
          { properties: { title: 'bad coords' }, geometry: { coordinates: ['x', 'y'] } },
        ],
      }),
    )
    expect(await usgsRecentQuakes.run({ capability: 'world_events', value: '' }, ctx)).toEqual([])
  })
})
