import { describe, it, expect } from 'vitest'
import { mergeTrending, rankTrending, selectSpotlight } from './trending'
import type { Evidence } from '../engine/types'

function ev(title: string, sourceKey: string, views: number, url?: string, description?: string): Evidence {
  return {
    claim: title,
    sourceKey,
    sourceUrl: url,
    retrievedAt: '2026-08-07T00:00:00Z',
    confidence: 'probable',
    data: { kind: 'trending', views, description },
  }
}

describe('mergeTrending', () => {
  it('merges the same subject across sources, taking peak views and all sources', () => {
    const merged = mergeTrending([
      ev('Gold', 'wikipedia_trending', 100, 'https://e/gold', 'the metal'),
      ev('gold', 'wikimedia_pageviews', 140), // same subject, different case + source
      ev('Bitcoin', 'wikipedia_trending', 90),
    ])
    const gold = merged.find((m) => m.title.toLowerCase() === 'gold')!
    expect(gold.views).toBe(140) // peak, not sum
    expect([...gold.sources].sort()).toEqual(['wikimedia_pageviews', 'wikipedia_trending'])
    expect(gold.url).toBe('https://e/gold') // first non-null url kept
    expect(gold.description).toBe('the metal')
    expect(merged).toHaveLength(2)
  })

  it('ignores empty titles and non-positive views', () => {
    const merged = mergeTrending([ev('  ', 'x', 100), ev('Real', 'x', 0)])
    expect(merged).toHaveLength(1)
    expect(merged[0].views).toBe(0)
  })
})

describe('rankTrending', () => {
  it('weights corroborated subjects above single-source ones and scales heat to the top', () => {
    const items = rankTrending(
      mergeTrending([
        ev('A', 'wikipedia_trending', 100),
        ev('A', 'wikimedia_pageviews', 100), // corroborated → ×1.25 = 125
        ev('B', 'wikipedia_trending', 120), // single-source → 120
      ]),
    )
    expect(items[0].title).toBe('A')
    expect(items[0].corroborated).toBe(true)
    expect(items[0].score).toBe(125)
    expect(items[0].heat).toBe(100)
    expect(items[1].title).toBe('B')
    expect(items[1].heat).toBe(Math.round((120 / 125) * 100)) // 96
    expect(items[0].rank).toBe(1)
    expect(items[1].rank).toBe(2)
  })

  it('is deterministic and safe when everything is zero', () => {
    const items = rankTrending(mergeTrending([ev('A', 'x', 0), ev('B', 'x', 0)]))
    expect(items.every((i) => i.heat === 0)).toBe(true)
    expect(items.map((i) => i.title)).toEqual(['A', 'B']) // tie → alphabetical
  })
})

describe('selectSpotlight', () => {
  function board(n: number, heats: number[] = []): ReturnType<typeof rankTrending> {
    return Array.from({ length: n }, (_, i) => ({
      title: `T${i}`,
      url: null,
      description: null,
      views: 100 - i,
      sources: ['x'],
      corroborated: false,
      score: 100 - i,
      heat: heats[i] ?? 100 - i,
      rank: i + 1,
      retrievedAt: '2026-08-07T00:00:00Z',
    }))
  }

  it('returns everything when at or below the minimum', () => {
    expect(selectSpotlight(board(4)).length).toBe(4)
  })

  it('caps at the maximum', () => {
    expect(selectSpotlight(board(20)).length).toBe(10)
  })

  it('guarantees the minimum even if heat is low, then stops at the heat floor', () => {
    // Ranks 0-4 high heat, then a cliff to below the floor.
    const b = board(12, [90, 80, 70, 60, 50, 5, 5, 5, 5, 5, 5, 5])
    const spot = selectSpotlight(b, 5, 10, 15)
    expect(spot.length).toBe(5) // 5 guaranteed, 6th is below floor → stop
  })
})
