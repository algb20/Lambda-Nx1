import { describe, it, expect } from 'vitest'
import { catalogSource } from './adapter'
import type { CatalogSource } from './types'
import { PUBLIC_DOMAIN } from './licence'

/**
 * One adapter serves the whole catalogue, so a fault in it is a fault in every
 * source at once. The properties worth pinning are the ones that would corrupt
 * an analysis rather than crash a request: an invented timestamp makes stale
 * data look live, a placeholder title makes an empty feed look productive, and
 * a rating taken from a response rather than from the publisher makes the whole
 * Admiralty scheme decorative.
 */
const base: CatalogSource = {
  key: 'test_source',
  name: 'Test source',
  publisher: 'Test Publisher',
  url: 'https://example.com/feed.json',
  kind: 'json',
  discipline: 'geoint',
  topics: ['earthquake'],
  coverage: 'global',
  admiralty: 'A',
  licence: PUBLIC_DOMAIN,
  minIntervalSec: 60,
  keyless: true,
}

/** A context whose fetch returns a canned body, so no network is touched. */
function ctxReturning(body: unknown, { ok = true, status = 200 } = {}) {
  return {
    fetch: async () =>
      ({
        ok,
        status,
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      }) as unknown as Response,
  }
}

const NO_INPUT = {} as never

describe('the source a record produces', () => {
  it('declares itself passive and allow-lists only its own host', () => {
    const source = catalogSource(base)
    expect(source.passive).toBe(true)
    expect(source.hosts).toEqual(['example.com'])
    expect(source.minIntervalMs).toBe(60_000)
  })

  it('derives the host from the URL it will actually request', () => {
    // A hand-kept second list would drift; this one cannot.
    const source = catalogSource({ ...base, url: 'https://Api.Example.ORG/v1/x?y=1' })
    expect(source.hosts).toEqual(['api.example.org'])
  })

  it('raises the provider status rather than returning an empty success', () => {
    const source = catalogSource(base)
    return expect(source.run(NO_INPUT, ctxReturning(null, { ok: false, status: 503 }))).rejects.toThrow(
      /503/,
    )
  })
})

describe('nothing is invented', () => {
  it('drops a record with no usable title instead of inserting a placeholder', async () => {
    const source = catalogSource({ ...base, path: 'items' })
    const evidence = await source.run(
      NO_INPUT,
      ctxReturning({ items: [{ id: 1 }, { title: 'A real one' }, { title: '   ' }] }),
    )
    expect(evidence).toHaveLength(1)
    expect(evidence[0].claim).toBe('A real one')
  })

  it('leaves a missing timestamp missing rather than defaulting to now', async () => {
    // Defaulting would turn an unknown into a freshness claim, which is exactly
    // how stale data ends up presented as live.
    const source = catalogSource({ ...base, path: 'items' })
    const [item] = await source.run(NO_INPUT, ctxReturning({ items: [{ title: 'No date here' }] }))
    expect(item.publishedAt).toBeNull()
  })

  it('does not geocode a headline', async () => {
    const source = catalogSource({ ...base, kind: 'rss', url: 'https://example.com/rss' })
    const xml = `<rss><channel><item><title>Explosion reported in Paris</title>
      <link>https://example.com/a</link></item></channel></rss>`
    const [item] = await source.run(NO_INPUT, ctxReturning(xml))
    const data = item.data as { lat: unknown; lon: unknown }
    // A place name in a sentence is not a coordinate. Plotting one would put a
    // guess on the map with the authority of a measurement.
    expect(data.lat).toBeNull()
    expect(data.lon).toBeNull()
  })

  it('takes the rating from the catalogue, never from the response', async () => {
    const source = catalogSource({ ...base, admiralty: 'D', path: 'items' })
    const [item] = await source.run(
      NO_INPUT,
      // A payload asserting its own authority changes nothing.
      ctxReturning({ items: [{ title: 'x', admiralty: 'A', confidence: 'confirmed' }] }),
    )
    expect(item.admiralty?.source).toBe('D')
    expect(item.confidence).toBe('unconfirmed')
  })
})

