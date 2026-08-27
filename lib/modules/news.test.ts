import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { investigateNews } from './news'
import { clearSourceCache } from '../engine/source-cache'

/**
 * The source cache lives in module scope and is shared by every test in this
 * file, so without this a case that stubs a failing provider legitimately
 * replays the previous case's good answer — and the assertion that "a failed
 * provider yields nothing" fails for a reason that has nothing to do with the
 * behaviour under test. These cases were never independent; they only looked
 * it while sources swallowed their own failures.
 */
beforeEach(() => clearSourceCache())


function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('investigateNews', () => {
  it('returns top world events (Wikipedia) when no topic is given', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'en.wikipedia.org')
          return Promise.resolve(
            res({
              news: [
                {
                  story: 'A <a href="/x">major summit</a> concludes with a new accord.',
                  links: [{ normalizedtitle: 'Summit', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Summit' } } }],
                },
              ],
            }),
          )
        // GDELT must NOT be queried in the topic-less case (returns [] by guard).
        return Promise.resolve(res({ articles: [] }))
      }),
    )
    const r = await investigateNews('')
    expect(r.topic).toBeNull()
    expect(r.items.length).toBe(1)
    expect(r.items[0].claim).toBe('A major summit concludes with a new accord.')
    expect(r.items[0].sourceKey).toBe('wikipedia_itn')
    expect(r.summary.sources).toContain('wikipedia_itn')
  })

  it('returns topic coverage (GDELT) with origin links when a topic is given', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'api.gdeltproject.org')
          return Promise.resolve(
            res({
              articles: [
                {
                  url: 'https://news.example.com/a',
                  title: 'Two firms announce a strategic partnership',
                  seendate: '20260731T120000Z',
                  domain: 'news.example.com',
                  sourcecountry: 'United States',
                  language: 'English',
                },
              ],
            }),
          )
        return Promise.resolve(res({ news: [] })) // Wikipedia skips topic queries
      }),
    )
    const r = await investigateNews('partnership')
    expect(r.topic).toBe('partnership')
    expect(r.items.length).toBe(1)
    expect(r.items[0].claim).toMatch(/strategic partnership/)
    expect(r.items[0].sourceUrl).toBe('https://news.example.com/a')
    // GDELT's own stamp is the *publication* time. It used to be written into
    // `retrievedAt`, which is what left the board sorting by nothing and showing
    // no dates at all — the two fields now mean two different things.
    expect(r.items[0].publishedAt).toBe('2026-07-31T12:00:00Z')
    expect(Date.parse(r.items[0].retrievedAt)).toBeGreaterThan(
      Date.parse('2026-07-31T12:00:00Z'),
    )
    expect(r.summary.countries).toContain('United States')
  })

  it('adds geolocated USGS earthquakes (confirmed, exact coords) to top events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'earthquake.usgs.gov')
          return Promise.resolve(
            res({
              features: [
                {
                  properties: {
                    mag: 6.4,
                    place: '100km SW of Ndoi Island, Fiji',
                    time: 1785600000000,
                    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us1',
                    title: 'M 6.4 - 100km SW of Ndoi Island, Fiji',
                    tsunami: 1,
                  },
                  geometry: { coordinates: [-178.2, -21.1, 550] },
                },
              ],
            }),
          )
        return Promise.resolve(res({ news: [] })) // Wikipedia empty this run
      }),
    )
    const r = await investigateNews('')
    const q = r.items.find((i) => i.sourceKey === 'usgs_quakes')
    expect(q).toBeDefined()
    expect(q!.claim).toMatch(/M 6\.4 - 100km SW of Ndoi Island, Fiji · tsunami alert/)
    expect(q!.confidence).toBe('confirmed')
    expect(q!.admiralty).toEqual({ source: 'A', info: 1 })
    expect((q!.data as { lat: number; lon: number }).lat).toBe(-21.1)
    expect((q!.data as { lat: number; lon: number }).lon).toBe(-178.2)
    expect(q!.sourceUrl).toBe('https://earthquake.usgs.gov/earthquakes/eventpage/us1')
  })

  it('includes ReliefWeb humanitarian reports (country-tagged, linked to origin)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'api.reliefweb.int')
          return Promise.resolve(
            res({
              data: [
                {
                  fields: {
                    title: 'Flooding displaces thousands in region X',
                    url: 'https://reliefweb.int/report/x/flooding',
                    date: { created: '2026-07-29T08:00:00Z' },
                    primary_country: { name: 'Kenya' },
                  },
                },
              ],
            }),
          )
        return Promise.resolve(res({ articles: [] })) // GDELT empty for this topic
      }),
    )
    const r = await investigateNews('flooding')
    const rw = r.items.find((i) => i.sourceKey === 'reliefweb')
    expect(rw).toBeDefined()
    expect(rw!.claim).toBe('Flooding displaces thousands in region X')
    expect(rw!.sourceUrl).toBe('https://reliefweb.int/report/x/flooding')
    expect(rw!.admiralty).toEqual({ source: 'B', info: 2 })
    expect(r.summary.countries).toContain('Kenya')
  })

  it('degrades gracefully when a provider is down (stays non-empty via the other)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'en.wikipedia.org')
          return Promise.resolve(res({ news: [{ story: 'Event one.', links: [] }] }))
        return Promise.resolve(res({}, 503))
      }),
    )
    const r = await investigateNews('')
    expect(r.items.length).toBe(1)
    expect(r.items[0].claim).toBe('Event one.')
  })
})
