/**
 * The default analyst — the one that works with no key at all.
 *
 * ## Why this is the default and the model is the addition
 *
 * The layer used to be the other way round: a model call, and a "not
 * configured" notice for everybody else. That meant the analyst was absent for
 * most users of the product and unverifiable for the rest, since prose gives a
 * reader no way to check how a conclusion was reached.
 *
 * So the arithmetic runs first and always. `lib/analysis/reasoning.ts` reads
 * the structure of the evidence — corroboration, disagreement, age, source mix,
 * and the gaps those weaknesses imply — and this module dresses that reading in
 * the `AnalystVerdict` shape the rest of the app already speaks. No key, no
 * network, no model, and the same evidence always produces the same verdict.
 *
 * ## What it will not claim
 *
 * **Severity.** Grading how *grave* a finding is means reading what the claim
 * means — whether a sanctions listing is serious, whether a C2 is live — and a
 * mechanical engine cannot do that without inventing an opinion. So severity
 * stays `info` and the real grading is `reading.strength`, which is about our
 * support for the claims rather than about the claims. A verdict with a model
 * behind it may grade severity; this one says plainly that it does not.
 *
 * That is also the reason both readings are shown when a key is present. The
 * model reads meaning and can be wrong about structure; the arithmetic reads
 * structure and knows nothing of meaning. Where they disagree, the reader has
 * learned something.
 */
import type { AiProvider, AnalystInput, AnalystVerdict } from './types'
import { AnalystRefusedError } from './types'
import { readEvidence, type EvidenceReading, type ReadingOptions } from '../analysis/reasoning'

/** Lists a person reads are capped; the counts inside the reading stay exact. */
const MAX_POINTS = 8
const MAX_STEPS = 6

/**
 * Turn a reading into the verdict shape the app already renders.
 *
 * Every string here comes out of the reading, and the reading's sentences each
 * carry `refs` into the evidence. Nothing is composed for effect: if there is
 * no disagreement, there is no line about disagreement.
 */
export function verdictFromReading(
  input: AnalystInput,
  reading: EvidenceReading,
  generatedAt: string = new Date().toISOString(),
  provider = 'deterministic',
  note?: string,
): AnalystVerdict {
  // Contradictions lead. A reader who takes only the first line must be told
  // the sources disagree before being told how many of them there are.
  const keyPoints = [
    ...reading.contradictions.map((c) => `Sources disagree: ${c.detail} (${c.origins.join(' vs ')})`),
    ...reading.corroboration.groups
      .filter((g) => g.support === 'corroborated')
      .map((g) => `${g.statement} — ${g.reading}`),
    ...reading.corroboration.groups
      .filter((g) => g.support === 'repeated')
      .map((g) => `${g.statement} — ${g.reading}`),
  ].slice(0, MAX_POINTS)

  // Every one of these is a gap's passive check, so the "next step" list cannot
  // drift into suggesting anything that touches a target (charter §3).
  const nextSteps = reading.gaps.map((g) => g.check).slice(0, MAX_STEPS)

  const needsVerification = [
    ...reading.contradictions.map(
      (c) => `Which origin is right about ${c.subject} — ${c.origins.join(' and ')} do not agree.`,
    ),
    ...reading.corroboration.groups
      .filter((g) => g.support !== 'corroborated')
      .map((g) => g.statement),
  ].slice(0, MAX_POINTS)

  const summary = [note, ...reading.bottomLine].filter(Boolean).join(' ')

  return {
    summary,
    // See the module note: risk is a judgement about meaning, and this analyst
    // reads structure. Claiming a severity from arithmetic would be the exact
    // invention the whole design refuses.
    severity: 'info',
    keyPoints,
    nextSteps,
    needsVerification,
    confidenceCaveat:
      reading.strength === 'thin' ||
      reading.strength === 'contested' ||
      reading.gaps.some((g) => g.kind === 'weak-confidence'),
    provider,
    model: null,
    generatedAt,
    configured: true,
    reading,
  }
}

export type DeterministicAnalystOptions = ReadingOptions

/**
 * The analyst that is always available.
 *
 * `configured` is true because it genuinely is: it needs nothing to run. That
 * is the whole point — the platform's analysis no longer depends on somebody
 * having bought a key.
 */
export class DeterministicAnalyst implements AiProvider {
  readonly name = 'deterministic'
  readonly configured = true
  private readonly options: DeterministicAnalystOptions

  constructor(options: DeterministicAnalystOptions = {}) {
    this.options = options
  }

  async analyze(input: AnalystInput): Promise<AnalystVerdict> {
    const generatedAt = new Date().toISOString()
    return verdictFromReading(input, readEvidence(input.findings, this.options), generatedAt)
  }
}

/**
 * Run a model provider **and** the arithmetic, and return both.
 *
 * Two behaviours worth stating:
 *
 *  - the reading is computed before the call, so a slow or failing model never
 *    costs the user the analysis we could always have given them;
 *  - a refusal propagates untouched, because a model declining a request is a
 *    fact the caller must see and not something to paper over with arithmetic.
 *    Any other failure degrades to the mechanical verdict with the reason said
 *    out loud — a reader gets the full structural analysis and is told the
 *    model was unreachable, which is strictly more than an error page.
 */
export function withReading(provider: AiProvider, options: ReadingOptions = {}): AiProvider {
  return {
    name: provider.name,
    configured: provider.configured,
    async analyze(input: AnalystInput): Promise<AnalystVerdict> {
      const reading = readEvidence(input.findings, options)
      try {
        const verdict = await provider.analyze(input)
        return { ...verdict, reading }
      } catch (err) {
        if (err instanceof AnalystRefusedError) throw err
        const why = err instanceof Error ? err.message : 'no reason given'
        return verdictFromReading(
          input,
          reading,
          new Date().toISOString(),
          'deterministic',
          `The ${provider.name} analyst could not be reached (${why}); this is the mechanical reading of the same evidence.`,
        )
      }
    },
  }
}
