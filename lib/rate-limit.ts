/**
 * Rate limiting for the open gateways.
 *
 * Every gateway is open without an account (charter §1), which is deliberate and
 * worth keeping. But it means one visitor with a loop can spend our whole
 * relationship with the public providers we depend on — NASA, USGS, Wikipedia,
 * CISA — and those providers rate-limit *us*, not the visitor. The failure lands
 * on everyone else: the map goes empty and every user sees a product that does
 * not work.
 *
 * So the limit protects the providers' goodwill, not our servers.
 *
 * **What this does and does not guarantee.** It is an in-memory token bucket, so
 * it is per running instance. On a serverless host several instances exist and a
 * determined attacker spread across them gets a multiple of the limit. That is a
 * real ceiling and it is stated here rather than hidden: what this reliably stops
 * is the ordinary case — one client hammering one endpoint in a loop, which is
 * what actually exhausts a provider quota. A globally exact limit means a
 * database round trip on every request to a keyless public endpoint, which costs
 * every honest user latency to punish a rare one.
 *
 * Pure and clock-injectable, so the behaviour is tested rather than assumed.
 */

export interface RateLimitResult {
  ok: boolean
  /** Requests still available in the current window. */
  remaining: number
  /** When the window resets, as an epoch millisecond timestamp. */
  resetAt: number
  /** Seconds to wait, for the `Retry-After` header. Zero when allowed. */
  retryAfterSeconds: number
}

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

/** The gateways fan out to several third-party providers per call. */
export const GATEWAY_LIMIT: RateLimitOptions = { limit: 30, windowMs: 60_000 }

/** Writes are cheaper to serve but more attractive to abuse. */
export const WRITE_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 }

interface Bucket {
  count: number
  resetAt: number
}

/**
 * A fixed-window counter per key.
 *
 * Fixed window rather than sliding: a sliding window needs the timestamp of
 * every request retained per key, which is unbounded memory for an endpoint
 * whose whole purpose is to be hit by strangers. The known cost is a burst at a
 * window boundary — up to twice the limit across two adjacent windows — which is
 * an acceptable trade for a bound we cannot be made to exceed.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  constructor(
    private readonly options: RateLimitOptions,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const now = this.now()
    let bucket = this.buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.options.windowMs }
      this.buckets.set(key, bucket)
      // An expired key is dead weight; sweeping here keeps the map bounded by
      // *active* callers rather than by everyone who ever called.
      this.sweep(now)
    }

    if (bucket.count >= this.options.limit) {
      return {
        ok: false,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      }
    }

    bucket.count += 1
    return {
      ok: true,
      remaining: this.options.limit - bucket.count,
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    }
  }

  /** Drop expired buckets. Bounded work: it only runs when a window rolls. */
  private sweep(now: number): void {
    if (this.buckets.size < 1000) return
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key)
    }
  }

  /** Test seam. */
  get size(): number {
    return this.buckets.size
  }
}

/**
 * Who is calling.
 *
 * Behind a CDN the socket address is the CDN's, so the forwarded header is the
 * only signal available — and it is client-supplied, which means it can be
 * forged. That is acceptable here precisely because the limit protects provider
 * goodwill rather than guarding a secret: someone forging headers to get more
 * requests is the rare case, and the honest majority are still bounded.
 *
 * The *first* entry is taken, since proxies append and the leftmost is the
 * original client.
 */
export function callerKey(headers: Headers, fallback = 'unknown'): string {
  const forwarded = headers.get('x-nf-client-connection-ip') ?? headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || headers.get('x-real-ip')?.trim() || fallback
}

/** Headers that tell an honest client how much room it has left. */
export function rateLimitHeaders(result: RateLimitResult, options: RateLimitOptions) {
  const headers: Record<string, string> = {
    'x-ratelimit-limit': String(options.limit),
    'x-ratelimit-remaining': String(result.remaining),
    'x-ratelimit-reset': String(Math.ceil(result.resetAt / 1000)),
  }
  if (!result.ok) headers['retry-after'] = String(result.retryAfterSeconds)
  return headers
}

/** One limiter per purpose, shared across requests in the same instance. */
export const gatewayLimiter = new RateLimiter(GATEWAY_LIMIT)
export const writeLimiter = new RateLimiter(WRITE_LIMIT)

/**
 * Guard a request. Returns a 429 to send back, or null to continue.
 *
 * The refusal says *when* to retry rather than only that it failed, because a
 * client told "no" with no time attached retries immediately and makes the
 * problem worse.
 */
export function rateLimitGate(
  request: Request,
  limiter: RateLimiter = gatewayLimiter,
  options: RateLimitOptions = GATEWAY_LIMIT,
): Response | null {
  const result = limiter.check(callerKey(request.headers))
  if (result.ok) return null
  return Response.json(
    {
      error: 'Too many requests. The gateways read public providers that rate-limit us in turn, so this protects everyone using the app.',
      retryAfterSeconds: result.retryAfterSeconds,
    },
    { status: 429, headers: rateLimitHeaders(result, options) },
  )
}
