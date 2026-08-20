import { afterEach, describe, expect, it, vi } from 'vitest'
import { isUsernameConflict, piHandleFor } from './pi-identity'
import { piAuthProvider } from './pi'

describe('the handle a pioneer carries', () => {
  it('takes the name Pi issued', () => {
    expect(piHandleFor({ username: 'pioneer_42' })).toBe('pioneer_42')
  })

  it('lowercases it, because handles live in one case-insensitive namespace', () => {
    expect(piHandleFor({ username: 'Pioneer_42' })).toBe('pioneer_42')
  })

  /**
   * The defect this function exists for.
   *
   * Pi's `/v2/me` returns a `uid` *and* a `username`, and the route used to
   * build the handle from whichever it had stored as the identity — the uid. A
   * uid is a 36-character UUID with hyphens, so it failed the username rules,
   * the handle was quietly dropped, and every pioneer ended up with an account
   * that had no name attached. Nothing errored; the product simply had a user
   * with no handle.
   */
  it('never produces a handle from a uid', () => {
    expect(piHandleFor({ username: null })).toBeNull()
    // What the old code effectively did, asserted as unusable.
    expect(piHandleFor({ username: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' })).toBeNull()
  })

  it('declines a reserved name rather than letting a pioneer shadow a route', () => {
    expect(piHandleFor({ username: 'admin' })).toBeNull()
    expect(piHandleFor({ username: 'settings' })).toBeNull()
  })

  it('declines a name our namespace cannot hold, without refusing the pioneer', () => {
    expect(piHandleFor({ username: 'ab' })).toBeNull() // too short
    expect(piHandleFor({ username: 'a'.repeat(31) })).toBeNull() // too long
    expect(piHandleFor({ username: 'has spaces' })).toBeNull()
  })
})

describe('telling a name collision from a real database fault', () => {
  it('recognises the unique violation on username', () => {
    expect(
      isUsernameConflict({ code: '23505', constraint: 'users_username_unique', message: 'duplicate key' }),
    ).toBe(true)
  })

  /**
   * A genuine fault silently downgraded to "no handle" would be worse than the
   * bug this whole file fixes, so anything that is not *this* conflict must
   * still propagate.
   */
  it('does not swallow a unique violation on some other column', () => {
    expect(isUsernameConflict({ code: '23505', constraint: 'users_external_id_unique' })).toBe(false)
  })

  it('does not swallow an ordinary error', () => {
    expect(isUsernameConflict(new Error('connection refused'))).toBe(false)
    expect(isUsernameConflict(null)).toBe(false)
    expect(isUsernameConflict('23505')).toBe(false)
  })
})

describe('verifying a Pi access token against the official Pi Platform API', () => {
  const fetchMock = vi.fn()
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  const stub = (response: unknown, ok = true) => {
    fetchMock.mockResolvedValue({ ok, json: async () => response })
    vi.stubGlobal('fetch', fetchMock)
  }

  it('calls Pi /v2/me with the token as a bearer credential', async () => {
    stub({ uid: 'uid-1', username: 'pioneer_42' })
    await piAuthProvider.verify('tok')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.minepi.com/v2/me')
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer tok' })
  })

  /**
   * The two fields are different facts and the identity must keep them apart:
   * the uid is what says "same person as last time", the username is what we
   * call them. Pi lets a pioneer change their username; keying the account on
   * it would turn a rename into a stranger.
   */
  it('keeps the permanent uid and the changeable username apart', async () => {
    stub({ uid: 'uid-1', username: 'pioneer_42' })
    expect(await piAuthProvider.verify('tok')).toEqual({
      provider: 'pi',
      externalId: 'uid-1',
      username: 'pioneer_42',
      displayName: 'pioneer_42',
    })
  })

  it('falls back to the username as the id only when no uid was returned', async () => {
    stub({ username: 'pioneer_42' })
    const identity = await piAuthProvider.verify('tok')
    expect(identity?.externalId).toBe('pioneer_42')
    expect(identity?.username).toBe('pioneer_42')
  })

  it('reports no username rather than an empty one', async () => {
    stub({ uid: 'uid-1', username: '   ' })
    const identity = await piAuthProvider.verify('tok')
    expect(identity?.username).toBeNull()
  })

  it('refuses an unverified token instead of trusting the caller', async () => {
    stub({ error: 'invalid' }, false)
    expect(await piAuthProvider.verify('bad')).toBeNull()
    expect(await piAuthProvider.verify('')).toBeNull()
  })

  /**
   * A network failure must read as "not verified", never as "verified". The
   * opposite default would make Pi being unreachable a way in.
   */
  it('treats a network failure as unverified', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await piAuthProvider.verify('tok')).toBeNull()
  })

  it('refuses a response that carries neither a uid nor a username', async () => {
    stub({})
    expect(await piAuthProvider.verify('tok')).toBeNull()
  })
})
