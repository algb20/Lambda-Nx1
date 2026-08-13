import { describe, it, expect } from 'vitest'
import {
  RateLimiter,
  callerKey,
  rateLimitHeaders,
  rateLimitGate,
  GATEWAY_LIMIT,
} from './rate-limit'

/**
 * A rate limiter that is wrong is worse than none: it either lets the abuse
 * through (and the provider bans us) or refuses honest traffic (and the product
 * looks broken). Both failures are silent in production, so the behaviour is
 * pinned here with an injected clock rather than trusted.
 */
describe('RateLimiter', () => {
  /** A clock we move by hand, so no test sleeps. */
  function clock(start = 1_000_000) {
    let t = start
    return { now: () => t, advance: (ms: number) => (t += ms) }
  }

  it('allows exactly the limit and refuses the next one', () => {
    const c = clock()
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000 }, c.now)

    expect(limiter.check('a').ok).toBe(true)
    expect(limiter.check('a').ok).toBe(true)
    const last = limiter.check('a')
    expect(last.ok).toBe(true)
    expect(last.remaining).toBe(0)

    expect(limiter.check('a').ok).toBe(false)
  })

  it('counts each caller separately', () => {
    const c = clock()
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 }, c.now)

    expect(limiter.check('a').ok).toBe(true)
    expect(limiter.check('a').ok).toBe(false)
    // b must not inherit a's exhaustion.
    expect(limiter.check('b').ok).toBe(true)
  })

  it('reopens once the window rolls', () => {
    const c = clock()
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 }, c.now)

    expect(limiter.check('a').ok).toBe(true)
    c.advance(59_999)
    expect(limiter.check('a').ok).toBe(false)
    c.advance(2)
    expect(limiter.check('a').ok).toBe(true)
  })

  it('tells a refused caller how long to wait, never zero', () => {
    const c = clock()
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 }, c.now)
    limiter.check('a')

    expect(limiter.check('a').retryAfterSeconds).toBe(60)

    // A client told "retry in 0s" retries immediately and makes it worse, so
    // the floor is one second even in the last millisecond of a window.
    c.advance(59_999)
    expect(limiter.check('a').retryAfterSeconds).toBe(1)
  })

  it('does not consume a request when it refuses', () => {
    const c = clock()
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 }, c.now)
    limiter.check('a')
    const first = limiter.check('a')
    limiter.check('a')
    const third = limiter.check('a')
    // A refusal must not push the reset further out, or a looping client would
    // lock itself out forever.
    expect(third.resetAt).toBe(first.resetAt)
  })

  it('drops expired keys instead of growing without bound', () => {
    const c = clock()
    const limiter = new RateLimiter({ limit: 5, windowMs: 1_000 }, c.now)
    for (let i = 0; i < 1_200; i++) limiter.check(`caller-${i}`)
    expect(limiter.size).toBe(1_200)

    c.advance(2_000)
    // The sweep runs when a window rolls; one call is enough to trigger it.
    limiter.check('someone-new')
    expect(limiter.size).toBe(1)
  })
})

describe('callerKey', () => {
  it('prefers the host header that a proxy cannot be tricked into forging', () => {
    const headers = new Headers({
      'x-nf-client-connection-ip': '203.0.113.7',
      'x-forwarded-for': '198.51.100.1, 203.0.113.7',
    })
    expect(callerKey(headers)).toBe('203.0.113.7')
  })

  it('takes the leftmost forwarded address, which is the original client', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.4, 10.0.0.5' })
    expect(callerKey(headers)).toBe('198.51.100.1')
  })

  it('falls back to x-real-ip, then to a shared bucket', () => {
    expect(callerKey(new Headers({ 'x-real-ip': '192.0.2.9' }))).toBe('192.0.2.9')
    expect(callerKey(new Headers())).toBe('unknown')
  })

  it('ignores an empty forwarded header rather than keying on ""', () => {
    // An empty string as a key would put every anonymous caller in one bucket
    // *and* read as present, hiding the x-real-ip fallback.
    expect(callerKey(new Headers({ 'x-forwarded-for': '   ' }))).toBe('unknown')
  })
})

describe('rateLimitHeaders', () => {
  it('reports the remaining budget so an honest client can pace itself', () => {
    const headers = rateLimitHeaders(
      { ok: true, remaining: 7, resetAt: 1_700_000_000_000, retryAfterSeconds: 0 },
      { limit: 30, windowMs: 60_000 },
    )
    expect(headers['x-ratelimit-limit']).toBe('30')
    expect(headers['x-ratelimit-remaining']).toBe('7')
    expect(headers['x-ratelimit-reset']).toBe('1700000000')
    expect(headers['retry-after']).toBeUndefined()
  })

  it('adds retry-after only on a refusal', () => {
    const headers = rateLimitHeaders(
      { ok: false, remaining: 0, resetAt: 1_700_000_000_000, retryAfterSeconds: 42 },
      { limit: 30, windowMs: 60_000 },
    )
    expect(headers['retry-after']).toBe('42')
  })
})

describe('rateLimitGate', () => {
  const request = (ip: string) =>
    new Request('https://example.test/api/intelligence/domain', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
    })

  it('returns null while the caller is within budget', () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 60_000 })
    expect(rateLimitGate(request('203.0.113.1'), limiter, GATEWAY_LIMIT)).toBeNull()
  })

  it('answers 429 with JSON and a retry-after once the budget is spent', async () => {
    const options = { limit: 1, windowMs: 60_000 }
    const limiter = new RateLimiter(options)
    rateLimitGate(request('203.0.113.2'), limiter, options)

    const refused = rateLimitGate(request('203.0.113.2'), limiter, options)
    expect(refused).not.toBeNull()
    expect(refused!.status).toBe(429)
    expect(refused!.headers.get('retry-after')).toBe('60')
    // JSON, not an HTML error page: the client parses this.
    const body = (await refused!.json()) as { error: string; retryAfterSeconds: number }
    expect(body.retryAfterSeconds).toBe(60)
    expect(body.error).toMatch(/too many requests/i)
  })
})

describe('the shipped limits', () => {
  it('leaves room for a real investigation without leaving room for a loop', () => {
    // A Nexus run fans out across gateways; a human doing that repeatedly still
    // stays under 30/min, while a script cannot exhaust a provider quota.
    expect(GATEWAY_LIMIT.limit).toBeGreaterThanOrEqual(20)
    expect(GATEWAY_LIMIT.limit).toBeLessThanOrEqual(60)
    expect(GATEWAY_LIMIT.windowMs).toBe(60_000)
  })
})
