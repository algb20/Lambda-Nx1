import { describe, expect, it } from 'vitest'
import { ANONYMOUS_NAME, publicNameFor } from './public-name'

describe('what an account is called in public', () => {
  it('uses the handle, which is the public identity', () => {
    expect(publicNameFor({ username: 'pioneer_42', displayName: 'Pioneer 42' })).toBe('pioneer_42')
  })

  it('falls back to the display name for accounts older than handles', () => {
    expect(publicNameFor({ username: null, displayName: 'Pioneer 42' })).toBe('Pioneer 42')
  })

  it('names an account with neither rather than rendering nothing', () => {
    expect(publicNameFor({})).toBe(ANONYMOUS_NAME)
    expect(publicNameFor(null)).toBe(ANONYMOUS_NAME)
    expect(publicNameFor({ username: '  ', displayName: '' })).toBe(ANONYMOUS_NAME)
  })

  /**
   * The reason this module exists. Several surfaces fell back to `externalId`,
   * which is an email address for a standalone account and a UUID for a Pi one
   * — a leak in the first case and gibberish in the second. There is no path
   * through this function that can reach it, because it is not an input.
   */
  it('cannot render an email address or a uid, because it is never given one', () => {
    const name = publicNameFor({ username: null, displayName: null })
    expect(name).not.toContain('@')
    expect(name).toBe(ANONYMOUS_NAME)
  })
})
