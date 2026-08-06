/**
 * AI-analyst module — the cross-cutting layer that triages any gateway's report.
 *
 * It takes evidence our engine already collected and returns a graded, plain-
 * language verdict (summary, severity, next passive pivots, what still needs
 * human verification). The provider is dependency-injected so this is fully
 * unit-testable with a fake, and swappable per charter rule #4.
 *
 * The analyst SORTS, it does NOT verify (OSINT reference §9).
 */
import type { AiProvider, AnalystInput, AnalystVerdict } from '../ai/types'
import { getAiProvider } from '../ai'

export async function analyzeFindings(
  input: AnalystInput,
  provider: AiProvider = getAiProvider(),
): Promise<AnalystVerdict> {
  const subject = input.subject?.trim()
  if (!subject) throw new Error('subject is required')
  if (!Array.isArray(input.findings)) throw new Error('findings must be an array')
  const gateway = input.gateway?.trim() || 'general'
  return provider.analyze({ ...input, subject, gateway })
}
