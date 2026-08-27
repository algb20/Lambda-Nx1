import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * The corrupted signup that actually happened, on a real deployment.
 *
 * On 2026-08-27, against a freshly configured Netlify site with a live
 * database, the first `POST /api/auth/register` **hung for over sixty seconds
 * and created the account anyway**. The caller's request had already been cut,
 * so the session cookie reached nobody. The second attempt was answered *"That
 * username is taken"* — by an account its owner never saw made. Every
 * registration after that took two seconds.
 *
 * The cause was one `await`: `accountsUnavailable` waited for `ensureSchema()`
 * inside the visitor's request, and applying the schema is bounded at 25
 * seconds — longer than a serverless function lives. The function died, and the
 * work carried on to write the row into a response nobody would receive.
 *
 * `accountsUnavailable`'s own docstring says it exists so that "asking first
 * turns a corrupted signup into an honest 'not available right now'". These
 * tests hold it to that through the one door it had left open.
 */

const ensureSchema = vi.fn<() => Promise<boolean>>()

vi.mock('@/lib/db', () => ({
  isDbConfigured: () => true,
  databaseAvailability: async () => ({ live: true, detail: null, hint: null, code: null }),
  ensureSchema: () => ensureSchema(),
  explainDatabaseError: () => null,
  describeDatabaseError: () => null,
}))

vi.mock('@/lib/auth/session', () => ({ canIssueSessions: () => true }))

const never = () => new Promise<boolean>(() => {})

beforeEach(() => {
  ensureSchema.mockReset()
})

/**
 * The waiting is tested directly, with a budget measured in milliseconds. The
 * route-level behaviour is tested below at the real budget, but only twice —
 * a suite that sleeps three seconds per case is a suite people start skipping.
 */
describe('waiting for the schema is bounded', () => {
  const wait = async (budget = 20) => {
    const { schemaReadyWithin } = await import('./code-flow')
    return schemaReadyWithin(budget)
  }

  it('returns true the moment the schema is ready', async () => {
    ensureSchema.mockResolvedValue(true)
    expect(await wait()).toBe(true)
  })

  it('gives up on a heal that outlasts the budget', async () => {
    ensureSchema.mockImplementation(never)
    expect(await wait()).toBe(false)
  })

  /**
   * Racing the raw promise let a rejected heal propagate out of the route as a
   * blank 500 — the exact failure this module exists to abolish. Found by this
   * test, not by reading the code.
   */
  it('treats a heal that throws as not-ready, not as an exception', async () => {
    ensureSchema.mockRejectedValue(new Error('relation already exists'))
    await expect(wait()).resolves.toBe(false)
  })

  /**
   * Giving up must not cancel the healing. A deployment where every request
   * abandons the schema is one where the tables are never created at all — a
   * worse failure than the one being fixed.
   */
  it('leaves the work running after it stops waiting', async () => {
    let settle: ((ready: boolean) => void) | undefined
    ensureSchema.mockImplementation(() => new Promise<boolean>((resolve) => (settle = resolve)))
    expect(await wait()).toBe(false)
    expect(settle, 'the healing promise was abandoned mid-flight').toBeDefined()

    settle?.(true)
    ensureSchema.mockResolvedValue(true)
    expect(await wait()).toBe(true)
  })
})

describe('what the visitor is told while the schema is being created', () => {
  const ask = async () => {
    const { accountsUnavailable } = await import('./code-flow')
    const res = await accountsUnavailable('auth/register')
    if (!res) return null
    return {
      status: res.status,
      retryAfter: res.headers.get('Retry-After'),
      body: (await res.json()) as Record<string, string>,
    }
  }

  it('lets the request through when the schema is already there', async () => {
    ensureSchema.mockResolvedValue(true)
    expect(await ask(), 'a warm deployment must pay nothing for this').toBeNull()
  })

  /**
   * The opposite advice from the `schema` message, deliberately: there nothing
   * changes until a person acts, so a retry loop wastes their afternoon. Here
   * the tables are being created right now and the next attempt succeeds.
   */
  it('refuses honestly, invites a retry, and promises nothing was created', async () => {
    ensureSchema.mockImplementation(never)
    const answer = await ask()
    expect(answer?.status).toBe(503)
    expect(answer?.body.reason).toBe('schema_initialising')
    expect(answer?.body.error).toMatch(/try again shortly/i)
    expect(answer?.body.error, 'the second attempt must not find a stranger holding the name').toMatch(
      /nothing was created/i,
    )
    expect(answer?.retryAfter, 'a client that retries blindly is the other failure').toBeTruthy()
  })
})
