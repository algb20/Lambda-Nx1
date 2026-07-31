/**
 * Calibration ledger — the platform grades its own and others' forecasts against
 * reality, so it *learns which signals are reliable*. We record an attributed
 * claim with a horizon; when the outcome is known we resolve it; and we publish
 * an honest scoreboard — including our own misses (docs/FORESIGHT.md §2).
 *
 * Pure scoring + a dependency-injected store ⇒ testable without a live database.
 */
import { createHash } from 'node:crypto'
import type { Confidence } from '../engine/types'

export type AuthorKind = 'us' | 'external'
export type Outcome = 'correct' | 'partial' | 'wrong'

export interface CalibrationInput {
  authorKind: AuthorKind
  author: string
  claim: string
  topic?: string
  horizon?: Date | null
  sourceUrl?: string
  confidence?: Confidence
}

export interface CalibrationClaimRow {
  id: string
  authorKind: AuthorKind
  author: string
  claim: string
  topic: string | null
  status: 'open' | 'resolved'
  outcome: Outcome | null
  confidence: Confidence
  assertedAt: Date
  horizon: Date | null
}

export interface CalibrationPort {
  record(input: {
    authorKind: AuthorKind
    author: string
    claim: string
    topic: string | null
    horizon: Date | null
    sourceUrl: string | null
    confidence: Confidence
    dedupeHash: string
  }): Promise<unknown>
  resolve(id: string, outcome: Outcome, note?: string): Promise<unknown>
  list(limit?: number): Promise<CalibrationClaimRow[]>
}

export function calibrationHash(author: string, claim: string): string {
  return createHash('sha256').update(`${author}\n${claim.trim().toLowerCase()}`).digest('hex').slice(0, 24)
}

export async function recordClaim(port: CalibrationPort, input: CalibrationInput): Promise<void> {
  const claim = input.claim?.trim()
  const author = input.author?.trim()
  if (!claim) throw new Error('A claim is required')
  if (!author) throw new Error('An author is required')
  await port.record({
    authorKind: input.authorKind,
    author,
    claim,
    topic: input.topic?.trim() || null,
    horizon: input.horizon ?? null,
    sourceUrl: input.sourceUrl ?? null,
    confidence: input.confidence ?? 'possible',
    dedupeHash: calibrationHash(author, claim),
  })
}

export async function resolveClaim(port: CalibrationPort, id: string, outcome: Outcome, note?: string): Promise<void> {
  if (!id) throw new Error('id is required')
  await port.resolve(id, outcome, note)
}

// ── Scoring (pure) ───────────────────────────────────────────────────────────

const OUTCOME_WEIGHT: Record<Outcome, number> = { correct: 1, partial: 0.5, wrong: 0 }

export interface Accuracy {
  resolved: number
  correct: number
  partial: number
  wrong: number
  /** Weighted hit-rate 0–1 (correct=1, partial=0.5, wrong=0). Null if none resolved. */
  accuracy: number | null
}

function accuracyOf(rows: CalibrationClaimRow[]): Accuracy {
  const resolved = rows.filter((r) => r.status === 'resolved' && r.outcome)
  const correct = resolved.filter((r) => r.outcome === 'correct').length
  const partial = resolved.filter((r) => r.outcome === 'partial').length
  const wrong = resolved.filter((r) => r.outcome === 'wrong').length
  const score = resolved.reduce((n, r) => n + OUTCOME_WEIGHT[r.outcome as Outcome], 0)
  return {
    resolved: resolved.length,
    correct,
    partial,
    wrong,
    accuracy: resolved.length ? score / resolved.length : null,
  }
}

export interface Scoreboard {
  total: number
  open: number
  overall: Accuracy
  byAuthor: Array<{ author: string; authorKind: AuthorKind } & Accuracy>
  byConfidence: Array<{ confidence: Confidence } & Accuracy>
}

/** Build the honest scoreboard: overall + by author + by confidence band. */
export function scoreboard(rows: CalibrationClaimRow[]): Scoreboard {
  const byAuthorMap = new Map<string, CalibrationClaimRow[]>()
  for (const r of rows) {
    const list = byAuthorMap.get(r.author) ?? []
    list.push(r)
    byAuthorMap.set(r.author, list)
  }
  const byConfMap = new Map<Confidence, CalibrationClaimRow[]>()
  for (const r of rows) {
    const list = byConfMap.get(r.confidence) ?? []
    list.push(r)
    byConfMap.set(r.confidence, list)
  }

  const byAuthor = [...byAuthorMap.entries()]
    .map(([author, list]) => ({ author, authorKind: list[0].authorKind, ...accuracyOf(list) }))
    .sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1))
  const byConfidence = [...byConfMap.entries()].map(([confidence, list]) => ({ confidence, ...accuracyOf(list) }))

  return {
    total: rows.length,
    open: rows.filter((r) => r.status === 'open').length,
    overall: accuracyOf(rows),
    byAuthor,
    byConfidence,
  }
}

// ── Forecast capture ─────────────────────────────────────────────────────────

/**
 * Turn a target's published forward-looking items into external claims to track.
 * (Feeds the ledger from the target tracker / Radar — see docs/TRACKING.md.)
 */
export function forecastsFromHorizon(
  subject: string,
  horizon: Array<{ title: string; sourceKey: string; sourceUrl?: string; at: string }>,
): CalibrationInput[] {
  return horizon.map((e) => ({
    authorKind: 'external' as const,
    author: e.sourceKey,
    claim: e.title,
    topic: subject,
    sourceUrl: e.sourceUrl,
    confidence: 'possible' as const,
  }))
}
