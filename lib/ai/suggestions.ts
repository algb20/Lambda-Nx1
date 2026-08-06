/**
 * AI triage for community suggestions. Classifies, grades and clusters an
 * incoming idea so the backlog organizes itself. Same swappable-provider shape
 * as the analyst (charter rule #4); degrades to a deterministic heuristic when
 * no API key is present, so submission never fails.
 *
 * The AI *sorts* here too — it proposes a classification and an action; humans
 * decide (build / develop / decline).
 */
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod/v4'

export type SuggestionKind = 'feature' | 'improvement' | 'bug' | 'integration' | 'data_source' | 'other'
export type Impact = 'low' | 'medium' | 'high' | 'critical'
export type Effort = 'small' | 'medium' | 'large'
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed'

export interface SuggestionInput {
  title: string
  body: string
}

export interface SuggestionTriage {
  kind: SuggestionKind
  category: string
  impact: Impact
  effort: Effort
  sentiment: Sentiment
  summary: string
  tags: string[]
  /** Stable key grouping near-duplicate ideas (so many asks become one signal). */
  clusterKey: string
  suggestedAction: string
}

export interface SuggestionTriager {
  readonly name: string
  readonly configured: boolean
  triage(input: SuggestionInput): Promise<SuggestionTriage>
}

/** Deterministic cluster key from the title — semantic-lite, no network needed. */
export function heuristicClusterKey(title: string, body = ''): string {
  const stop = new Set(['the', 'a', 'an', 'to', 'for', 'and', 'or', 'of', 'in', 'on', 'add', 'please', 'we', 'i'])
  const words = `${title} ${body}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w))
  return words.slice(0, 5).sort().join('-') || 'general'
}

export function heuristicTriage(input: SuggestionInput): SuggestionTriage {
  const text = `${input.title} ${input.body}`.toLowerCase()
  const kind: SuggestionKind = /bug|error|broken|crash|fix/.test(text)
    ? 'bug'
    : /integrat|connect|api|webhook/.test(text)
      ? 'integration'
      : /source|feed|dataset|data\s/.test(text)
        ? 'data_source'
        : /improve|faster|better|ui|design|slow/.test(text)
          ? 'improvement'
          : /add|feature|support|new/.test(text)
            ? 'feature'
            : 'other'
  const summary = input.title.trim().slice(0, 140) || input.body.trim().slice(0, 140)
  return {
    kind,
    category: 'general',
    impact: 'medium',
    effort: 'medium',
    sentiment: 'neutral',
    summary,
    tags: [],
    clusterKey: heuristicClusterKey(input.title, input.body),
    suggestedAction: 'review',
  }
}

export class HeuristicTriager implements SuggestionTriager {
  readonly name = 'heuristic'
  readonly configured = false
  async triage(input: SuggestionInput): Promise<SuggestionTriage> {
    return heuristicTriage(input)
  }
}

const TriageSchema = z.object({
  kind: z.enum(['feature', 'improvement', 'bug', 'integration', 'data_source', 'other']),
  category: z.string(),
  impact: z.enum(['low', 'medium', 'high', 'critical']),
  effort: z.enum(['small', 'medium', 'large']),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  summary: z.string(),
  tags: z.array(z.string()),
  clusterKey: z.string(),
  suggestedAction: z.string(),
})

const SYSTEM = [
  'You triage product suggestions for Lambda NX, a lawful passive intelligence platform.',
  'Classify the suggestion accurately and neutrally. Do not invent scope the user did not ask for.',
  'kind: the best-fitting type. impact: honest user value. effort: rough build size.',
  'summary: one neutral sentence. tags: 1–4 short lowercase topic tags.',
  'clusterKey: a short stable slug (lowercase-hyphenated) capturing the CORE idea, so that ',
  'different wordings of the same request produce the SAME key (e.g. "dark mode", "night theme" -> "dark-mode").',
  'suggestedAction: one of build-now, plan, needs-info, decline, duplicate — your recommendation only; humans decide.',
  'The submission may be in ANY language; classify it correctly regardless and keep the summary in English.',
].join('\n')

export class ClaudeTriager implements SuggestionTriager {
  readonly name = 'claude'
  private readonly client: Anthropic | null
  private readonly model: string

  constructor(opts: { apiKey?: string; model?: string } = {}) {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY
    this.model = opts.model ?? process.env.ANALYST_MODEL ?? 'claude-opus-5'
    this.client = apiKey ? new Anthropic({ apiKey }) : null
  }

  get configured(): boolean {
    return this.client !== null
  }

  async triage(input: SuggestionInput): Promise<SuggestionTriage> {
    if (!this.client) return heuristicTriage(input)
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: `TITLE: ${input.title}\n\nBODY:\n${input.body}` }],
      output_config: { format: zodOutputFormat(TriageSchema) },
    })
    if (response.stop_reason === 'refusal') return heuristicTriage(input)
    return response.parsed_output ?? heuristicTriage(input)
  }
}

export function getSuggestionTriager(): SuggestionTriager {
  const name = process.env.AI_PROVIDER ?? 'claude'
  return name === 'disabled' ? new HeuristicTriager() : new ClaudeTriager()
}
