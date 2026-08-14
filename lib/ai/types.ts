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
import type { EvidenceReading } from '../analysis/reasoning'

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
  /**
   * Model id used, or null when no model produced this verdict.
   *
   * Null is not a failure state. The deterministic analyst is arithmetic over
   * the evidence, so it has no model — and the interface uses exactly this to
   * decide which claims are a model's opinion and which are computed.
   */
  model: string | null
  /** ISO timestamp. */
  generatedAt: string
  /**
   * True when a real assessment was produced.
   *
   * It used to mean "an API key is present", which is why the whole analyst
   * layer collapsed to a notice without one. It now means what the interface
   * actually needs to know: whether there is an assessment to render.
   */
  configured: boolean
  /**
   * The mechanical reading of the same evidence — corroboration, disagreement,
   * age, source mix and gaps, computed with no model at all.
   *
   * Present with **and** without an API key. Where a model also ran, the two
   * readings sit side by side deliberately: the model reads meaning, the
   * arithmetic reads structure, and disagreement between them is itself
   * informative. See `lib/analysis/reasoning.ts`.
   */
  reading?: EvidenceReading | null
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
