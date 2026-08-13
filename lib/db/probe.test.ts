import { describe, it, expect, afterEach } from 'vitest'
import { declaredTables, describeProbe, probeDatabase, scrubError, type DatabaseProbe } from './probe'

const base: DatabaseProbe = {
  reachable: true,
  latencyMs: 12,
  serverVersion: 'PostgreSQL 15.8',
  appliedMigrations: 14,
  expectedMigrations: 14,
  missingTables: [],
  error: null,
}

describe('declaredTables', () => {
  /**
   * Derived from the schema module, so a table added tomorrow is checked
   * tomorrow without anyone remembering to update a list.
   */
  it('finds the real schema tables', () => {
    const tables = declaredTables()
    expect(tables).toContain('users')
    expect(tables).toContain('posts')
    expect(tables).toContain('groups')
    expect(tables.length).toBeGreaterThan(10)
  })

  it('ignores non-table exports', () => {
    expect(declaredTables({ notATable: 42, alsoNot: () => {} })).toEqual([])
  })

  it('returns them sorted and unique, so the output is stable to compare', () => {
    const tables = declaredTables()
    expect([...tables].sort()).toEqual(tables)
    expect(new Set(tables).size).toBe(tables.length)
  })
})

describe('scrubError — this value is returned over HTTP', () => {
  it('removes a connection string', () => {
    const scrubbed = scrubError(
      'connect ECONNREFUSED for postgresql://admin:hunter2@db.example.com:5432/lambda',
    )
    expect(scrubbed).not.toContain('hunter2')
    expect(scrubbed).not.toContain('db.example.com')
    expect(scrubbed).toContain('[connection string]')
  })

  it('removes inline credentials that are not part of a postgres URL', () => {
    expect(scrubError('failed at //user:p4ss@host/db')).not.toContain('p4ss')
  })

  it('redacts anything password-shaped', () => {
    expect(scrubError('password authentication failed')).toContain('password[redacted]')
  })

  it('bounds the length, so a driver cannot dump a novel into the response', () => {
    expect(scrubError('x'.repeat(5000)).length).toBe(300)
  })
})

describe('describeProbe — the verdict a person reads', () => {
  it('calls a fully migrated, reachable database ok', () => {
    const { status, detail } = describeProbe(base)
    expect(status).toBe('ok')
    expect(detail).toContain('PostgreSQL 15.8')
  })

  it('calls an unreachable database off, and repeats its reason', () => {
    const { status, detail } = describeProbe({
      ...base,
      reachable: false,
      error: 'database did not answer within 5000ms',
    })
    expect(status).toBe('off')
    expect(detail).toContain('did not answer')
  })

  /**
   * The failure this exists to catch: the connection works, so every
   * configuration check passes, but the schema was never migrated and every
   * persistence-backed feature fails at runtime.
   */
  it('refuses to call a connected-but-unmigrated database ok', () => {
    const { status, detail } = describeProbe({
      ...base,
      missingTables: ['groups', 'group_members', 'posts'],
    })
    expect(status).toBe('degraded')
    expect(detail).toContain('3 table(s) are missing')
    expect(detail).toContain('groups')
  })

  it('flags a database running behind the migrations this build ships', () => {
    const { status, detail } = describeProbe({
      ...base,
      appliedMigrations: 11,
      expectedMigrations: 14,
    })
    expect(status).toBe('degraded')
    expect(detail).toContain('11/14')
  })

  it('does not complain when the applied count is simply unknown', () => {
    expect(describeProbe({ ...base, appliedMigrations: null }).status).toBe('ok')
  })
})

describe('probeDatabase', () => {
  const saved = process.env.DATABASE_URL
  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = saved
  })

  it('reports the missing variable rather than throwing', async () => {
    delete process.env.DATABASE_URL
    const probe = await probeDatabase(14)
    expect(probe.reachable).toBe(false)
    expect(probe.error).toContain('DATABASE_URL')
    expect(probe.expectedMigrations).toBe(14)
  })

  /**
   * A probe that throws cannot report on the thing it was built to report on,
   * so an unreachable host has to come back as a result, not an exception.
   */
  it('returns a result for an unreachable host instead of throwing', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@127.0.0.1:1/none'
    const probe = await probeDatabase(14, 1500)
    expect(probe.reachable).toBe(false)
    expect(probe.error).toBeTruthy()
    expect(probe.error).not.toContain('p@127.0.0.1')
  }, 10_000)
})
