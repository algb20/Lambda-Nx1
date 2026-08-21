import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import {
  DOWN_TTL_MS,
  LIVE_TTL_MS,
  PING_TIMEOUT_MS,
  databaseAvailability,
  resetAvailabilityCache,
} from './availability'

const original = process.env.DATABASE_URL

beforeEach(() => resetAvailabilityCache())
afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = original
  resetAvailabilityCache()
})

describe('databaseAvailability', () => {
  it('reports "not set" without attempting a connection', async () => {
    delete process.env.DATABASE_URL
    const result = await databaseAvailability()
    expect(result.live).toBe(false)
    expect(result.detail).toMatch(/DATABASE_URL is not set/)
    // The hint has to mention the redeploy, because environment variables are
    // read at boot and an owner who adds one without redeploying sees no change
    // and concludes the fix did not work.
    expect(result.hint).toMatch(/redeploy/i)
  })

  it('reports an unreachable host as not live, and never throws', async () => {
    // A host that cannot resolve. This is the production failure exactly: a
    // URL that is set, well-formed, and points nowhere.
    process.env.DATABASE_URL = 'postgresql://u:p@no-such-host.invalid:5432/postgres'
    const result = await databaseAvailability()
    expect(result.live).toBe(false)
    expect(result.detail).toBeTruthy()
  }, 15_000)

  /**
   * The asymmetry is the point, not an accident.
   *
   * A failure held as long as a success means an owner who fixes the URL sees
   * the product still broken and goes looking for a second problem. Failure
   * states must always expire faster than healthy ones.
   */
  it('forgets a failure sooner than it forgets a success', () => {
    expect(DOWN_TTL_MS).toBeLessThan(LIVE_TTL_MS)
  })

  it('gives the database less time than a user will wait', () => {
    // The ping guards a page load. Anything longer and the sign-in form is the
    // slow part of the site on a deployment that is merely misconfigured.
    expect(PING_TIMEOUT_MS).toBeLessThanOrEqual(3_000)
  })
})
