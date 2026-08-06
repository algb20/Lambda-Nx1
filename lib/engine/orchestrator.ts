/**
 * Orchestrator — runs the sources for a capability with automatic fallback.
 *
 * mode 'first' (default): try sources in order until one returns evidence.
 *   A source that errors or returns nothing is skipped and the next is tried —
 *   this is the redundancy that keeps us working if a provider is blocked/down.
 * mode 'all': run every source and aggregate — independent corroboration is
 *   what raises a finding's confidence grade.
 */
import type { Capability, Evidence, SourceInput, SourceResult } from './types'
import { Registry, registry as defaultRegistry } from './registry'
import { dedupeEvidence } from './analysis'

export type CollectMode = 'first' | 'all'

export interface CollectOptions {
  mode?: CollectMode
  registry?: Registry
}

export interface CollectOutput {
  capability: Capability
  value: string
  evidence: Evidence[]
  results: SourceResult[]
}

export async function collect(
  input: SourceInput,
  opts: CollectOptions = {},
): Promise<CollectOutput> {
  const reg = opts.registry ?? defaultRegistry
  const mode: CollectMode = opts.mode ?? 'first'
  const sources = reg.sourcesFor(input.capability)
  if (sources.length === 0) {
    throw new Error(`No source registered for capability "${input.capability}"`)
  }

  const results: SourceResult[] = []
  const evidence: Evidence[] = []

  for (const source of sources) {
    const ctx = { fetch: reg.guardrail.createFetch(source.key, source.minIntervalMs) }
    try {
      const ev = await source.run(input, ctx)
      results.push({ sourceKey: source.key, ok: true, evidence: ev })
      evidence.push(...ev)
      if (mode === 'first' && ev.length > 0) break
    } catch (err) {
      results.push({
        sourceKey: source.key,
        ok: false,
        evidence: [],
        error: err instanceof Error ? err.message : String(err),
      })
      // fallback: continue to the next source
    }
  }

  return {
    capability: input.capability,
    value: input.value,
    evidence: dedupeEvidence(evidence),
    results,
  }
}
