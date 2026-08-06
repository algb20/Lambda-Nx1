/**
 * lib/ai — the AI-analyst layer (cross-cutting, over every gateway).
 *
 * The analyst *triages and summarizes* the evidence our engine already collected
 * and graded. It **sorts, it does not verify** (OSINT reference §9): it never adds
 * facts that aren't in the evidence, never touches a target, and it always flags
 * what a human must independently confirm. Any provider sits behind this port, so
 * the model/vendor is swappable (charter rule #4).
 */
import type { Evidence } from '../engine/types'

/** Analyst severity read of a report — an opinion about the evidence, not a new fact. */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface AnalystInput {
  /** What was investigated — a domain, IP, username, wallet, company, etc. */
  subject: string
  /** Which gateway produced these findings, e.g. 'domain', 'threat', 'finance'. */
  gateway: string
  /** The graded evidence our engine collected. The analyst summarizes THIS ONLY. */
  findings: Evidence[]
  /** Optional focus/question to steer the triage. */
  focus?: string
}

/** The model-produced core of a verdict (validated against a strict schema). */
export interface AnalystAssessment {
  /** Plain-language triage of what the collected evidence shows. */
  summary: string
  /** Severity the analyst reads from the evidence. */
  severity: Severity
  /** Most important points, each traceable to a provided finding. */
  keyPoints: string[]
  /** Suggested next *passive* pivots (which entity to look at next, and why). */
  nextSteps: string[]
  /** Claims a human must independently verify — the AI sorts, it does not verify. */
  needsVerification: string[]
  /** True when a decision rides on evidence graded merely possible/unconfirmed. */
  confidenceCaveat: boolean
}

/** A full analyst verdict = the assessment + provenance. */
export interface AnalystVerdict extends AnalystAssessment {
  /** Provider name, e.g. 'claude'. */
  provider: string
  /** Model id used, or null when the layer is not configured. */
  model: string | null
  /** ISO timestamp. */
  generatedAt: string
  /** False when no API key/config is present (the verdict is then a graceful notice). */
  configured: boolean
}

export interface AiProvider {
  readonly name: string
  /** False when the provider has no credentials; analyze() then returns a notice verdict. */
  readonly configured: boolean
  analyze(input: AnalystInput): Promise<AnalystVerdict>
}

/** Raised when the model declines the request (stop_reason "refusal"). */
export class AnalystRefusedError extends Error {
  constructor(explanation?: string) {
    super(explanation ? `AI analyst declined: ${explanation}` : 'AI analyst declined the request')
    this.name = 'AnalystRefusedError'
  }
}
