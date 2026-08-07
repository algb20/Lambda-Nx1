import { describe, it, expect } from 'vitest'
import { wikipediaTrending, wikimediaPageviews, trendingSources } from './trending'
import type { Source, SourceContext } from '../types'

function ctxFor(body: string | object, ok = true) {
  const urls: string[] = []
  const ctx: SourceContext = {
    fetch: async (url: string) => {
      urls.push(url)
      const text = typeof body === 'string' ? body : JSON.stringify(body)
      return new Response(text, { status: ok ? 200 : 500 })
    },
  }
  return { ctx, urls }
}

function run(source: Source, body: string | object, ok = true) {
  const { ctx, urls } = ctxFor(body, ok)
  return source.run({ capability: 'trending', value: '' }, ctx).then((evidence) => ({ evidence, urls }))
}

const FEATURED = {
  mostread: {
    date: '2026-08-07Z',
    articles: [
      {
        views: 500000,
        rank: 1,
        normalizedtitle: 'Some Event',
        description: 'A thing that happened',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Some_Event' } },
      },
      { views: 200000, rank: 2, normalizedtitle: 'A Person' },
      // Navigation artefacts that must be filtered out:
      { views: 9000000, rank: 3, normalizedtitle: 'Main Page' },
      { views: 800000, rank: 4, normalizedtitle: 'Special:Search' },
      // No views → unusable:
      { rank: 5, normalizedtitle: 'No Views' },
    ],
  },
}

const PAGEVIEWS = {
  items: [
    {
      articles: [
        { article: 'Some_Event', views: 480000, rank: 1 },
        { article: 'Main_Page', views: 9999999, rank: 2 },
        { article: 'Another_Topic', views: 150000, rank: 3 },
      ],
    },
  ],
}

describe('wikipediaTrending', () => {
  it('asks today\'s featured feed and parses most-read with real views', async () => {
    const { evidence, urls } = await run(wikipediaTrending, FEATURED)
    expect(urls[0]).toContain('/feed/featured/')
    expect(urls[0]).toContain('en.wikipedia.org')
    const titles = evidence.map((e) => e.claim)
    expect(titles).toContain('Some Event')
    expect(titles).toContain('A Person')
    // Navigation + view-less entries dropped.
    expect(titles).not.toContain('Main Page')
    expect(titles).not.toContain('Special:Search')
    expect(titles).not.toContain('No Views')
    const first = evidence[0]
    expect((first.data as { views?: number }).views).toBe(500000)
    expect((first.data as { kind?: string }).kind).toBe('trending')
    expect(first.sourceUrl).toContain('/wiki/Some_Event')
  })

  it('returns nothing on a failed fetch', async () => {
    const { evidence } = await run(wikipediaTrending, FEATURED, false)
    expect(evidence).toEqual([])
  })
})

describe('wikimediaPageviews', () => {
  it('asks a completed day and filters navigation pages', async () => {
    const { evidence, urls } = await run(wikimediaPageviews, PAGEVIEWS)
    expect(urls[0]).toContain('/metrics/pageviews/top/en.wikipedia/all-access/')
    const titles = evidence.map((e) => e.claim)
    expect(titles).toEqual(['Some Event', 'Another Topic'])
    expect((evidence[0].data as { views?: number }).views).toBe(480000)
    expect(evidence[0].sourceUrl).toContain('/wiki/Some_Event')
  })
})

describe('trendingSources', () => {
  it('exposes both providers under the trending capability, passive', () => {
    expect(trendingSources).toHaveLength(2)
    for (const s of trendingSources) {
      expect(s.capability).toBe('trending')
      expect(s.passive).toBe(true)
      expect(s.hosts.length).toBeGreaterThan(0)
    }
  })
})
