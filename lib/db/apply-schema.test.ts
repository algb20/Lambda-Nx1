import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCHEMA_SQL } from '@/db/schema-sql'
import { APPLY_TIMEOUT_MS } from './apply-schema'

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
