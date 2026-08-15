/**
 * Orchestrator — runs the sources for a capability with automatic fallback.
 *
 * mode 'first' (default): try sources **in order** until one returns evidence.
 *   A source that errors or returns nothing is skipped and the next is tried —
 *   this is the redundancy that keeps us working if a provider is blocked/down.
 *   Order is the whole point here, so these run sequentially.
 *
 * mode 'all': run every source and aggregate — independent corroboration is
 *   what raises a finding's confidence grade. These sources do not depend on
 *   each other, so they run **in parallel**: four providers that each take two
 *   seconds should cost two seconds, not eight. Sequentially they did cost
 *   eight, plus each source's politeness delay, which pushed the news gateway
 *   past the hosting platform's request limit — the request was killed, the
 *   client received an HTML error page instead of JSON, and the map showed
 *   nothing. Parallelism here is a correctness fix, not only a speed one.
 *
 *   The per-source rate limiter is unaffected: it throttles per source key, and
 *   distinct sources hold distinct keys.
 *
 * Every source is additionally bounded by a timeout, so one provider that never
 * answers cannot consume the whole request budget and take its siblings' results
 * down with it.
 */
import type { Capability, Evidence, SourceInput, SourceResult, Source } from './types'
import { Registry, registry as defaultRegistry } from './registry'
import { RateLimitedError } from './guardrail'
import { cachedSourceResult, rememberSourceResult } from './source-cache'
import { dedupeEvidence } from './analysis'

export type CollectMode = 'first' | 'all'

/**
 * How long any single source may take. Generous enough for a slow provider on a
 * slow network, short enough that several in parallel still fit comfortably
 * inside a serverless request.
 */
export const SOURCE_TIMEOUT_MS = 8_000

export interface CollectOptions {
  mode?: CollectMode
  registry?: Registry
  /** Override the per-source deadline (tests use a short one). */
  timeoutMs?: number
}

export interface CollectOutput {
  capability: Capability
  value: string
  evidence: Evidence[]
  results: SourceResult[]
}

class SourceTimeoutError extends Error {
  constructor(sourceKey: string, ms: number) {
    super(`source "${sourceKey}" timed out after ${Math.round(ms / 1000)}s`)
    this.name = 'SourceTimeoutError'
  }
}

/** Run one source under the guardrail, bounded by a deadline. */
async function runSource(
  source: Source,
  input: SourceInput,
  reg: Registry,
  timeoutMs: number,
): Promise<SourceResult> {
  const ctx = { fetch: reg.guardrail.createFetch(source.key, source.minIntervalMs) }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const evidence = await Promise.race([
      source.run(input, ctx),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SourceTimeoutError(source.key, timeoutMs)), timeoutMs)
      }),
    ])
    rememberSourceResult(source.key, input.value, evidence)
    return { sourceKey: source.key, ok: true, evidence }
  } catch (err) {
    /**
     * A source inside its own quiet interval.
     *
     * Not a failure: we chose not to fetch it, because the publisher asked us
     * not to yet. Reporting it as a failure is what made a warm container look
     * like a total outage — a hundred healthy feeds red at once, on a board
     * whose data was sitting in memory the whole time.
     *
     * `retrievedAt` on the replayed evidence is untouched, so nothing
     * downstream mistakes this for a fresh reading.
     */
    if (err instanceof RateLimitedError) {
      const cached = cachedSourceResult(source.key, input.value)
      if (cached) {
        return {
          sourceKey: source.key,
          ok: true,
          evidence: cached.evidence,
          cached: true,
          cacheAgeMs: cached.ageMs,
        }
      }
      // Nothing held yet — the first request of a container that has already
      // called this source. Still not a failure, and still not evidence.
      return { sourceKey: source.key, ok: true, evidence: [], cached: true, cacheAgeMs: null }
    }

    return {
      sourceKey: source.key,
      ok: false,
      evidence: [],
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function collect(
  input: SourceInput,
  opts: CollectOptions = {},
): Promise<CollectOutput> {
  const reg = opts.registry ?? defaultRegistry
  const mode: CollectMode = opts.mode ?? 'first'
  const timeoutMs = opts.timeoutMs ?? SOURCE_TIMEOUT_MS
  const sources = reg.sourcesFor(input.capability)
  if (sources.length === 0) {
    throw new Error(`No source registered for capability "${input.capability}"`)
  }

  let results: SourceResult[]

  if (mode === 'all') {
    // Independent sources — run them at once and keep whatever arrives.
    results = await Promise.all(sources.map((s) => runSource(s, input, reg, timeoutMs)))
  } else {
    // A fallback chain is ordered by definition: stop at the first that answers.
    results = []
    for (const source of sources) {
      const result = await runSource(source, input, reg, timeoutMs)
      results.push(result)
      if (result.ok && result.evidence.length > 0) break
    }
  }

  return {
    capability: input.capability,
    value: input.value,
    evidence: dedupeEvidence(results.flatMap((r) => r.evidence)),
    results,
  }
}
