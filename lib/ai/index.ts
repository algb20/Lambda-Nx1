/**
 * lib/ai — the app's only AI-analyst entry point.
 *
 * ## What changed, and why it matters
 *
 * This used to hand back a provider that produced a "not configured" notice
 * whenever `ANTHROPIC_API_KEY` was absent, which is to say: for most users the
 * product had no analyst at all. The analyst is now always real.
 *
 *  - **No key** → the deterministic analyst. It reads the structure of the
 *    evidence — corroboration, disagreement, age, source mix, gaps — with no
 *    network and no model. Nothing about the product's analysis depends on
 *    somebody having bought a key.
 *  - **A key** → the model provider runs *and* the same mechanical reading is
 *    computed and travels with the verdict. The model reads meaning, the
 *    arithmetic reads structure, and where the two disagree the reader has
 *    learned something.
 *
 * `AI_PROVIDER=disabled` is still honoured, because an operator who turns the
 * layer off means it.
 */
import type { AiProvider } from './types'
import { ClaudeAnalyst } from './claude'
import { DisabledAnalyst } from './disabled'
import { DeterministicAnalyst, withReading } from './deterministic'

export * from './types'
export { notConfiguredVerdict } from './disabled'
export { ANALYST_SYSTEM, buildAnalystPrompt } from './prompt'
export { DeterministicAnalyst, verdictFromReading, withReading } from './deterministic'

export function getAiProvider(): AiProvider {
  const name = process.env.AI_PROVIDER ?? 'claude'
  switch (name) {
    case 'claude': {
      // The key decides which analyst runs, not whether one runs at all.
      const claude = new ClaudeAnalyst()
      return claude.configured ? withReading(claude) : new DeterministicAnalyst()
    }
    case 'deterministic':
      return new DeterministicAnalyst()
    case 'disabled':
      return new DisabledAnalyst()
    default:
      throw new Error(
        `AI_PROVIDER="${name}" is not configured. Available: claude, deterministic, disabled.`,
      )
  }
}
