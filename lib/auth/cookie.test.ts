import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { attachSession, clearSession } from './cookie'
import { SESSION_COOKIE } from './session'

/**
 * One cookie, one definition.
 *
 * The attributes were spelled out in two places — `attachSession` here and the
 * logout route — and had already drifted: logout cleared the session without
 * `sameSite` or `secure`. Deleting still worked, because a browser matches on
 * name, domain and path. The risk was never this attribute; it was that two
 * descriptions of one cookie is how the *next* one gets set on the way in and
 * forgotten on the way out, on the cookie that is the session.
 */
describe('the session cookie is described once', () => {
  // `attachSession` signs a real token, so the signer needs a real secret.
  beforeEach(() => vi.stubEnv('SESSION_SECRET', 's'.repeat(32)))
  afterEach(() => vi.unstubAllEnvs())

  const setFlags = () => {
    const res = NextResponse.json({})
    attachSession(res, 'user-1')
    return res.cookies.get(SESSION_COOKIE)
  }
  const clearFlags = () => {
    const res = NextResponse.json({})
    clearSession(res)
    return res.cookies.get(SESSION_COOKIE)
  }

  it('sets a cookie that script cannot read and that does not travel cross-site', () => {
    const c = setFlags()
    expect(c?.httpOnly).toBe(true)
    expect(c?.sameSite).toBe('lax')
    expect(c?.path).toBe('/')
    expect(c?.value).toBeTruthy()
  })

  it('clears it with the same attributes it was set with', () => {
    const set = setFlags()
    const cleared = clearFlags()
    expect(cleared?.httpOnly).toBe(set?.httpOnly)
    expect(cleared?.sameSite).toBe(set?.sameSite)
    expect(cleared?.path).toBe(set?.path)
    expect(cleared?.secure).toBe(set?.secure)
  })

  it('clears by emptying the value and expiring it immediately', () => {
    const c = clearFlags()
    expect(c?.value).toBe('')
    expect(c?.maxAge).toBe(0)
  })

  /** Off in development so a plain-HTTP localhost can still hold a session. */
  it('marks the cookie secure in production and not in development', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(setFlags()?.secure).toBe(true)
    expect(clearFlags()?.secure).toBe(true)
    vi.stubEnv('NODE_ENV', 'development')
    expect(setFlags()?.secure).toBe(false)
  })
})
