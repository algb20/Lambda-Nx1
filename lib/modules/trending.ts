/**
 * Daily global trending gateway — the day's most-looked-up subjects, ranked by
 * our own scoring, with the few that most deserve the spotlight surfaced.
 *
 * The value we add over the raw feeds is the analysis:
 *  - **merge** the same subject seen across sources into one entry;
 *  - **corroboration weight** — a subject the world looked up on *both*
 *    independent sources is more certainly trending than a one-feed spike;
 *  - **honest heat** — a 0..100 scale relative to the top subject, so a big
 *    thing looks big and a marginal one doesn't;
 *  - **spotlight** — the top 5–10 that clear the bar, never a padded list.
 *
 * Nothing here is fabricated: every number traces to a real view count, and
 * every item links to its source (charter §1 — analysis, not a data dump).
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerTrendingGateway } from '../engine/sources'
import type { Evidence } from '../engine/types'

export interface TrendingItem {
  title: string
  url: string | null
  description: string | null
  /** Peak measured view count across the sources that carried it. */
  views: number
  /** Source keys that reported this subject (length ≥ 2 ⇒ corroborated). */
  sources: string[]
  corroborated: boolean
  /** Our composite score (views × corroboration weight). */
  score: number
  /** 0..100, relative to the top subject — an honest sense of size. */
  heat: number
  rank: number
  retrievedAt: string
}

export interface TrendingReport {
  date: string
  generatedAt: string
  /** The full ranked board. */
  items: TrendingItem[]
  /** The 5–10 that deserve attention today. */
  spotlight: TrendingItem[]
  summary: {
    count: number
    sources: string[]
    sourcesOk: number
    sourcesFailed: number
    corroborated: number
  }
}

const CORROBORATION_WEIGHT = 1.25

interface Merged {
  title: string
  url: string | null
  description: string | null
  views: number
  sources: Set<string>
  retrievedAt: string
}

/** Merge trending evidence into one entry per subject (case-insensitive title). */
export function mergeTrending(evidence: Evidence[]): Merged[] {
  const byKey = new Map<string, Merged>()
  for (const e of evidence) {
    const title = e.claim.trim()
    if (!title) continue
    const key = title.toLowerCase()
    const data = (e.data as { views?: number; description?: string } | undefined) ?? {}
    const views = typeof data.views === 'number' && data.views > 0 ? data.views : 0
    const existing = byKey.get(key)
    if (existing) {
      existing.views = Math.max(existing.views, views)
      existing.sources.add(e.sourceKey)
      existing.url ??= e.sourceUrl ?? null
      existing.description ??= data.description ?? null
      if (e.retrievedAt > existing.retrievedAt) existing.retrievedAt = e.retrievedAt
    } else {
      byKey.set(key, {
        title,
        url: e.sourceUrl ?? null,
        description: data.description ?? null,
        views,
        sources: new Set([e.sourceKey]),
        retrievedAt: e.retrievedAt,
      })
    }
  }
  return [...byKey.values()]
}

/** Rank merged subjects into scored TrendingItems (highest first). */
export function rankTrending(merged: Merged[]): TrendingItem[] {
  const scored = merged.map((m) => {
    const corroborated = m.sources.size >= 2
    const score = m.views * (corroborated ? CORROBORATION_WEIGHT : 1)
    return { m, corroborated, score }
  })
  scored.sort((a, b) => b.score - a.score || b.m.views - a.m.views || a.m.title.localeCompare(b.m.title))
  const top = scored[0]?.score ?? 0
  return scored.map((s, i) => ({
    title: s.m.title,
    url: s.m.url,
    description: s.m.description,
    views: s.m.views,
    sources: [...s.m.sources].sort(),
    corroborated: s.corroborated,
    score: Math.round(s.score),
    heat: top > 0 ? Math.round((s.score / top) * 100) : 0,
    rank: i + 1,
    retrievedAt: s.m.retrievedAt,
  }))
}

/**
 * The spotlight: the top items that clear the bar. Between `min` and `max`,
 * never more than exist, and — above the minimum — only items with real heat,
 * so we don't pad the list with marginal noise.
 */
export function selectSpotlight(items: TrendingItem[], min = 5, max = 10, heatFloor = 15): TrendingItem[] {
  if (items.length <= min) return items.slice()
  const out: TrendingItem[] = []
  for (const it of items) {
    if (out.length >= max) break
    if (out.length < min || it.heat >= heatFloor) out.push(it)
    else break
  }
  return out
}

export async function investigateTrending(): Promise<TrendingReport> {
  registerTrendingGateway()
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'trending', value: '' }, { registry, mode: 'all' })

  const items = rankTrending(mergeTrending(r.evidence))
  const spotlight = selectSpotlight(items)
  const date =
    (r.evidence.find((e) => (e.data as { date?: string } | undefined)?.date)?.data as
      | { date?: string }
      | undefined)?.date ?? generatedAt.slice(0, 10)

  return {
    date,
    generatedAt,
    items,
    spotlight,
    summary: {
      count: items.length,
      sources: [...new Set(r.evidence.map((e) => e.sourceKey))].sort(),
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
      corroborated: items.filter((i) => i.corroborated).length,
    },
  }
}
