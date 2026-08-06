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

      if (minIntervalMs && minIntervalMs > 0) {
        const last = this.lastCallAt.get(sourceKey) ?? 0
        const wait = last + minIntervalMs - Date.now()
        if (wait > 0) await new Promise((r) => setTimeout(r, wait))
        this.lastCallAt.set(sourceKey, Date.now())
      }

      return fetch(url, { ...init, method })
    }
  }
}
