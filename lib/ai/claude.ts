/**
 * Claude-backed analyst provider. Uses the official Anthropic SDK and constrains
 * the model to a strict structured schema, so the verdict is always well-formed.
 * If no ANTHROPIC_API_KEY is present it degrades to the not-configured notice
 * (never throws for a missing key) — the platform stays fully usable without AI.
 *
 * Passive + honest by construction: the model only ever sees the evidence we
 * already collected (see prompt.ts), and it is told to sort, not verify.
 */
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
// The SDK's zod helper is built against zod v4; import from the matching subpath
// (zod 3.25 ships both). Keeping the version aligned avoids a type mismatch.
import { z } from 'zod/v4'
import type { AiProvider, AnalystInput, AnalystVerdict } from './types'
import { AnalystRefusedError } from './types'
import { ANALYST_SYSTEM, buildAnalystPrompt } from './prompt'
import { notConfiguredVerdict } from './disabled'

const DEFAULT_MODEL = 'claude-opus-5'

const AssessmentSchema = z.object({
  summary: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  keyPoints: z.array(z.string()),
  nextSteps: z.array(z.string()),
  needsVerification: z.array(z.string()),
  confidenceCaveat: z.boolean(),
})

export interface ClaudeAnalystOptions {
  apiKey?: string
  model?: string
}

export class ClaudeAnalyst implements AiProvider {
  readonly name = 'claude'
  private readonly client: Anthropic | null
  private readonly model: string

  constructor(opts: ClaudeAnalystOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY
    this.model = opts.model ?? process.env.ANALYST_MODEL ?? DEFAULT_MODEL
    this.client = apiKey ? new Anthropic({ apiKey }) : null
  }

  get configured(): boolean {
    return this.client !== null
  }

  async analyze(input: AnalystInput): Promise<AnalystVerdict> {
    const generatedAt = new Date().toISOString()
    if (!this.client) return notConfiguredVerdict(this.name, generatedAt)

    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system: ANALYST_SYSTEM,
      messages: [{ role: 'user', content: buildAnalystPrompt(input) }],
      output_config: { format: zodOutputFormat(AssessmentSchema) },
    })

    // Always inspect the stop reason before trusting the content (skill guidance).
    if (response.stop_reason === 'refusal') {
      throw new AnalystRefusedError(response.stop_details?.explanation ?? undefined)
    }
    const parsed = response.parsed_output
    if (!parsed) throw new Error('AI analyst returned no structured output')

    return {
      ...parsed,
      provider: this.name,
      model: this.model,
      generatedAt,
      configured: true,
    }
  }
}
