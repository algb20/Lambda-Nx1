import { describe, it, expect } from 'vitest'
import {
  causeChain,
  describeDatabaseError,
  explainDatabaseError,
  isDatabaseUnavailable,
} from './errors'

/**
 * These cases are not invented. Each one is a failure this deployment actually
 * produced, written down so it can never again arrive as "an error occurred".
 */

/** How Drizzle presents any driver failure: a wrapper with the real cause below. */
function drizzleWrapped(cause: unknown): Error {
  const err = new Error('Failed query: select version() as version\nparams: ')
  ;(err as { cause?: unknown }).cause = cause
  return err
}

/**
 * Fixtures assembled at runtime, never written out.
 *
 * A literal connection string in a tracked file is exactly what
 * `lib/security/secret-scan` forbids — and it is right to: a scanner cannot
 * tell a test fixture from a real credential, and one with exceptions carved
 * into it stops being a scanner. Same convention as `secret-scan.test.ts`.
 */
const join_ = (...parts: string[]) => parts.join('')

function driverError(message: string, code: string): Error {
  const err = new Error(message)
  ;(err as { code?: string }).code = code
  return err
}

describe('causeChain', () => {
  it('walks the whole chain, outermost first', () => {
    const inner = new Error('inner')
    const outer = drizzleWrapped(inner)
    expect(causeChain(outer)).toEqual([outer, inner])
  })

  it('survives a self-referential chain rather than looping forever', () => {
    const err = new Error('loop') as Error & { cause?: unknown }
    err.cause = err
    expect(causeChain(err)).toEqual([err])
  })

  it('stops at the depth limit', () => {
    let err = new Error('0') as Error & { cause?: unknown }
    for (let i = 1; i < 30; i += 1) {
      const next = new Error(String(i)) as Error & { cause?: unknown }
      next.cause = err
      err = next
    }
    expect(causeChain(err).length).toBe(8)
  })

  it('handles a thrown non-error without crashing', () => {
    expect(causeChain('a string')).toEqual(['a string'])
    expect(causeChain(null)).toEqual([])
  })
})

