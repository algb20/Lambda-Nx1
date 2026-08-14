/**
 * Confidence, computed.
 *
 * ## Why this is not one number
 *
 * Every platform in this field prints a single percentage. A single number
 * cannot distinguish the two situations that most need distinguishing:
 *
 *  - one national agency, measured, reported four minutes ago;
 *  - eight news outlets, unmeasured, all repeating one wire from yesterday.
 *
 * Averaged into one figure those can land within a point of each other, and a
 * reader has no way back to the difference. So this module reports **four
 * dimensions separately** and only then combines them — and the combination
 * always travels with its parts.
 *
 *  - **Reliability** — how good is the best source, by Admiralty rating.
 *  - **Corroboration** — how many *independent* origins, never how many reports.
 *  - **Freshness** — how old is the newest observation.
 *  - **Completeness** — how much of what we expect to know do we actually know.
 *
 * ## Why the AI does not compute this
 *
 * A model asked to summarise and score in one step produces a confidence that
 * is a property of its prose. This is arithmetic over facts the evidence
 * carries, so the same inputs always give the same answer, the answer can be
 * recomputed by anyone, and every component can be argued with. That is what
 * makes `explain()` possible — and a confidence that cannot be explained is a
 * confidence nobody should act on.
 *
 * ## Absence is never evidence
 *
 * A low score means *we cannot support a claim*, not that the claim is false.
 * The vocabulary keeps that distinction: nothing here ever reads "unlikely".
 */
import type { Admiralty } from '../engine/types'
import type { FusedEvent } from './fusion'

export interface ConfidenceBreakdown {
  /** 0–100, each dimension independently meaningful. */
  reliability: number
  corroboration: number
  freshness: number
  completeness: number
  /** 0–100 overall — always presented with the four above, never alone. */
  overall: number
  grade: ConfidenceGrade
  /** Human-readable reasons, in the order that explains the score. */
  reasons: string[]
  /** What we do **not** know. Shown, not hidden. */
  unknowns: string[]
}

/**
 * The vocabulary.
 *
 * Deliberately about our *support* for a claim rather than the claim's truth.
 * "Unconfirmed" says we have not corroborated it; it does not say it is wrong,
 * and no grade here ever will.
 */
export type ConfidenceGrade = 'confirmed' | 'probable' | 'possible' | 'unconfirmed'

/** Admiralty source letters as a 0–100 reliability. */
const RELIABILITY: Record<string, number> = {
  A: 100, // official body publishing its own measurements
  B: 80, // established institution within its remit
  C: 55, // reputable outlet reporting others' work
  D: 30, // mixed or unestablished record
  E: 10, // known to be unreliable
  F: 0, // cannot be judged
}

/**
 * Independent origins, scored.
 *
 * Sharply diminishing: the step from one origin to two is the largest single
 * gain in the whole model, because it is the difference between a claim and a
 * corroborated claim. The step from six to seven is nearly nothing. A linear
 * count would let volume dominate, which is exactly the failure — mass
 * syndication would outscore a second genuinely independent confirmation.
 */
const CORROBORATION = [0, 40, 70, 85, 92, 96, 100]

function corroborationScore(independentSources: number): number {
  return CORROBORATION[Math.min(independentSources, CORROBORATION.length - 1)]
}

/**
 * Freshness from age in minutes.
 *
 * Full marks for the first hour, then decaying. Not a cliff: an event six
 * hours old is still real, it is simply less current, and a hard cutoff would
 * make a picture flicker between confident and doubtful as a clock ticked.
 */
export function freshnessScore(ageMinutes: number): number {
  if (!Number.isFinite(ageMinutes) || ageMinutes < 0) return 0
  if (ageMinutes <= 60) return 100
  if (ageMinutes <= 360) return 85
  if (ageMinutes <= 1440) return 65
  if (ageMinutes <= 4320) return 40
  if (ageMinutes <= 10080) return 20
  return 10
}

/**
 * How much of what should be known is known.
 *
 * The fields are weighted by how much each contributes to a usable event: a
 * location and a time make an event actionable; a magnitude and a link make it
 * checkable.
 */
export function completenessScore(event: FusedEvent): number {
  let score = 0
  if (event.lat != null && event.lon != null) score += 35
  // An *observed* time, specifically. Receipt time is always present and would
  // make this dimension meaningless if it counted.
  if (event.observedAt) score += 30
  if (event.magnitude != null) score += 15
  if (event.signals.some((s) => s.sourceUrl)) score += 20
  return Math.min(100, score)
}

