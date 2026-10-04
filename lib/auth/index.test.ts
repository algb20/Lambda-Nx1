import { afterEach, describe, expect, it } from 'vitest'
import { getAuthProvider } from './index'

/**
 * The Pi provider switch, and what it says when asked for something else.
 *
 * Regression: asking for any other provider answered "standalone arrives in
 * P12". Standalone sign-in shipped long ago — it runs *alongside* Pi through
 * its own routes, not through this switch — so the message sent an operator
 * looking for a phase that was already done, and implied a configuration that
 * would never work. An error message is documentation read at the worst
 * moment; it has to be true.
 */
describe('getAuthProvider', () => {
  const saved = process.env.AUTH_PROVIDER
  afterEach(() => {
    if (saved === undefined) delete process.env.AUTH_PROVIDER
    else process.env.AUTH_PROVIDER = saved
  })

  it('selects Pi by default', () => {
    delete process.env.AUTH_PROVIDER
    expect(getAuthProvider().name).toBe('pi')
  })

  it('refuses an unknown provider without promising a future phase', () => {
    process.env.AUTH_PROVIDER = 'standalone'
    expect(() => getAuthProvider()).toThrow(/AUTH_PROVIDER="standalone"/)
    expect(() => getAuthProvider()).not.toThrow(/arrives in|P12/)
  })

  it('says where standalone sign-in actually lives', () => {
    process.env.AUTH_PROVIDER = 'standalone'
    expect(() => getAuthProvider()).toThrow(/\/api\/auth\/login/)
  })
})