describe('explainDatabaseError — the diagnosis, not the wrapper', () => {
  /**
   * The exact failure that cost days: the health endpoint reported
   * "Failed query: select version() as version" and nothing else, because the
   * top of the chain is the only thing anybody read.
   */
  it('reports the driver cause, never Drizzle\'s wrapper message', () => {
    const failure = explainDatabaseError(
      drizzleWrapped(driverError('getaddrinfo ENOTFOUND db.abcdefgh.supabase.co', 'ENOTFOUND')),
    )
    expect(failure.detail).not.toContain('Failed query')
    expect(failure.detail).toContain('ENOTFOUND')
    expect(failure.code).toBe('ENOTFOUND')
    expect(failure.infrastructure).toBe(true)
  })

  it('names the IPv6-only Supabase host, which is the most common cause here', () => {
    const failure = explainDatabaseError(
      drizzleWrapped(driverError('getaddrinfo ENOTFOUND db.x.supabase.co', 'ENOTFOUND')),
    )
    expect(failure.kind).toBe('unreachable')
    expect(failure.hint).toMatch(/pooler/i)
  })

  it.each([
    ['ECONNREFUSED', 'connect ECONNREFUSED 10.0.0.1:5432'],
    ['ETIMEDOUT', 'connect ETIMEDOUT'],
    ['CONNECT_TIMEOUT', 'write CONNECT_TIMEOUT'],
    ['EAI_AGAIN', 'getaddrinfo EAI_AGAIN'],
  ])('treats %s as unreachable infrastructure', (code, message) => {
    const failure = explainDatabaseError(drizzleWrapped(driverError(message, code)))
    expect(failure.kind).toBe('unreachable')
    expect(failure.infrastructure).toBe(true)
  })

  it('separates rejected credentials from an unreachable host', () => {
    const failure = explainDatabaseError(
      drizzleWrapped(driverError('password authentication failed for user "postgres"', '28P01')),
    )
    expect(failure.kind).toBe('credentials')
    // The fix is different, so the hint must be too.
    expect(failure.hint).toMatch(/percent-encoded/i)
  })

  it('recognises a schema that was never applied, and does not say "try again"', () => {
    const failure = explainDatabaseError(
      drizzleWrapped(driverError('relation "verification_codes" does not exist', '42P01')),
    )
    expect(failure.kind).toBe('schema')
    expect(failure.infrastructure).toBe(true)
    expect(failure.hint).toMatch(/schema\.sql/)
  })

  it('recognises the pooler running out of connection slots', () => {
    const failure = explainDatabaseError(
      drizzleWrapped(driverError('sorry, too many clients already', '53300')),
    )
    expect(failure.kind).toBe('capacity')
  })

  it('recognises a refused TLS handshake', () => {
    const failure = explainDatabaseError(
      drizzleWrapped(driverError('self signed certificate in certificate chain', 'SELF_SIGNED_CERT_IN_CHAIN')),
    )
    expect(failure.kind).toBe('tls')
    expect(failure.hint).toMatch(/sslmode=require/)
  })

  /**
   * The important negative. A unique-constraint violation is a *query* result,
   * not an outage: reporting it as one would tell a user "try again later" when
   * the honest answer is "that username is taken", and would hide a real bug
   * behind an infrastructure excuse.
   */
  it('does not treat a rejected statement as an outage', () => {
    const err = drizzleWrapped(
      driverError('duplicate key value violates unique constraint "users_username_uq"', '23505'),
    )
    expect(explainDatabaseError(err).kind).toBe('query')
    expect(explainDatabaseError(err).infrastructure).toBe(false)
    // The gate the routes actually call, on the error itself.
    expect(isDatabaseUnavailable(err)).toBe(false)
  })

  it('does treat an unreachable host as an outage, through the same gate', () => {
    expect(
      isDatabaseUnavailable(drizzleWrapped(driverError('connect ETIMEDOUT', 'ETIMEDOUT'))),
    ).toBe(true)
  })

  it('reads a timeout with no code from its wording', () => {
    const failure = explainDatabaseError(new Error('the database did not answer within 2500ms'))
    expect(failure.kind).toBe('unreachable')
    expect(failure.infrastructure).toBe(true)
  })

  it('admits when it does not know, rather than guessing an outage', () => {
    const failure = explainDatabaseError(new Error('something entirely new'))
    expect(failure.kind).toBe('unknown')
    expect(failure.infrastructure).toBe(false)
    expect(failure.hint).toBeNull()
  })

  it('never throws, whatever it is handed', () => {
    for (const value of [null, undefined, 42, 'text', {}, [], new Error('')]) {
      expect(() => explainDatabaseError(value)).not.toThrow()
    }
  })
})

describe('explainDatabaseError — nothing secret leaves', () => {
  /** This text is returned over HTTP by /api/health, which is public. */
  it('removes a connection string that a driver put in its message', () => {
    const failure = explainDatabaseError(
      driverError(
        join_(
          'could not connect to postgres',
          'ql://lambda:hunter2@db.secret-project.supabase.co:5432/postgres',
        ),
        'ECONNREFUSED',
      ),
    )
    expect(failure.detail).not.toContain('hunter2')
    expect(failure.detail).not.toContain('secret-project')
  })

  it('removes a bare hostname, which identifies the database to a stranger', () => {
    const failure = explainDatabaseError(
      driverError('getaddrinfo ENOTFOUND db.secret-project.supabase.co', 'ENOTFOUND'),
    )
    expect(failure.detail).not.toContain('secret-project')
    expect(failure.detail).toContain('ENOTFOUND')
  })

  it('bounds the length so a driver cannot dump a novel into a response', () => {
    const failure = explainDatabaseError(new Error('x'.repeat(4000)))
    expect(failure.detail.length).toBeLessThanOrEqual(300)
  })
})

describe('describeDatabaseError — the operator log line', () => {
  it('carries the kind, the code and the fix in one line', () => {
    const line = describeDatabaseError(
      drizzleWrapped(driverError('getaddrinfo ENOTFOUND db.x.supabase.co', 'ENOTFOUND')),
    )
    expect(line).toContain('unreachable')
    expect(line).toContain('[ENOTFOUND]')
    expect(line).toMatch(/pooler/i)
  })
})
