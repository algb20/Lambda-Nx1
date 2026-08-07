import { describe, it, expect } from 'vitest'
import { Registry } from '../engine/registry'
import { collect } from '../engine/orchestrator'
import { wikipediaTrending, wikimediaPageviews } from '../engine/sources/trending'
import { mergeTrending, rankTrending, selectSpotlight } from './trending'

/** Exercises the real collect() path (parallel 'all' mode) with a stub fetch. */
describe('trending end-to-end (orchestrator wiring)', () => {
  it('collects both sources in parallel and produces a ranked spotlight', async () => {
    const reg = new Registry()
    reg.register(wikipediaTrending)
    reg.register(wikimediaPageviews)

    // Stub the guardrail fetch so no network is touched.
    reg.guardrail.createFetch = () => async (url: string) => {
      if (url.includes('/feed/featured/')) {
        return new Response(JSON.stringify({
          mostread: { date: '2026-08-07Z', articles: [
            { views: 300000, rank: 1, normalizedtitle: 'Topic One', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Topic_One' } } },
            { views: 100000, rank: 2, normalizedtitle: 'Topic Two' },
          ] } }), { status: 200 })
      }
      return new Response(JSON.stringify({ items: [ { articles: [
        { article: 'Topic_One', views: 280000, rank: 1 }, // corroborates Topic One
        { article: 'Topic_Three', views: 90000, rank: 2 },
      ] } ] }), { status: 200 })
    }

    const r = await collect({ capability: 'trending', value: '' }, { registry: reg, mode: 'all' })
    const items = rankTrending(mergeTrending(r.evidence))
    const spotlight = selectSpotlight(items, 2, 10)

    expect(r.results.every((x) => x.ok)).toBe(true)
    expect(items[0].title).toBe('Topic One')
    expect(items[0].corroborated).toBe(true)
    expect(items.map((i) => i.title).sort()).toEqual(['Topic One', 'Topic Three', 'Topic Two'])
    expect(spotlight.length).toBeGreaterThanOrEqual(2)
  })
})
