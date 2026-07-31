/**
 * The not-configured fallback. When no AI credentials are present, the analyst
 * layer degrades gracefully instead of failing: it returns a clear notice and
 * leaves the (already complete, already graded) evidence to speak for itself.
 */
import type { AiProvider, AnalystInput, AnalystVerdict } from './types'

export function notConfiguredVerdict(
  provider: string,
  generatedAt: string = new Date().toISOString(),
): AnalystVerdict {
  return {
    summary:
      'AI analyst is not configured. Set ANTHROPIC_API_KEY to enable AI triage. ' +
      'The findings below are complete and graded on their own — the AI layer only ' +
      'summarizes them, it never adds or verifies facts.',
    severity: 'info',
    keyPoints: [],
    nextSteps: [],
    needsVerification: [],
    confidenceCaveat: false,
    provider,
    model: null,
    generatedAt,
    configured: false,
  }
}

/** An explicitly-disabled provider (AI_PROVIDER=disabled). */
export class DisabledAnalyst implements AiProvider {
  readonly name = 'disabled'
  readonly configured = false
  async analyze(_input: AnalystInput): Promise<AnalystVerdict> {
    return notConfiguredVerdict(this.name)
  }
}
