import { beforeEach, describe, expect, it } from 'vitest'
import {
  SIGN_IN_LIMIT,
  SIGN_IN_SUBJECT_LIMIT,
  signInLimiter,
  signInRateLimit,
  signInSubjectLimiter,
  subjectKey,
} from './sign-in-limit'

/**
 * The policy `lib/api-scope.ts` said sign-in needed and did not have.
 *
 * That module exempts all of `/api/auth/` from the gateway limit, with the
 * reason written out: "sign-in needs its own far tighter policy". The code-flow
 * routes carried their own limiter, so `verify/*` and `password/*` were fine.
 * `login`, `register` and `auth/pi` had nothing — exempt from the middleware,
 * holding no limit of their own, on the endpoints where guessing *is* the
 * attack. A comment describing an intention as though it were a fact.
 */

const from = (ip: string, body?: unknown) =>
  new Request('https://lambda.test/api/auth/login', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

beforeEach(() => {
  signInLimiter.reset()
  signInSubjectLimiter.reset()
})

describe('one address working through a password list', () => {
  it('lets the configured number of attempts through, then refuses', () => {
    for (let i = 0; i < SIGN_IN_LIMIT.limit; i += 1) {
      expect(signInRateLimit(from('9.9.9.1'), `u${i}@x.co`), `attempt ${i + 1}`).toBeNull()
    }
    const refused = signInRateLimit(from('9.9.9.1'), 'another@x.co')
    expect(refused?.status).toBe(429)
  })

  it('is tighter than the gateway limit it was exempted from', () => {
    expect(SIGN_IN_LIMIT.limit).toBeLessThan(30)
  })

  it('keeps one address’s budget away from another’s', () => {
    for (let i = 0; i < SIGN_IN_LIMIT.limit; i += 1) signInRateLimit(from('9.9.9.2'), `u${i}@x.co`)
    expect(signInRateLimit(from('9.9.9.2'), 'z@x.co')?.status).toBe(429)
    expect(signInRateLimit(from('9.9.9.3'), 'z@x.co')).toBeNull()
  })
})

describe('one account hammered from many addresses', () => {
  /**
   * What credential stuffing actually looks like, and what a per-IP limit alone
   * never sees: a thousand addresses trying one account once each.
   */
  it('refuses once the account has taken its share, whoever is asking', async () => {
    for (let i = 0; i < SIGN_IN_SUBJECT_LIMIT.limit; i += 1) {
      expect(signInRateLimit(from(`10.0.0.${i}`), 'victim@x.co'), `attempt ${i + 1}`).toBeNull()
    }
    const refused = signInRateLimit(from('10.0.1.1'), 'victim@x.co')
    expect(refused?.status).toBe(429)
    // …and a different account from a fresh address is unaffected.
    expect(signInRateLimit(from('10.0.1.2'), 'someone-else@x.co')).toBeNull()
  })

  /**
   * Deliberately more generous than the caller budget. A tight number here is a
   * denial-of-service handed to anybody who knows a user's email address: type
   * it a few times and lock them out.
   */
  it('gives an account more room than a single caller gets', () => {
    expect(SIGN_IN_SUBJECT_LIMIT.limit).toBeGreaterThan(SIGN_IN_LIMIT.limit)
  })

  it('treats the same address written differently as the same account', () => {
    expect(subjectKey('  Victim@X.CO ')).toBe(subjectKey('victim@x.co'))
  })

  it('does not put the address itself in the key', () => {
    expect(subjectKey('victim@x.co')).not.toContain('victim')
    expect(subjectKey('victim@x.co')).not.toContain('@')
  })
})

describe('the refusal gives nothing away', () => {
  it('says only that there were too many attempts', () => {
    for (let i = 0; i < SIGN_IN_LIMIT.limit; i += 1) signInRateLimit(from('9.9.9.4'), 'a@x.co')
    const refused = signInRateLimit(from('9.9.9.4'), 'a@x.co')
    expect(refused?.status).toBe(429)
  })

  it('does not reveal which budget was exhausted, or whether the account exists', async () => {
    for (let i = 0; i < SIGN_IN_LIMIT.limit; i += 1) signInRateLimit(from('9.9.9.5'), 'a@x.co')
    const body = await signInRateLimit(from('9.9.9.5'), 'a@x.co')!.json()
    expect(body.error).toBe('Too many sign-in attempts. Wait a moment and try again.')
    expect(JSON.stringify(body)).not.toContain('subject')
    expect(JSON.stringify(body)).not.toContain('account')
  })

  it('tells an honest client when to come back', async () => {
    for (let i = 0; i < SIGN_IN_LIMIT.limit; i += 1) signInRateLimit(from('9.9.9.6'), 'a@x.co')
    const body = await signInRateLimit(from('9.9.9.6'), 'a@x.co')!.json()
    expect(body.retryAfterSeconds).toBeGreaterThan(0)
  })
})

describe('routes that have not read a body yet', () => {
  /** `auth/pi` exchanges a token; there is no claimed identity to key on. */
  it('applies the caller budget alone when no subject is given', () => {
    for (let i = 0; i < SIGN_IN_LIMIT.limit; i += 1) {
      expect(signInRateLimit(from('9.9.9.7'))).toBeNull()
    }
    expect(signInRateLimit(from('9.9.9.7'))?.status).toBe(429)
  })

  it('ignores a blank subject rather than bucketing everyone together', () => {
    // All of these share the caller budget, and none of them share a subject
    // bucket — otherwise one empty identifier would throttle every other.
    expect(signInRateLimit(from('9.9.9.8'), '')).toBeNull()
    expect(signInRateLimit(from('9.9.9.8'), '   ')).toBeNull()
    expect(signInRateLimit(from('9.9.9.8'), null)).toBeNull()
  })
})
