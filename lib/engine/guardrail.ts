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
 * The longest we will wait for a provider to answer before abandoning it.
 *
 * ## Why the orchestrator's deadline was not this
 *
 * `orchestrator.ts` already bounds a source at `SOURCE_TIMEOUT_MS` — but it
 * does it with `Promise.race`, which settles *our* promise and does nothing at
 * all to the request. The socket stays open, the body keeps arriving, and the
 * connection is held until the runtime tears the process down. Under a sweep
 * that is dozens of abandoned sockets belonging to work whose result has
 * already been declared a timeout, competing for the same connection pool as
 * the sources still being read.
 *
 * Worse, the paths with no orchestrator are the ones that run unattended: the
 * cron jobs, the catalogue sweep, the quarantine re-probe. There, a provider
 * that accepts a connection and never answers stalls the whole job — undici's
 * own ceiling is five minutes, which is longer than any function budget this
 * platform deploys under. So the job dies with no result, and a scheduler that
 * sees a dead function cannot tell it from a dead platform.
 *
 * A real abort belongs at the one place every engine request passes through.
 * Above the orchestrator's 8s so nothing about its behaviour changes; far below
 * any function budget so an unattended job survives a silent host.
 */
export const REQUEST_TIMEOUT_MS = 10_000

/**
 * How the engine identifies itself to every provider it reads.
 *
 * A contact address is part of it because several providers — the SEC most
 * explicitly — require one, and because a provider who wants to tell us we are
 * being a nuisance should not have to guess how. `ENGINE_CONTACT` lets a
 * deployment substitute its own operator; the default is the project's.
 *
 * **No URL in it.** The obvious form — `Name/1.0 (+https://project.example)` —
 * is what half the web publishes and it is refused outright by the SEC's edge
 * filter with a 403, whichever way it is phrased. Measured, not assumed: a
 * name-and-contact string is accepted by every provider in the catalogue, and a
 * string containing a link is not. The repository is discoverable from the
 * contact address; a blocked request discovers nothing.
 */
export const USER_AGENT = `LambdaNX/1.0 (${
  process.env.ENGINE_CONTACT?.trim() || 'contact@lambdanx.app'
})`

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

      /**
       * Say who we are, on every request the engine makes.
       *
       * Not decoration. The SEC refuses anonymous automated traffic outright
       * (403 with a plain-text scolding), Wikimedia and USGS ask for it in
       * their terms, and a provider who can see which client is misbehaving can
       * throttle that client instead of blocking a whole address range. It is
       * also the honest thing for a passive-only engine to do: we are reading
       * their data, and they are entitled to know it is us and how to reach us.
       *
       * A source may override it — `init.headers` wins — for the rare provider
       * that requires a specific string.
       */
      const headers = new Headers(init?.headers)
      if (!headers.has('user-agent')) headers.set('user-agent', USER_AGENT)

      /**
       * A caller's own signal still wins; the deadline is added to it, never
       * substituted for it. A source that cancels for its own reasons — a user
       * navigating away, a deadline shorter than ours — must keep working.
       */
      const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline
      return fetch(url, { ...init, method, headers, signal })
    }
  }
}
