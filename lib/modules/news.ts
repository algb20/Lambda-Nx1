/**
 * News & Signals gateway. A place for the strongest world signals — top events
 * when no topic is given, or coverage of a specific topic — from primary-leaning
 * public sources, always linking to the origin. Multi-source so it does not go
 * dark if one provider is unavailable ("non-stop").
 *
 * This is a *signals* layer, not a news reprint: items carry source, country,
 * timestamp and an honest grade; the AI analyst can triage them, and the Radar
 * can watch a topic over time. We never assert a headline as fact — news is
 * graded "possible/probable" until corroborated.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerNewsGateway } from '../engine/sources'
import type { Evidence } from '../engine/types'

export interface NewsReport {
  topic: string | null
  generatedAt: string
  items: Evidence[]
  summary: {
    count: number
    sources: string[]
    countries: string[]
    sourcesOk: number
    sourcesFailed: number
  }
}

function countryOf(e: Evidence): string | null {
  const c = (e.data as { country?: string } | undefined)?.country
  return c && c.trim() ? c : null
}

export async function investigateNews(input = ''): Promise<NewsReport> {
  registerNewsGateway()
  const topic = input.trim() || null
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'news', value: topic ?? '' }, { registry, mode: 'all' })

  // Newest first — a live signals feed leads with the most recent.
  const items = [...r.evidence].sort((a, b) => (a.retrievedAt < b.retrievedAt ? 1 : -1))
  const sources = [...new Set(items.map((i) => i.sourceKey))]
  const countries = [...new Set(items.map(countryOf).filter((c): c is string => Boolean(c)))]

  return {
    topic,
    generatedAt,
    items,
    summary: {
      count: items.length,
      sources,
      countries,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}
