import { describe, it, expect, beforeAll } from 'vitest'
import { createSession, verifySession } from './session'

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
