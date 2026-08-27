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
import { HostBusyError } from './host-budget'
import { cachedSourceResult, rememberSourceResult, singleFlight } from './source-cache'
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

/**
 * `runSource`, with the clock on it.
 *
 * A wrapper rather than a `Date.now()` at each of the five return sites: those
 * five are the branches this file has spent the most care distinguishing —
 * fresh, rate-limited-with-cache, rate-limited-empty, failed-with-cache,
 * failed-empty — and every one of them costs wall-clock time that a caller may
 * need to account for. Timing them in one place means a new branch is timed the
 * day it is written rather than the day somebody notices it is not.
 */
async function runSource(
  source: Source,
  input: SourceInput,
  reg: Registry,
  timeoutMs: number,
): Promise<SourceResult> {
  const began = Date.now()
  const result = await runSourceUntimed(source, input, reg, timeoutMs)
  return { ...result, durationMs: Date.now() - began }
}

/** Run one source under the guardrail, bounded by a deadline. */
async function runSourceUntimed(
  source: Source,
  input: SourceInput,
  reg: Registry,
  timeoutMs: number,
): Promise<SourceResult> {
  const ctx = { fetch: reg.guardrail.createFetch(source.key, source.minIntervalMs) }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    /**
     * One request per source, however many callers want it.
     *
     * The deadline is inside the shared promise, so a caller that joins an
     * existing run inherits the same bound rather than adding its own — two
     * timers on one fetch would mean the second caller could report a timeout
     * for work that succeeded.
     */
    const { promise, joined } = singleFlight(source.key, input.value, () =>
      Promise.race([
        source.run(input, ctx),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new SourceTimeoutError(source.key, timeoutMs)), timeoutMs)
        }),
      ]),
    )
    const evidence = await promise
    // Only the caller that actually made the request writes the cache. The one
    // that joined would write the same answer a second time under the same key.
    if (!joined) rememberSourceResult(source.key, input.value, evidence)
    return { sourceKey: source.key, ok: true, evidence }
  } catch (err) {
    /**
     * Why a source produced nothing, on demand.
     *
     * Every branch below turns a thrown error into a *result*, which is right —
     * one dead provider must not kill a run. The cost is that from outside,
     * "rate-limited and holding nothing", "the provider refused" and "there is
     * genuinely nothing to report" all arrive as a source that answered with an
     * empty list. Diagnosing the reference gateway's blank page meant guessing
     * between those three for an hour.
     *
     * Off unless `LAMBDA_DEBUG_SOURCES` is set, so it costs a production
     * deployment nothing and is one environment variable away when a gateway
     * goes quiet.
     */
    if (process.env.LAMBDA_DEBUG_SOURCES) {
      console.error('[source]', source.key, (err as Error)?.name, (err as Error)?.message)
    }
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
    /**
     * `HostBusyError` belongs here too, and for the same reason.
     *
     * Both mean *we* declined to make the request — one because this source
     * called recently, the other because a sibling source is using the same
     * provider's allowance. Neither is the provider failing, and reporting
     * either as a dead source would blame a publisher for our own scheduling.
     */
    if (err instanceof RateLimitedError || err instanceof HostBusyError) {
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

    /**
     * The provider failed — but we may still be holding what it last said.
     *
     * Until now the cache was consulted only when *we* declined to fetch
     * (`RateLimitedError`), and a failure on the provider's side threw the
     * last good answer away. Those two cases are indistinguishable to a
     * reader: either way the source was not fetched just now, and either way
     * a ninety-second-old answer beats an empty panel.
     *
     * This is not hypothetical and it is not niche. CoinGecko throttles
     * keyless callers, so the crypto gateway's asset half would vanish the
     * moment two people searched in the same minute — while the identical rows
     * sat in memory. The same is true of every provider that has a bad ten
     * seconds.
     *
     * Two things keep it honest, and both matter more than the resilience:
     *
     *  - `ok` stays **false** and `error` still carries the reason, so the
     *    health panel counts a failed fetch, because a fetch did fail. A
     *    product that serves a cached answer and reports itself perfectly
     *    healthy is lying about its own reliability.
     *  - The evidence keeps its original `retrievedAt`, and `cacheAgeMs` says
     *    exactly how old it is. Nothing here makes stale data look live.
     */
    const message = err instanceof Error ? err.message : String(err)
    const cached = cachedSourceResult(source.key, input.value)
    if (cached) {
      return {
        sourceKey: source.key,
        ok: false,
        evidence: cached.evidence,
        error: message,
        cached: true,
        cacheAgeMs: cached.ageMs,
      }
    }

    return {
      sourceKey: source.key,
      ok: false,
      evidence: [],
      error: message,
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
    /**
     * Independent sources — run them at once and keep whatever arrives.
     *
     * ## Bounded concurrency was tried here, and measured, and rejected
     *
     * The world fan-out runs 164 active sources at once, and per-source timing
     * showed each one taking far longer inside the run than outside it: a
     * national weather feed that answers alone in 0.7–4.1s took 4.9s and then
     * the full 8s deadline inside the fan-out. The run contends with itself
     * over DNS, TLS and parsing, which makes a worker pool the obvious fix.
     *
     * It is not the fix. Three passes over the real catalogue at each setting,
     * spaced, on the same network:
     *
     * | concurrency | total | median per source | max | hit the deadline |
     * |---|---|---|---|---|
     * | unbounded | 8.0s / 4.1s / 4.3s | 1822–2069ms | 4108–8000ms | 1 of 3 |
     * | 32 | 6.2s / 6.8s / 9.6s | 594–642ms | 2942–6343ms | 0 of 3 |
     * | 12 | 14.6s | 492ms | 8001ms | 1 of 1 |
     *
     * A pool of 32 does exactly what it promises — each source roughly three
     * times faster, and not one run to the deadline — and makes **the number
     * the reader waits for worse** in two of the three pairs. Individual
     * latency is not what a reader experiences; the total is, and 164 sources
     * finishing together beat 164 sources finishing in waves.
     *
     * Note also the spread within one setting: 8.0s, 4.1s, 4.3s for identical
     * work. The fan-out's total is dominated by network variance, not by this
     * scheduling choice, so tuning the choice is tuning the wrong term.
     *
     * The tidier per-source numbers were tempting and would have bought a
     * slower product. Left unbounded, deliberately, with the measurement
     * written down so the next person does not re-derive it.
     */
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
