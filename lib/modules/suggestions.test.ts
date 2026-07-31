import { describe, it, expect } from 'vitest'
import {
  clusterAndRank,
  scoreRow,
  submitSuggestion,
  type SuggestionInsert,
  type SuggestionRepoPort,
  type SuggestionRow,
} from './suggestions'
import { heuristicTriage, type SuggestionTriage, type SuggestionTriager } from '../ai/suggestions'

function row(over: Partial<SuggestionRow>): SuggestionRow {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'u1',
    title: 'Idea',
    body: 'Body',
    locale: 'en',
    kind: 'feature',
    status: 'triaged',
    category: 'general',
    impact: 'medium',
    effort: 'medium',
    sentiment: 'neutral',
    summary: 'sum',
    tags: [],
    clusterKey: 'dark-mode',
    submitterWeight: 1,
    votes: 0,
    triagedAt: new Date(),
    createdAt: new Date(),
    ...over,
  }
}

function fakeRepo(): SuggestionRepoPort & { rows: SuggestionRow[] } {
  const rows: SuggestionRow[] = []
  return {
    rows,
    async create(insert: SuggestionInsert) {
      const r = row({ ...insert, id: `id${rows.length}`, tags: insert.tags })
      rows.push(r)
      return r
    },
    async list() {
      return rows
    },
    async incrementVotes(id) {
      const r = rows.find((x) => x.id === id)
      if (r) r.votes += 1
      return r
    },
  }
}

const heuristicTriager: SuggestionTriager = {
  name: 'heuristic',
  configured: false,
  async triage(input) {
    return heuristicTriage(input)
  },
}

describe('submitSuggestion', () => {
  it('triages then persists, defaulting kind from the AI when not given', async () => {
    const repo = fakeRepo()
    const saved = await submitSuggestion(
      { repo, triager: heuristicTriager },
      { userId: 'u1', title: 'Please fix the broken export', body: 'Export crashes on large reports' },
    )
    expect(saved.status).toBe('triaged')
    expect(saved.kind).toBe('bug') // heuristic detected "fix/broken/crash"
    expect(saved.clusterKey).toBeTruthy()
    expect(repo.rows).toHaveLength(1)
  })

  it('rejects empty or over-long input', async () => {
    const repo = fakeRepo()
    await expect(
      submitSuggestion({ repo, triager: heuristicTriager }, { userId: 'u1', title: '', body: 'x' }),
    ).rejects.toThrow(/title is required/i)
    await expect(
      submitSuggestion({ repo, triager: heuristicTriager }, { userId: 'u1', title: 'ok', body: '' }),
    ).rejects.toThrow(/description is required/i)
  })
})

describe('scoreRow', () => {
  it('rewards impact, influence and votes', () => {
    expect(scoreRow(row({ impact: 'low', submitterWeight: 1, votes: 0 }))).toBe(1)
    expect(scoreRow(row({ impact: 'critical', submitterWeight: 1, votes: 0 }))).toBe(5)
    expect(scoreRow(row({ impact: 'medium', submitterWeight: 3, votes: 4 }))).toBe(2 * 3 * 5)
  })
})

describe('clusterAndRank', () => {
  it('merges near-duplicates into one signal and ranks by demand × impact × influence', () => {
    const rows: SuggestionRow[] = [
      row({ clusterKey: 'dark-mode', impact: 'medium', submitterWeight: 1, votes: 1 }),
      row({ clusterKey: 'dark-mode', impact: 'high', submitterWeight: 2, votes: 3 }),
      row({ clusterKey: 'api-access', impact: 'low', submitterWeight: 1, votes: 0 }),
    ]
    const clusters = clusterAndRank(rows)
    expect(clusters).toHaveLength(2)
    const dark = clusters[0]
    expect(dark.clusterKey).toBe('dark-mode')
    expect(dark.demand).toBe(2) // two people asked
    expect(dark.votes).toBe(4) // summed
    expect(dark.impact).toBe('high') // max impact in the cluster
    // dark-mode outranks api-access
    expect(clusters[0].score).toBeGreaterThan(clusters[1].score)
  })
})