describe('shapes', () => {
  it('reads GeoJSON coordinates in lon,lat order', async () => {
    // GeoJSON is [longitude, latitude]. Reversing it is the classic bug that
    // puts every event in the wrong hemisphere.
    const source = catalogSource({ ...base, kind: 'geojson' })
    const [item] = await source.run(
      NO_INPUT,
      ctxReturning({
        features: [
          {
            properties: { title: 'M5.1 near somewhere', time: 1786680000000, mag: 5.1 },
            geometry: { coordinates: [-70.5, 42.3, 10] },
          },
        ],
      }),
    )
    const data = item.data as { lat: number; lon: number; magnitude: number }
    expect(data.lat).toBe(42.3)
    expect(data.lon).toBe(-70.5)
    expect(data.magnitude).toBe(5.1)
    expect(item.publishedAt).toBe(new Date(1786680000000).toISOString())
  })

  it('reads a GeoJSON body even when the record declares plain json', async () => {
    // Several agencies serve `features` under a plain content type.
    const source = catalogSource({ ...base, kind: 'json' })
    const evidence = await source.run(
      NO_INPUT,
      ctxReturning({ features: [{ properties: { title: 'Served as json' }, geometry: null }] }),
    )
    expect(evidence).toHaveLength(1)
  })

  it('follows a dotted path and a field map', async () => {
    const source = catalogSource({
      ...base,
      path: 'data.rows',
      map: { title: 'attrs.name', time: 'attrs.when', lat: 'attrs.y', lon: 'attrs.x' },
    })
    const [item] = await source.run(
      NO_INPUT,
      ctxReturning({
        data: { rows: [{ attrs: { name: 'Mapped', when: '2026-08-14T00:00:00Z', y: 1, x: 2 } }] },
      }),
    )
    expect(item.claim).toBe('Mapped')
    expect((item.data as { lat: number; lon: number }).lat).toBe(1)
    expect((item.data as { lat: number; lon: number }).lon).toBe(2)
  })

  it('parses epoch seconds as well as milliseconds', async () => {
    const source = catalogSource({ ...base, path: 'i', map: { time: 't' } })
    const [ms] = await source.run(NO_INPUT, ctxReturning({ i: [{ title: 'a', t: 1786680000000 }] }))
    const [sec] = await source.run(NO_INPUT, ctxReturning({ i: [{ title: 'a', t: 1786680000 }] }))
    expect(ms.publishedAt).toBe(sec.publishedAt)
  })

  it('parses the compact timestamp GDELT publishes', async () => {
    const source = catalogSource({ ...base, path: 'i', map: { time: 't' } })
    const [item] = await source.run(NO_INPUT, ctxReturning({ i: [{ title: 'a', t: '20260814T031500Z' }] }))
    expect(item.publishedAt).toBe('2026-08-14T03:15:00.000Z')
  })

  it('carries the independence group onto every finding', async () => {
    // Corroboration counts groups; a finding that lost its group cannot be
    // counted correctly later.
    const source = catalogSource({ ...base, path: 'i', independence: 'shared-wire' })
    const [item] = await source.run(NO_INPUT, ctxReturning({ i: [{ title: 'a' }] }))
    expect((item.data as { independence: string }).independence).toBe('shared-wire')
  })

  it('defaults the independence group to the source key', async () => {
    const source = catalogSource({ ...base, path: 'i' })
    const [item] = await source.run(NO_INPUT, ctxReturning({ i: [{ title: 'a' }] }))
    expect((item.data as { independence: string }).independence).toBe('test_source')
  })
})

describe('one source cannot crowd out the rest', () => {
  it('caps how much a single provider contributes to a run', async () => {
    const source = catalogSource({ ...base, path: 'i' })
    const many = Array.from({ length: 500 }, (_, n) => ({ title: `item ${n}` }))
    const evidence = await source.run(NO_INPUT, ctxReturning({ i: many }))
    expect(evidence.length).toBeLessThanOrEqual(120)
    expect(evidence.length).toBeGreaterThan(0)
  })
})
