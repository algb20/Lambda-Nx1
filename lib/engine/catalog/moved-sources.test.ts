import { describe, expect, it } from 'vitest'
import { CATALOG } from './index'
import { catalogSource } from './adapter'

/**
 * Three sources that moved and were repaired on 2026-10-08 (R326, batch 18).
 * The payloads are trimmed copies of what each publisher served that day, so
 * the mapping is pinned to the real shape, not to a guess.
 */
const record = (key: string) => CATALOG.find((s) => s.key === key)!
const ctx = (body: unknown) => ({
  fetch: async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
})
const NO_INPUT = {} as never

describe('sources repaired in batch 18', () => {
  it('reads Geoscience Australia earthquakes from its WFS GeoJSON', async () => {
    const body = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [120.32405853, -7.7007575] },
          properties: {
            event_id: 'ga2026txnttv',
            description: 'Flores Sea',
            origin_time: '2026-10-08T04:49:01.950Z',
            latitude: -7.70075750350952,
            longitude: 120.324058532715,
            preferred_magnitude: 5.07967668109858,
          },
        },
      ],
    }
    const [item] = await catalogSource(record('ga_quakes')).run(NO_INPUT, ctx(body))
    expect(item.claim).toBe('Earthquake — Flores Sea')
    expect(item.sourceUrl).toBe('https://earthquakes.ga.gov.au/event/ga2026txnttv')
    expect(item.publishedAt).toBe('2026-10-08T04:49:01.950Z')
    const data = item.data as { lat: number; lon: number; magnitude: number }
    expect([data.lat, data.lon]).toEqual([-7.70075750350952, 120.324058532715])
    expect(data.magnitude).toBeCloseTo(5.08, 2)
  })

  it('reads USGS volcano notices from the HANS public API', async () => {
    const body = [
      {
        sent_unixtime: 1791402816,
        noticeType: 'Daily Update',
        obsFullname: 'Alaska Volcano Observatory',
        volcanoes: 'Great Sitkin, Shishaldin',
        notice_url: 'https://volcanoes.usgs.gov/hans-public/notice/DOI-USGS-AVO-2026-10-07T19:47:03+00:00',
      },
    ]
    const [item] = await catalogSource(record('usgs_volcano')).run(NO_INPUT, ctx(body))
    expect(item.claim).toBe('Daily Update: Great Sitkin, Shishaldin (Alaska Volcano Observatory)')
    expect(item.sourceUrl).toContain('/hans-public/notice/')
    expect(item.publishedAt).toBe('2026-10-07T19:53:36.000Z')
  })

  it('keeps every old address as history, never fetched', () => {
    for (const key of ['ga_quakes', 'usgs_volcano', 'cert_fr']) {
      const r = record(key)
      expect(r.formerUrls?.[0].until, key).toBe('2026-10-08')
      expect(r.url, key).not.toBe(r.formerUrls?.[0].url)
    }
  })
})
