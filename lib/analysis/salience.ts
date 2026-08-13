/**
 * Which finding matters most.
 *
 * The audit's complaint was that "result cards are uniform regardless of
 * importance — nothing draws the eye to the most significant finding". That is
 * not a styling problem. A list that presents forty findings as equally
 * important has pushed the analyst's first and hardest judgement — *what should
 * I look at?* — back onto the analyst, which is the one thing an analysis
 * product exists to help with.
 *
 * So the ranking is explicit, and it uses the grading the platform already
 * assigns rather than inventing a new scale:
 *
 *  1. **Source reliability** (Admiralty letter, A best → F worst). A claim from
 *     an authority outranks the same claim from an aggregator.
 *  2. **Information credibility** (Admiralty number, 1 best → 6 worst).
 *  3. **Confidence** — how well the analysis core thinks the claim is backed.
 *  4. **Corroboration** — a claim two independent sources reported outranks one
 *     nobody else saw. Computed over the set, not the item, because that is what
 *     corroboration means.
 *
 * Ties break on recency, then on source key, so the order is deterministic: an
 * analyst who reloads must not get a different "most important finding".
 *
 * Pure and dependency-free, so the ranking can be tested exhaustively and reused
 * anywhere a list of evidence is shown.
 */
import type { Confidence, Evidence } from '@/lib/engine/types'

/** Admiralty source reliability, best first. */
const SOURCE_RANK: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 }

/** Admiralty information credibility, best first. */
const INFO_RANK: Record<number, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1, 6: 0 }

const CONFIDENCE_RANK: Record<Confidence, number> = {
  confirmed: 3,
  probable: 2,
  possible: 1,
  unconfirmed: 0,
}

export interface ScoredFinding {
  evidence: Evidence
  /** 0–100. Comparable only within one investigation. */
  score: number
  /** True when another source independently reported the same subject. */
  corroborated: boolean
}

/** What "the same thing" means when checking for corroboration. */
export function topicKey(e: Evidence): string {
  return e.entity ? `${e.entity.type}:${e.entity.value}`.toLowerCase() : e.claim.toLowerCase().slice(0, 80)
}

/**
 * Score one finding in the context of its set. Weights are deliberately coarse —
 * this orders a list, it does not pretend to be a measurement.
 */
export function scoreFinding(e: Evidence, corroborated: boolean): number {
  // An ungraded source is not treated as a bad one; it is treated as unknown,
  // which sits below a graded C and above a graded F.
  const source = e.admiralty ? (SOURCE_RANK[e.admiralty.source] ?? 2) : 2
  const info = e.admiralty ? (INFO_RANK[e.admiralty.info] ?? 2) : 2
  const confidence = CONFIDENCE_RANK[e.confidence] ?? 0

  const raw =
    source * 8 + // 0–40
    info * 6 + // 0–30
    confidence * 6 + // 0–18
    (corroborated ? 12 : 0) // 0–12
  return Math.min(100, raw)
}

/**
 * Rank a set. Returns every finding scored, most significant first — callers
 * decide how much of the head to emphasise.
 */
export function rankFindings(evidence: Evidence[]): ScoredFinding[] {
  const sourcesByTopic = new Map<string, Set<string>>()
  for (const e of evidence) {
    const key = topicKey(e)
    const set = sourcesByTopic.get(key) ?? new Set<string>()
    set.add(e.sourceKey)
    sourcesByTopic.set(key, set)
  }

  return evidence
    .map((e) => {
      const corroborated = (sourcesByTopic.get(topicKey(e))?.size ?? 0) >= 2
      return { evidence: e, score: scoreFinding(e, corroborated), corroborated }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Deterministic tie-breaks: a reload must not reshuffle the lead finding.
      const t = Date.parse(b.evidence.retrievedAt) - Date.parse(a.evidence.retrievedAt)
      if (Number.isFinite(t) && t !== 0) return t
      return a.evidence.sourceKey.localeCompare(b.evidence.sourceKey)
    })
}

/**
 * The one finding to put in front of the analyst, or null when nothing in the
 * set stands out enough to justify the claim that it does.
 *
 * The threshold matters: promoting the best of a uniformly weak set would be a
 * false signal, and the honest answer there is to promote nothing.
 */
export const LEAD_THRESHOLD = 55

export function leadFinding(evidence: Evidence[]): ScoredFinding | null {
  if (evidence.length < 2) return null // nothing to stand out *from*
  const [top, second] = rankFindings(evidence)
  if (!top || top.score < LEAD_THRESHOLD) return null
  // If everything scores the same, there is no "most significant" finding, and
  // saying otherwise is worse than saying nothing.
  if (second && second.score === top.score) return null
  return top
}

/** A short, plain reason the lead finding was promoted — never a claim of truth. */
export function whyLead(scored: ScoredFinding): string {
  const reasons: string[] = []
  const a = scored.evidence.admiralty
  if (a && (a.source === 'A' || a.source === 'B')) reasons.push(`rated ${a.source}${a.info}`)
  if (scored.corroborated) reasons.push('reported by two independent sources')
  if (scored.evidence.confidence === 'confirmed') reasons.push('confirmed')
  else if (scored.evidence.confidence === 'probable') reasons.push('probable')
  return reasons.length > 0 ? reasons.join(' · ') : 'highest-graded finding in this set'
}
