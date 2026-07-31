/**
 * Suggestions engine — the community feedback loop.
 *
 * Users (weighted by influence: tier / usage) send ideas, improvements, bug
 * reports, integration/data-source requests. Each is AI-triaged on arrival, then
 * the backlog *organizes itself*: near-duplicate ideas are clustered so a hundred
 * people asking for the same thing become one high-signal item, and clusters are
 * ranked by impact × influence × demand. Humans then decide what to build.
 *
 * Pure functions (rank/cluster) + a dependency-injected repo & triager, so the
 * whole thing is unit-testable without a database or a network.
 */
import type { Impact, SuggestionInput, SuggestionKind, SuggestionTriage, SuggestionTriager } from '../ai/suggestions'

export interface SuggestionRow {
  id: string
  userId: string | null
  title: string
  body: string
  locale: string | null
  kind: SuggestionKind
  status: string
  category: string | null
  impact: Impact | null
  effort: string | null
  sentiment: string | null
  summary: string | null
  tags: unknown
  clusterKey: string | null
  submitterWeight: number
  votes: number
  triagedAt: Date | null
  createdAt: Date
}

export interface SuggestionInsert {
  userId: string | null
  title: string
  body: string
  locale?: string | null
  kind: SuggestionKind
  status: string
  category: string | null
  impact: Impact
  effort: string
  sentiment: string
  summary: string
  tags: string[]
  clusterKey: string
  submitterWeight: number
  triagedAt: Date
}

/** Minimal storage port (satisfied by lib/db repo.suggestions). */
export interface SuggestionRepoPort {
  create(row: SuggestionInsert): Promise<SuggestionRow>
  list(limit?: number): Promise<SuggestionRow[]>
  incrementVotes(id: string): Promise<SuggestionRow | undefined>
}

export interface SubmitInput {
  userId: string | null
  title: string
  body: string
  kind?: SuggestionKind
  locale?: string
  /** Influence weight of the submitter (tier/usage). Defaults to 1. */
  submitterWeight?: number
}

export async function submitSuggestion(
  deps: { repo: SuggestionRepoPort; triager: SuggestionTriager },
  input: SubmitInput,
): Promise<SuggestionRow> {
  const title = input.title?.trim()
  const body = input.body?.trim()
  if (!title) throw new Error('A title is required')
  if (!body) throw new Error('A description is required')
  if (title.length > 200) throw new Error('Title is too long (max 200 chars)')
  if (body.length > 5000) throw new Error('Description is too long (max 5000 chars)')

  const t: SuggestionTriage = await deps.triager.triage({ title, body })
  return deps.repo.create({
    userId: input.userId,
    title,
    body,
    locale: input.locale ?? null,
    kind: input.kind ?? t.kind,
    status: 'triaged',
    category: t.category,
    impact: t.impact,
    effort: t.effort,
    sentiment: t.sentiment,
    summary: t.summary,
    tags: t.tags,
    clusterKey: t.clusterKey,
    submitterWeight: Math.max(1, input.submitterWeight ?? 1),
    triagedAt: new Date(),
  })
}

// ── Ranking & clustering (pure) ──────────────────────────────────────────────

const IMPACT_WEIGHT: Record<Impact, number> = { low: 1, medium: 2, high: 3, critical: 5 }

export function scoreRow(row: SuggestionRow): number {
  const impact = row.impact ? IMPACT_WEIGHT[row.impact] : IMPACT_WEIGHT.medium
  return impact * Math.max(1, row.submitterWeight) * (1 + row.votes)
}

export interface SuggestionCluster {
  clusterKey: string
  title: string
  summary: string | null
  kind: SuggestionKind
  impact: Impact
  demand: number // number of distinct submissions in the cluster
  votes: number // summed votes
  weight: number // summed submitter influence
  score: number
  status: string
  items: SuggestionRow[]
}

function maxImpact(rows: SuggestionRow[]): Impact {
  const order: Impact[] = ['low', 'medium', 'high', 'critical']
  return rows
    .map((r) => r.impact ?? 'medium')
    .reduce((a, b) => (order.indexOf(b) > order.indexOf(a) ? b : a), 'low' as Impact)
}

/**
 * Group near-duplicate suggestions into ranked clusters. Cluster score rewards
 * impact, total influence behind it, and demand (how many people asked).
 */
export function clusterAndRank(rows: SuggestionRow[]): SuggestionCluster[] {
  const groups = new Map<string, SuggestionRow[]>()
  for (const r of rows) {
    const key = r.clusterKey || r.id
    const g = groups.get(key) ?? []
    g.push(r)
    groups.set(key, g)
  }

  const clusters: SuggestionCluster[] = [...groups.entries()].map(([clusterKey, items]) => {
    const sorted = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const rep = sorted[0]
    const votes = items.reduce((n, r) => n + r.votes, 0)
    const weight = items.reduce((n, r) => n + Math.max(1, r.submitterWeight), 0)
    const impact = maxImpact(items)
    const demand = items.length
    const score = IMPACT_WEIGHT[impact] * weight * (1 + votes) * demand
    return {
      clusterKey,
      title: rep.title,
      summary: rep.summary,
      kind: rep.kind,
      impact,
      demand,
      votes,
      weight,
      score,
      status: rep.status,
      items: sorted,
    }
  })

  return clusters.sort((a, b) => b.score - a.score)
}
