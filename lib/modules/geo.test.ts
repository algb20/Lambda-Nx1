import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyGeo, investigateGeo, FLIGHTS_WITHHELD } from './geo'
import { geoGatewaySources, geoGatewayCatalog } from '../engine/sources'

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

  /**
   * OpenSky's terms require a prior agreement for commercial REST use. The
   * catalogue and the reconciled baseline already excluded it; the gateway had
   * kept calling it (batch 05). A flight query is refused with the reason, and
   * nothing is sent to OpenSky.
   */
  it('withholds live flight lookup, says why, and never calls OpenSky', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(json({}, 404)))
    vi.stubGlobal('fetch', fetchSpy)
    await expect(investigateGeo('4ca7b3')).rejects.toThrow(FLIGHTS_WITHHELD)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(geoGatewaySources.map((s) => s.key)).not.toContain('opensky')
    expect(geoGatewayCatalog.find((r) => r.key === 'opensky')?.enabled).toBe(false)
  })

  it('rejects too-short input', async () => {
    await expect(investigateGeo('x')).rejects.toThrow(/place or a "lat,lon"/)
  })
})
