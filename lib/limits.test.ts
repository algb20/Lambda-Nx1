import { describe, expect, it } from 'vitest'
import { callerLimit, callerLimits } from './limits'
import { GATEWAY_LIMIT, WRITE_LIMIT } from './rate-limit'
import { SIGN_IN_LIMIT, SIGN_IN_SUBJECT_LIMIT } from './auth/sign-in-limit'
import { CODE_LIMIT } from './auth/code-flow'

/**
 * The limits moved from code to `config/rate-limits.json` on 2026-10-04
 * (owner R312) **without changing a value**. These are the values they had in
 * code at `39188d8`; a change to any of them is a policy decision (R308) and
 * must change this test on purpose, with the decision cited.
 */
const UNCHANGED = {
  gateway: { limit: 30, windowMs: 60_000 },
  write: { limit: 10, windowMs: 60_000 },
  signIn: { limit: 10, windowMs: 60_000 },
  signInSubject: { limit: 20, windowMs: 60_000 },
  code: { limit: 10, windowMs: 60_000 },
}

describe('caller limits, read from configuration', () => {
  it('kept every value it had in code', () => {
    expect(callerLimits()).toEqual(UNCHANGED)
  })

  it('is what the limiters actually use', () => {
    expect(GATEWAY_LIMIT).toEqual(callerLimit('gateway'))
    expect(WRITE_LIMIT).toEqual(callerLimit('write'))
    expect(SIGN_IN_LIMIT).toEqual(callerLimit('signIn'))
    expect(SIGN_IN_SUBJECT_LIMIT).toEqual(callerLimit('signInSubject'))
    expect(CODE_LIMIT).toEqual(callerLimit('code'))
  })

  it('keeps the subject limit above the caller limit, so typing an email cannot lock its owner out', () => {
    expect(SIGN_IN_SUBJECT_LIMIT.limit).toBeGreaterThan(SIGN_IN_LIMIT.limit)
  })
})
