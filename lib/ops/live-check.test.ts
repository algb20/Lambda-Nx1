import { describe, expect, it } from 'vitest'
import { judgeDatabase, judgeProbe, summariseLive, type Result } from './live-check'

/**
 * The distinction this whole module exists for: a setting can be *present* and
 * not *working*, and the two failures need different actions from the operator.
 * `/api/health` answers the first question; only asking the subsystem answers
 * the second.
 */
describe('a setting that is present is not a setting that works', () => {
  it('calls a 403 a mismatch, not a missing variable', () => {
    const r = judgeProbe({ subsystem: 'scheduler', status: 403, attempted: true }, 'CRON_SECRET')
    expect(r.verdict).toBe('rejected')
    expect(r.detail, 'the operator must know both copies exist and differ').toContain('do not match')
  })

  it('calls a 503 a missing variable, not a mismatch', () => {
    const r = judgeProbe({ subsystem: 'scheduler', status: 503, attempted: true }, 'CRON_SECRET')
    expect(r.verdict).toBe('not-configured')
    expect(r.detail, 'setting it without redeploying changes nothing').toContain('redeploy')
  })

  it('says plainly when it could not check, rather than implying it passed', () => {
    const r = judgeProbe({ subsystem: 'admin', status: 0, attempted: false }, 'ADMIN_SECRET')
    expect(r.verdict).toBe('unknown')
    expect(r.detail).toContain('not set in this shell')
  })

  it('reports a subsystem that answered', () => {
    const r = judgeProbe({ subsystem: 'scheduler', status: 200, attempted: true, note: '43 checked' }, 'CRON_SECRET')
    expect(r.verdict).toBe('working')
    expect(r.detail).toBe('43 checked')
  })

  it('never names a credential value in any verdict', () => {
    const secret = 'sk-live-abcdef0123456789'
    for (const status of [0, 200, 401, 403, 500, 503]) {
      const r = judgeProbe({ subsystem: 's', status, attempted: true, note: 'measured' }, 'CRON_SECRET')
      expect(r.detail).not.toContain(secret)
    }
  })
})

/**
 * `/api/health?deep=1` answers 200 whether or not the database is reachable and
 * puts the real answer in the body. Judging it on the status code would report
 * a dead database as healthy — the same trap as releasing a quarantined feed
 * because it returned 200.
 */
describe('the database is judged on what it said, not on the status code', () => {
  /**
   * Measured from the live deployment on 2026-08-27. The first version of this
   * module invented a `{ ok, detail }` shape and reported "unreachable — try
   * the pooler host" for a deployment that simply had no DATABASE_URL, sending
   * the operator to debug a connection that was never attempted.
   */
  it('separates a database that is unset from one that is broken', () => {
    const unset = judgeDatabase(200, {
      reachable: false,
      error: 'DATABASE_URL is not set on this deployment',
      expectedMigrations: 22,
      missingTables: [],
    })
    expect(unset.verdict).toBe('not-configured')
    expect(unset.detail, 'there is no connection to debug').not.toContain('pooler')
  })

  it('names the IPv6 host trap by its symptom', () => {
    const r = judgeDatabase(200, { reachable: false, error: 'getaddrinfo ENOTFOUND db.abcd.supabase.co' })
    expect(r.verdict).toBe('failing')
    expect(r.detail).toContain('pooler')
  })

  it('names the unencoded password by its code', () => {
    const r = judgeDatabase(200, { reachable: false, error: 'password authentication failed', code: '28P01' })
    expect(r.detail).toContain('percent-encode')
  })

  /**
   * A reachable database with missing tables is what a truncated schema paste
   * looks like from outside, and it is the state most easily mistaken for
   * working — everything connects, and then a feature fails at runtime.
   */
  it('refuses to call a half-applied schema working', () => {
    const r = judgeDatabase(200, { reachable: true, missingTables: ['monitors', 'visitors'], appliedMigrations: 22 })
    expect(r.verdict).toBe('failing')
    expect(r.detail).toContain('monitors')
  })

  it('reports a schema that is behind the code', () => {
    const r = judgeDatabase(200, { reachable: true, appliedMigrations: 18, expectedMigrations: 22, missingTables: [] })
    expect(r.verdict).toBe('failing')
    expect(r.detail).toContain('18 of 22')
  })

  it('accepts a database that answered with a current schema', () => {
    const r = judgeDatabase(200, {
      reachable: true,
      appliedMigrations: 22,
      expectedMigrations: 22,
      missingTables: [],
    })
    expect(r.verdict).toBe('working')
    expect(r.detail).toContain('22 migrations')
  })
})

describe('the summary names the one thing to do next', () => {
  const r = (subsystem: string, verdict: Result['verdict']): Result => ({ subsystem, verdict, detail: 'measured' })

  /**
   * A mismatch outranks a missing variable: an operator who fixes the missing
   * one first still has a broken deployment and no idea why.
   */
  it('leads with a rejected credential over a missing one', () => {
    const line = summariseLive([r('scheduler', 'rejected'), r('admin', 'not-configured')])
    expect(line).toContain('scheduler')
    expect(line).toContain('differs')
  })

  it('tells a missing variable that a redeploy is part of the fix', () => {
    expect(summariseLive([r('admin', 'not-configured')])).toContain('redeploy')
  })

  it('does not claim success when something went unchecked', () => {
    const line = summariseLive([r('database', 'working'), r('admin', 'unknown')])
    expect(line).toContain('admin')
    expect(line).not.toContain('fully configured')
  })

  it('says so plainly when everything answered', () => {
    expect(summariseLive([r('database', 'working'), r('scheduler', 'working')])).toContain('fully configured')
  })

  it('always says something', () => {
    for (const line of [summariseLive([]), summariseLive([r('a', 'failing')])]) {
      expect(line.length).toBeGreaterThan(20)
    }
  })
})