function grade(overall: number, independentSources: number): ConfidenceGrade {
  // Two independent origins are required for 'confirmed', whatever the score.
  // A single source, however authoritative, has not been corroborated — and
  // corroboration is what the word means. This mirrors `gradeConfidence` in the
  // engine and keeps one vocabulary across the product.
  if (overall >= 85 && independentSources >= 2) return 'confirmed'
  if (overall >= 65) return 'probable'
  if (overall >= 40) return 'possible'
  return 'unconfirmed'
}

/** The best (lowest-lettered) Admiralty rating in a set of signals. */
function bestReliability(event: FusedEvent): { score: number; letter: string } {
  const letters = event.signals
    .map((s) => (s.admiralty as Admiralty | null | undefined)?.source)
    .filter(Boolean)
    .sort()
  const letter = String(letters[0] ?? 'F')
  return { score: RELIABILITY[letter] ?? 0, letter }
}

/**
 * Score a fused event.
 *
 * `now` is injected so the result is deterministic in tests — a score that
 * depends on the wall clock cannot be asserted, and a scoring function nobody
 * can assert is one nobody should trust.
 */
export function scoreConfidence(event: FusedEvent, now: number = Date.now()): ConfidenceBreakdown {
  const { score: reliability, letter } = bestReliability(event)
  const corroboration = corroborationScore(event.independentSources)

  const observed = event.observedAt ? Date.parse(event.observedAt) : NaN
  const ageMinutes = Number.isFinite(observed) ? (now - observed) / 60_000 : Number.POSITIVE_INFINITY
  const freshness = Number.isFinite(observed) ? freshnessScore(ageMinutes) : 0

  const completeness = completenessScore(event)

  // Reliability and corroboration carry the most weight because they answer
  // "should this be believed"; freshness and completeness answer "how usable is
  // it", which matters less to whether it is true.
  let overall = Math.round(
    reliability * 0.35 + corroboration * 0.35 + freshness * 0.2 + completeness * 0.1,
  )

  const reasons: string[] = []
  const unknowns: string[] = []

  reasons.push(
    event.independentSources >= 2
      ? `${event.independentSources} independent sources: ${event.origins.join(', ')}`
      : `A single source: ${event.origins[0] ?? 'unknown'}`,
  )
  reasons.push(`Best source rated ${letter} on the Admiralty scale`)

  if (Number.isFinite(observed)) {
    reasons.push(`Observed ${Math.round(ageMinutes)} minutes ago`)
  } else {
    // The failure this whole design exists to prevent: never assume "now".
    unknowns.push('No source stated when this happened — only when we received it')
  }

  if (event.lat == null || event.lon == null) {
    unknowns.push('No coordinate: this event cannot be placed on the map')
  }
  if (event.independentSources < 2) {
    unknowns.push('Not corroborated by an independent source')
  }
  if (event.signals.length > event.independentSources) {
    // The distinction competitors erase.
    reasons.push(
      `${event.signals.length} reports from ${event.independentSources} origins — the rest are republication`,
    )
  }

  // A contradiction is not a small penalty. Sources disagreeing about *where*
  // something happened means the event is not established, however many of them
  // there are, so the cap prevents a contested event from ever reading as
  // settled.
  for (const c of event.contradictions) {
    reasons.push(`Sources disagree: ${c.detail} (${c.between.join(' vs ')})`)
    unknowns.push(`${c.field} is not agreed between sources`)
  }
  if (event.contradictions.length > 0) overall = Math.min(overall, 60)

  return {
    reliability,
    corroboration,
    freshness,
    completeness,
    overall,
    grade: grade(overall, event.independentSources),
    reasons,
    unknowns,
  }
}

/**
 * The answer to "why?".
 *
 * A user must be able to press one button and see the arithmetic. This is what
 * separates a computed confidence from a generated one: the reasons are the
 * inputs to the number, not a description written after the fact.
 */
export function explain(breakdown: ConfidenceBreakdown): string {
  const parts = [
    `Confidence ${breakdown.overall}% (${breakdown.grade}).`,
    `Reliability ${breakdown.reliability}, corroboration ${breakdown.corroboration}, freshness ${breakdown.freshness}, completeness ${breakdown.completeness}.`,
    ...breakdown.reasons.map((r) => `· ${r}`),
  ]
  if (breakdown.unknowns.length) {
    parts.push('Not known:', ...breakdown.unknowns.map((u) => `? ${u}`))
  }
  return parts.join('\n')
}
