import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCHEMA_SQL } from '@/db/schema-sql'
import {
  APPLY_TIMEOUT_MS,
  HEAL_RETRY_MS,
  autoSchemaEnabled,
  ensureSchema,
  resetSchemaHealing,
} from './apply-schema'

/**
 * The schema installer.
 *
 * ## What is asserted here, and what was verified against a real database
 *
 * The behaviour that matters — half-applied database in, complete database out
 * — cannot be proved without a Postgres, and this suite must run with none. So
 * it was proved separately, against a database rebuilt to the exact state the
 * live deployment was found in (20 tables, stopped at migration 0015):
 *
 *     BEFORE   missing: 4 of 24 — blobs, email_followers,
 *                                 source_health_daily, verification_codes
 *     APPLY#1  applied, 30 ms, created all four, 0 missing after
 *     APPLY#2  applied, 8 ms, created nothing — already complete
 *
 * What *is* asserted here is the set of properties that would make that result
 * unsafe if they ever stopped holding: that the SQL is a constant no caller can
 * influence, that it is guarded so a second run cannot fail, and that the
 * deadline stays under a serverless ceiling.
 */

const source = readFileSync(join(process.cwd(), 'lib/db/apply-schema.ts'), 'utf8')
const route = readFileSync(join(process.cwd(), 'app/api/admin/schema/route.ts'), 'utf8')

describe('nothing from a request can reach the database', () => {
  /**
   * The property that makes an "execute SQL" endpoint acceptable at all. The
   * moment any caller-supplied value is concatenated into that string, this
   * stops being a schema installer and becomes a remote SQL console.
   */
  it('executes only the compiled-in constant', () => {
    const call = /unsafe\(([^)]*)\)/.exec(source)
    expect(call, 'the driver call disappeared — re-check this file').not.toBeNull()
    expect(call![1].trim()).toBe('SCHEMA_SQL')
  })

  it('takes no input at all in the POST handler', () => {
    expect(route).not.toMatch(/request\.json\(\)/)
    expect(route).not.toMatch(/searchParams/)
  })

  it('is admin-gated on both methods', () => {
    const gates = route.match(/adminGate\(request\)/g) ?? []
    expect(gates.length).toBe(2)
  })
})

