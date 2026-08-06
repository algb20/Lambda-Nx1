import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyGeo, investigateGeo } from './geo'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('classifyGeo', () => {
  it('detects flights, coordinates and places', () => {
    expect(classifyGeo('4ca7b3')).toBe('flight')
    expect(classifyGeo('48.8584, 2.2945')).toBe('coordinates')
    expect(classifyGeo('Eiffel Tower')).toBe('place')
  })
})

describe('investigateGeo', () => {
  it('geocodes a place via Nominatim', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const url = new URL(u)
        if (url.hostname === 'nominatim.openstreetmap.org')
          return Promise.resolve(
            json([{ lat: '48.8584', lon: '2.2945', display_name: 'Eiffel Tower, Paris, France', type: 'attraction', osm_type: 'way', osm_id: 5013364 }]),
          )
        return Promise.resolve(json({}, 404))
      }),
    )
    const r = await investigateGeo('Eiffel Tower')
    expect(r.kind).toBe('place')
    expect(r.findings.some((f) => /Place: Eiffel Tower, Paris, France/.test(f.claim))).toBe(true)
  })

  it('reads a live flight state via OpenSky', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const url = new URL(u)
        if (url.hostname === 'opensky-network.org')
          return Promise.resolve(
            json({ time: 1, states: [['4ca7b3', 'RYR123 ', 'Ireland', 1, 1, 2.2945, 48.8584, 10000, false, 240, 90, 0, null, 10500, '1000', false, 0]] }),
          )
        return Promise.resolve(json({}, 404))
      }),
    )
    const r = await investigateGeo('4ca7b3')
    expect(r.kind).toBe('flight')
    expect(r.findings[0].claim).toMatch(/Flight RYR123 \(Ireland\): 48\.858, 2\.295, 10000 m, 240 m\/s/)
  })

  it('rejects too-short input', async () => {
    await expect(investigateGeo('x')).rejects.toThrow(/place, "lat,lon", or an aircraft/)
  })
})
