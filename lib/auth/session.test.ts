import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createSession, verifySession, canIssueSessions } from './session'

beforeAll(() => {
  process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-000'
})

describe('session tokens', () => {
  it('round-trips a user id', () => {
    const token = createSession('user-123')
    expect(verifySession(token)).toBe('user-123')
  })

  it('rejects a tampered payload', () => {
    const token = createSession('user-123')
    const [, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64url')
    expect(verifySession(`${forged}.${sig}`)).toBeNull()
  })

  it('rejects an expired token', () => {
    const token = createSession('user-123', -10) // already expired
    expect(verifySession(token)).toBeNull()
  })

  it('rejects garbage', () => {
    expect(verifySession('')).toBeNull()
    expect(verifySession('nope')).toBeNull()
    expect(verifySession(null)).toBeNull()
  })
})

/**
 * Sign-up writes a user row and *then* signs the cookie. If a deployment cannot
 * sign one, that order leaves an account created and its owner locked out, with
 * their second attempt told the email is already taken. So registration asks
 * this before it writes anything, and the answer has to be right for a secret
 * that is missing, empty, or merely too short to be worth signing with.
 */
describe('canIssueSessions', () => {
  const original = process.env.SESSION_SECRET
  afterEach(() => {
    process.env.SESSION_SECRET = original
  })

  it('is true for a secret long enough to sign with', () => {
    process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-000'
    expect(canIssueSessions()).toBe(true)
  })

  it('is false when the secret is missing or empty', () => {
    delete process.env.SESSION_SECRET
    expect(canIssueSessions()).toBe(false)
    process.env.SESSION_SECRET = ''
    expect(canIssueSessions()).toBe(false)
  })

  it('is false for a secret too short to be worth signing with', () => {
    process.env.SESSION_SECRET = 'short'
    expect(canIssueSessions()).toBe(false)
    // Exactly at the boundary is acceptable; one below is not.
    process.env.SESSION_SECRET = 'a'.repeat(15)
    expect(canIssueSessions()).toBe(false)
    process.env.SESSION_SECRET = 'a'.repeat(16)
    expect(canIssueSessions()).toBe(true)
  })

  it('agrees with what createSession will actually do', () => {
    // The check is worthless if it says yes where signing throws, or no where
    // signing would have worked.
    process.env.SESSION_SECRET = 'a'.repeat(16)
    expect(canIssueSessions()).toBe(true)
    expect(() => createSession('user-123')).not.toThrow()

    process.env.SESSION_SECRET = 'a'.repeat(15)
    expect(canIssueSessions()).toBe(false)
    expect(() => createSession('user-123')).toThrow()
  })
})