describe('the schema it applies is safe to apply twice', () => {
  const statements = SCHEMA_SQL.split('\n').filter((line) => /^\s*(CREATE|ALTER)\s/i.test(line))

  it('guards every CREATE TABLE', () => {
    const unguarded = statements.filter(
      (s) => /^\s*CREATE TABLE\s/i.test(s) && !/IF NOT EXISTS/i.test(s),
    )
    expect(unguarded, `unguarded: ${unguarded.join(' | ')}`).toHaveLength(0)
  })

  it('guards every CREATE INDEX', () => {
    const unguarded = statements.filter(
      (s) => /^\s*CREATE (UNIQUE )?INDEX\s/i.test(s) && !/IF NOT EXISTS/i.test(s),
    )
    expect(unguarded, `unguarded: ${unguarded.join(' | ')}`).toHaveLength(0)
  })

  /**
   * `CREATE TYPE` has no `IF NOT EXISTS` in Postgres, so it must be inside a
   * DO block that swallows duplicate_object. Without that, the very first
   * statement fails for anyone who has run this before — which is the single
   * most likely way it gets used.
   */
  it('wraps every CREATE TYPE in a guarded DO block', () => {
    const types = (SCHEMA_SQL.match(/CREATE TYPE/gi) ?? []).length
    const guards = (SCHEMA_SQL.match(/EXCEPTION WHEN duplicate_object OR duplicate_table/gi) ?? [])
      .length
    expect(types).toBeGreaterThan(0)
    expect(guards).toBeGreaterThanOrEqual(types)
  })

  it('covers every migration in the repository', () => {
    const files = readdirSync(join(process.cwd(), 'db/migrations')).filter((f) => f.endsWith('.sql'))
    for (const file of files) expect(SCHEMA_SQL).toContain(file)
  })

  /**
   * The four tables the live deployment was missing. Named explicitly because
   * a generator change that silently dropped the tail of the series would
   * otherwise reproduce the original incident exactly.
   */
  it.each(['blobs', 'email_followers', 'source_health_daily', 'verification_codes'])(
    'creates %s, which the live deployment was missing',
    (table) => {
      expect(SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`)
    },
  )
})

describe('it reports rather than throws', () => {
  it('never lets an error escape applySchema', () => {
    // Every path out of the function returns a result object. A diagnostic that
    // throws leaves the operator with less information than before they ran it.
    const body = /export async function applySchema[\s\S]*?\n}/.exec(source)?.[0] ?? ''
    expect(body).toContain('catch')
    expect(body).not.toMatch(/\bthrow\b/)
  })

  it('re-reads the tables after a failure, so a partial run is visible', () => {
    // The state that caused the incident: a run that died partway, with nothing
    // anywhere saying how far it got.
    const failure = /} catch \(err\) \{[\s\S]*?missingAfter[\s\S]*?\n  \}/.exec(source)
    expect(failure, 'the failure path no longer re-reads the catalogue').not.toBeNull()
  })

  it('keeps its deadline under a serverless function ceiling', () => {
    expect(APPLY_TIMEOUT_MS).toBeLessThan(60_000)
  })
})

describe('self-healing is safe to do unattended', () => {
  /**
   * The property the whole feature rests on. A deployment may create its own
   * tables without being asked *only* because the file it applies cannot
   * destroy anything — if a future migration ever introduced a destructive
   * statement, it would be auto-applied to a production database at 3am with
   * nobody watching. This test is what stops that reaching a database.
   *
   * `DROP NOT NULL` and `DROP DEFAULT` are permitted: they relax a constraint
   * and remove no data. Everything else in the DROP family is forbidden.
   */
  it('contains nothing that can drop a table, a column or an index', () => {
    const forbidden = SCHEMA_SQL.split('\n').filter((line) => {
      // Relaxing a constraint removes no data; everything else in the family does.
      if (/\bDROP\s+(NOT\s+NULL|DEFAULT)\b/i.test(line)) return false
      return /\bDROP\s+(TABLE|COLUMN|DATABASE|SCHEMA|INDEX|TYPE|CONSTRAINT)\b/i.test(line)
    })
    expect(forbidden, `destructive: ${forbidden.join(' | ')}`).toHaveLength(0)
  })

  it('deletes nothing', () => {
    expect(SCHEMA_SQL).not.toMatch(/\bTRUNCATE\b/i)
    expect(SCHEMA_SQL).not.toMatch(/\bDELETE\s+FROM\b/i)
  })

  /**
   * The migrations carry one data-modifying statement: a backfill that gives
   * pre-existing Pi accounts the handle Pi already knew them by. It is safe
   * because it writes **only where the column is NULL** — it cannot overwrite
   * a value somebody chose.
   *
   * Rather than banning the keyword, this asserts the property that makes it
   * safe, for every UPDATE in the file. A future migration that overwrote
   * existing rows unconditionally would be auto-applied to production by
   * `ensureSchema`, and this is the test that refuses to let that happen
   * without a human looking at it.
   */
  it('only ever writes rows into columns that are still empty', () => {
    const unguarded: string[] = []
    const pattern = /^UPDATE\s+"/gim
    let match: RegExpExecArray | null
    while ((match = pattern.exec(SCHEMA_SQL)) !== null) {
      const end = SCHEMA_SQL.indexOf(';', match.index)
      const statement = SCHEMA_SQL.slice(match.index, end === -1 ? undefined : end)
      if (!/WHERE[\s\S]*IS NULL/i.test(statement)) unguarded.push(statement.split('\n')[0])
    }
    expect(unguarded, `unguarded UPDATE: ${unguarded.join(' | ')}`).toHaveLength(0)
  })

  it('can be switched off for a shared database', () => {
    const env = (value?: string) => ({ ...(value ? { AUTO_SCHEMA: value } : {}) }) as NodeJS.ProcessEnv
    expect(autoSchemaEnabled(env('off'))).toBe(false)
    expect(autoSchemaEnabled(env('OFF'))).toBe(false)
    // On by default: a deployment that cannot create its own tables is not a
    // safer deployment, it is a broken one.
    expect(autoSchemaEnabled(env())).toBe(true)
  })

  it('does nothing at all without a database', async () => {
    const original = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    resetSchemaHealing()
    try {
      expect(await ensureSchema()).toBe(false)
    } finally {
      if (original !== undefined) process.env.DATABASE_URL = original
      resetSchemaHealing()
    }
  })

  it('is single-flight, so concurrent cold requests do not all apply at once', () => {
    const body = /export async function ensureSchema[\s\S]*?\n}/.exec(source)?.[0] ?? ''
    expect(body).toContain('if (!healing)')
    expect(body).toContain('if (healed) return true')
  })

  it('backs off after a failure rather than retrying every request', () => {
    expect(HEAL_RETRY_MS).toBeGreaterThanOrEqual(30_000)
  })
})

describe('the account gate brings the schema up', () => {
  const gate = readFileSync(join(process.cwd(), 'lib/auth/code-flow.ts'), 'utf8')

  it('brings the schema up once the database is known to answer', () => {
    expect(gate).toMatch(/database\.live && !\(await schemaReadyWithin\(/)
  })

  /**
   * This test used to assert `if (database.live) await ensureSchema()`, and
   * that literal `await` was the defect.
   *
   * Measured on the live deployment, 2026-08-27: the first registration hung
   * for over sixty seconds **and created the account anyway**, because applying
   * the schema is bounded at `APPLY_TIMEOUT_MS` — longer than a serverless
   * function lives. The function was killed after the row was written and
   * before the session cookie could be returned, so the account existed and its
   * owner did not know; their second attempt was told the username was taken.
   *
   * A source-shape assertion is only worth having if it pins the property that
   * matters. This one pinned the opposite.
   */
  it('does not make a visitor wait out a whole schema application', () => {
    expect(gate, 'the unbounded await is what wrote an account nobody received').not.toMatch(
      /await ensureSchema\(\)/,
    )
  })

  it('keeps the healing running after it stops waiting', () => {
    const helper = /export async function schemaReadyWithin[\s\S]*?\n}/.exec(gate)?.[0] ?? ''
    expect(helper, 'a budget that cancelled the heal would never create the tables').toContain(
      'Promise.race',
    )
    expect(helper, 'a rejected heal must be "not ready", never an exception').toContain('.catch(')
  })
})
