/**
 * lib/ai — the app's only AI-analyst entry point. Selects the provider by env
 * (AI_PROVIDER, default 'claude'). The default provider is safe with no key: it
 * returns a not-configured notice rather than failing, so nothing else breaks.
 */
import type { AiProvider } from './types'
import { ClaudeAnalyst } from './claude'
import { DisabledAnalyst } from './disabled'

export * from './types'
export { notConfiguredVerdict } from './disabled'
export { ANALYST_SYSTEM, buildAnalystPrompt } from './prompt'

export function getAiProvider(): AiProvider {
  const name = process.env.AI_PROVIDER ?? 'claude'
  switch (name) {
    case 'claude':
      return new ClaudeAnalyst()
    case 'disabled':
      return new DisabledAnalyst()
    default:
      throw new Error(`AI_PROVIDER="${name}" is not configured. Available: claude, disabled.`)
  }
}
