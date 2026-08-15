/**
 * Passive-only guardrail (charter §3, reference §2.16).
 *
 * The engine must never touch an investigation target. This is enforced by
 * construction, not by discipline:
 *   1. Sources may only contact hosts they pre-declare (a provider allowlist);
 *      a request to any other host is refused.
 *   2. Only read/query methods are permitted (GET/HEAD/POST — POST covers
 *      provider query APIs); state-changing methods (PUT/PATCH/DELETE) are refused.
 *   3. Per-source minimum intervals throttle requests.
 *
 * The passive guarantee is the allowlist: a subject/target host is never on it,
 * so the engine can never contact the target (no port scans, no nmap, no probing).
 */
import type { Source } from './types'

export class PassiveGuardrailError extends Error {
  constructor(message: string) {
    super(`Passive guardrail: ${message}`)
    this.name = 'PassiveGuardrailError'
  }
}

/**
 * The longest we will sit inside a request waiting for a source's interval.
 *
 * Set just above the slowest coded source's own interval (3s), so those still
 * sleep exactly as they always did, and every catalogue feed's 15-to-60-minute
 * interval refuses instantly instead.
 */
export const MAX_POLITE_WAIT_MS = 3_500

/**
 * A source we are not allowed to fetch yet.
 *
 * Deliberately its own type rather than a generic error: it is not a failure of
 * the source or of the network, and treating it as one is what turned every
 * catalogue feed red on a warm container. The orchestrator recognises it and
 * answers from the last successful result.
 */
export class RateLimitedError extends Error {
  constructor(
    readonly sourceKey: string,
    readonly waitMs: number,
  ) {
    super(
      `rate limit: "${sourceKey}" may not be fetched for another ${Math.ceil(waitMs / 1000)}s`,
    )
    this.name = 'RateLimitedError'
  }
}

export class Guardrail {
  private readonly allowedHosts = new Set<string>()
  private readonly lastCallAt = new Map<string, number>()

  /** Register provider hosts a source is permitted to contact. */
  allowHosts(hosts: string[]): void {
    for (const h of hosts) this.allowedHosts.add(h.toLowerCase())
  }

  isAllowed(hostname: string): boolean {
    return this.allowedHosts.has(hostname.toLowerCase())
  }

  /** Reject a source that is not passive or declares no provider hosts. */
  assertPassiveSource(source: Source): void {
    if (source.passive !== true) {
      throw new PassiveGuardrailError(`source "${source.key}" is not marked passive`)
    }
    if (!Array.isArray(source.hosts) || source.hosts.length === 0) {
      throw new PassiveGuardrailError(`source "${source.key}" declares no provider hosts`)
    }
  }

  /** A fetch bound to one source: allowlist + read-only + rate limit enforced. */
  createFetch(sourceKey: string, minIntervalMs?: number) {
    return async (url: string, init?: RequestInit): Promise<Response> => {
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        throw new PassiveGuardrailError(`invalid URL: ${url}`)
      }

      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new PassiveGuardrailError(`blocked protocol: ${parsed.protocol}`)
      }
      if (!this.isAllowed(parsed.hostname)) {
        throw new PassiveGuardrailError(`host not allow-listed: ${parsed.hostname}`)
      }

      const method = (init?.method ?? 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
        throw new PassiveGuardrailError(`state-changing method not allowed: ${method}`)
      }

      /**
       * The publisher's minimum interval, honoured without blocking.
       *
       * ## The bug this replaces, which was severe
       *
       * This used to `await` the full remaining interval. For the coded sources
       * that is 1.5–3 seconds and harmless. For a catalogue feed it is
       * **900 to 3,600 seconds** — so the *second* request to reach a warm
       * container slept fifteen minutes inside a ten-second request, was killed
       * by the orchestrator's 8s deadline, and reported as a failure. Every
       * catalogue source at once.
       *
       * That is the intermittent production fault: one reading of the live
       * board showed *112 sources failed, 125 events, 0 with a stated date* —
       * exactly the six hand-coded sources surviving, because their intervals
       * are short enough to wait out. A cold container looked healthy; a warm
       * one looked broken; nothing in between explained why.
       *
       * It also leaked: each blocked call left a 900-second timer pending, so
       * one sweep armed eighty of them and the process would not exit.
       *
       * ## What replaces it
       *
       * A wait we cannot afford is not politeness — it is a self-inflicted
       * outage that still ends in not fetching. So a short wait is still slept
       * (genuinely polite, and invisible), and a long one refuses immediately
       * with a distinguishable error. The orchestrator answers that error from
       * the last successful result rather than reporting a dead source.
       *
       * The publisher is protected either way: the request is not made. The
       * only thing that changed is that we stop punishing ourselves for it.
       */
      if (minIntervalMs && minIntervalMs > 0) {
        const last = this.lastCallAt.get(sourceKey) ?? 0
        const wait = last + minIntervalMs - Date.now()
        if (wait > MAX_POLITE_WAIT_MS) {
          throw new RateLimitedError(sourceKey, wait)
        }
        if (wait > 0) await new Promise((r) => setTimeout(r, wait))
        this.lastCallAt.set(sourceKey, Date.now())
      }

      return fetch(url, { ...init, method })
    }
  }
}
