import { describe, it, expect, afterEach } from 'vitest'
import { declaredTables, describeProbe, probeDatabase, scrubError, type DatabaseProbe } from './probe'

const base: DatabaseProbe = {
  reachable: true,
  latencyMs: 12,
  serverVersion: 'PostgreSQL 15.8',
  appliedMigrations: 14,
  expectedMigrations: 14,
  missingTables: [],
  unprotectedTables: [],
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

/**
 * The incident this was written after.
 *
 * Supabase reported `rls_disabled_in_public` on the live project. The
 * repository was not at fault: every table carries `ENABLE ROW LEVEL SECURITY`
 * in both the schema and the migrations, and `lib/db/rls.test.ts` proves it.
 * That test passed the entire time the live database sat with all twenty-four
 * tables open, because it reads files — and `0022_rls_every_table` had never
 * been run against that database.
 *
 * So the suite was green, the code was right, and `credentials` — password
 * hashes — was readable by anyone holding the project's public anon key. The
 * probe's verdict over exactly that database was:
 *
 *     connected to PostgreSQL 15.8 in 42ms; all 24 tables present → ok
 *
 * Every table present is not every table protected. These tests hold the two
 * apart.
 */
describe('an open table is not a healthy database', () => {
  it('refuses to call a reachable database ok while a table is open', () => {
    const { status } = describeProbe({ ...base, unprotectedTables: ['credentials'] })
    expect(status, 'RLS off on any table is an exposure, not a degradation').toBe('off')
  })

  it('names the open tables and what an anon key can do to them', () => {
    const { detail } = describeProbe({
      ...base,
      unprotectedTables: ['credentials', 'users', 'verification_codes'],
    })
    expect(detail).toContain('credentials')
    expect(detail).toContain('anon key')
    expect(detail).toMatch(/readable, writable and deletable/)
  })

  it('points at both the permanent fix and the immediate one', () => {
    const { detail } = describeProbe({ ...base, unprotectedTables: ['users'] })
    expect(detail).toContain('0022_rls_every_table')
    expect(detail).toContain('db/ops/rls-remediation.sql')
  })

  /** A long list must not become a wall of text; the count carries it. */
  it('truncates a long list and says how many more', () => {
    const many = Array.from({ length: 24 }, (_, i) => `t${i}`)
    const { detail } = describeProbe({ ...base, unprotectedTables: many })
    expect(detail).toContain('24 table(s)')
    expect(detail).toContain('+16 more')
  })

  /**
   * The exposure outranks the incomplete migration. Both may be true — an
   * unmigrated database is often how the tables came to be open — but only one
   * of them is live right now.
   */
  it('reports the exposure before missing tables or migration drift', () => {
    const { status, detail } = describeProbe({
      ...base,
      missingTables: ['posts'],
      appliedMigrations: 11,
      unprotectedTables: ['credentials'],
    })
    expect(status).toBe('off')
    expect(detail).toContain('credentials')
  })

  /**
   * `null` is "we could not ask", and it must not be dressed as "we asked and
   * all is well" — the distinction this whole session has been about.
   */
  it('says so when it could not read the catalogue, instead of implying safety', () => {
    const { status, detail } = describeProbe({ ...base, unprotectedTables: null })
    expect(status).toBe('ok')
    expect(detail).toContain('could not be read')
    expect(detail).not.toContain('protected by row-level security')
  })

  it('states the protection positively when it did ask and found none open', () => {
    const { detail } = describeProbe({ ...base, unprotectedTables: [] })
    expect(detail).toContain('protected by row-level security')
  })
})
