import config from '@/config/rate-limits.json'
import type { RateLimitOptions } from '@/lib/rate-limit'

/**
 * Caller-facing rate limits, read from `config/rate-limits.json`.
 *
 * They used to be literals in three modules — `lib/rate-limit.ts`,
 * `lib/auth/sign-in-limit.ts` and `lib/auth/code-flow.ts` — which made a policy
 * figure look like an implementation detail. The owner asked for them as a
 * documented configuration (R308, R312), so they were moved here unchanged; the
 * values themselves are still an open decision.
 *
 * These are **not** provider limits. How often we may call a publisher is a
 * property of that publisher, carried on its catalogue record
 * (`minIntervalSec`) and by the per-host budget in `lib/engine/host-budget.ts`.
 *
 * Read once, checked once: a value that is not a positive whole number fails
 * loudly here, at import, rather than silently disabling a limit.
 */
export type CallerLimitName = keyof typeof config.callerLimits

export function callerLimit(name: CallerLimitName): RateLimitOptions {
  const entry = config.callerLimits[name]
  const { limit, windowSeconds } = entry
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error(`config/rate-limits.json: "${name}" must have whole, positive limit and windowSeconds`)
  }
  return { limit, windowMs: windowSeconds * 1000 }
}

/** Every configured limit, for documentation surfaces and tests. */
export function callerLimits(): Record<CallerLimitName, RateLimitOptions> {
  const names = Object.keys(config.callerLimits) as CallerLimitName[]
  return Object.fromEntries(names.map((n) => [n, callerLimit(n)])) as Record<CallerLimitName, RateLimitOptions>
}
