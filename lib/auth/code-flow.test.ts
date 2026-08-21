import { describe, it, expect, vi } from 'vitest'

/**
 * The account routes' answer when the database — not the visitor — is at fault.
 *
 * ## What this is for
 *
 * A deployment ran with `DATABASE_URL` set and its host unreachable. Pressing
 * "send code" during sign-up returned **HTTP 500 with a zero-length body**, and
 * the form, having nothing to render, said "an error occurred". Every one of
 * these tests asserts the property that was missing: whatever goes wrong, the
 * response says which kind of thing went wrong, and it is never blamed on the
 * person typing.
 */

// The helper reaches lib/db only for the explainer, which is pure. Stubbing it
// keeps this suite from loading the driver and the whole schema for a unit test.
vi.mock('@/lib/db', async () => {
  const errors = await import('@/lib/db/errors')
  return {
    isDbConfigured: () => true,
    databaseAvailability: async () => ({ live: true, detail: null, hint: null, code: null }),
    explainDatabaseError: errors.explainDatabaseError,
    describeDatabaseError: errors.describeDatabaseError,
  }
})

function driverError(message: string, code: string): Error {
  const err = new Error(message)
  ;(err as { code?: string }).code = code
  return err
}

/** Drizzle's wrapper, which is what a route actually catches. */
function wrapped(cause: unknown): Error {
  const err = new Error('Failed query: insert into "verification_codes" …')
  ;(err as { cause?: unknown }).cause = cause
  return err
}

async function answerFor(err: unknown) {
  const { databaseUnavailable } = await import('./code-flow')
  const response = databaseUnavailable('auth/verify/request', err)
  if (!response) return null
  return { status: response.status, body: (await response.json()) as { error?: string; reason?: string } }
}

describe('databaseUnavailable', () => {
  it('answers 503 with a readable body, never an empty 500', async () => {
    const answer = await answerFor(wrapped(driverError('connect ETIMEDOUT', 'ETIMEDOUT')))
    expect(answer).not.toBeNull()
    expect(answer!.status).toBe(503)
    expect(answer!.body.error?.length ?? 0).toBeGreaterThan(20)
  })

  /**
   * The sentence a visitor reads has one job beyond being true: stop them
   * retrying their own input. Someone told only "an error occurred" retypes
   * their address, tries a different password, and blames themselves.
   */
  it('tells the visitor it is not their fault, and that nothing was sent', async () => {
    const answer = await answerFor(wrapped(driverError('getaddrinfo ENOTFOUND h.invalid', 'ENOTFOUND')))
    expect(answer!.body.error).toMatch(/no code was sent/i)
    expect(answer!.body.error).toMatch(/not something wrong with what you entered/i)
  })

  it('carries a machine-readable reason a client can branch on', async () => {
    const answer = await answerFor(wrapped(driverError('connect ECONNREFUSED', 'ECONNREFUSED')))
    expect(answer!.body.reason).toBe('database_unreachable')
  })

  /**
   * A schema that was never applied will not fix itself, so inviting a retry
   * is worse than useless — it hides a five-minute operator task behind an
   * afternoon of the user trying again.
   */
  it('does not invite a retry when the schema is simply missing', async () => {
    const answer = await answerFor(
      wrapped(driverError('relation "verification_codes" does not exist', '42P01')),
    )
    expect(answer!.body.reason).toBe('database_schema')
    expect(answer!.body.error).not.toMatch(/try again/i)
  })

  it('asks for a retry when the database is merely out of connections', async () => {
    const answer = await answerFor(wrapped(driverError('sorry, too many clients already', '53300')))
    expect(answer!.body.reason).toBe('database_capacity')
    expect(answer!.body.error).toMatch(/try again/i)
  })

  /**
   * The essential negative. A taken username is not an outage: dressing it up
   * as one would tell the user to come back later over something they could
   * fix in two seconds, and would hide real bugs behind an excuse an operator
   * would go looking for and never find.
   */
  it('declines to handle a rejected statement, leaving it to the route', async () => {
    const answer = await answerFor(
      wrapped(driverError('duplicate key value violates unique constraint "users_username_uq"', '23505')),
    )
    expect(answer).toBeNull()
  })

  it('never leaks the connection string it was given', async () => {
    const answer = await answerFor(
      driverError('could not connect to postgresql://u:hunter2@db.secret.supabase.co:5432/postgres', 'ECONNREFUSED'),
    )
    expect(JSON.stringify(answer!.body)).not.toContain('hunter2')
    expect(JSON.stringify(answer!.body)).not.toContain('secret')
  })
})
