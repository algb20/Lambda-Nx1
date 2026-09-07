import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'

/**
 * Erasure, against a real database.
 *
 * ## Why this one cannot be a unit test
 *
 * The defect it exists for was invisible to every unit test in this repository,
 * and would have stayed invisible: `repo.users.remove` issued one correct
 * `DELETE`, the schema's cascades were correctly declared, and the doc comment
 * above the function described the intended result accurately. Each layer was
 * right on its own. What was wrong was the *result*, and only Postgres knows
 * that — `on delete set null` clears `visitors.user_id` and leaves
 * `visitors.display_name` exactly where it was.
 *
 * Measured before the fix, on PostgreSQL 16, after deleting the account:
 *
 *     visitors.display_name     -> 'Erase Me'
 *     visitors.country_name     -> 'Saudi Arabia'
 *     verification_codes.email  -> 'erase@me.co'
 *
 * ## How to run it
 *
 *     TEST_DATABASE_URL=postgresql://…/lambda npx vitest run lib/db/erasure.integration
 *
 * Skipped without that variable rather than failed: a contributor with no
 * Postgres should get a green suite, and a suite that is red for everybody
 * stops being read. The variable is deliberately not `DATABASE_URL` — pointing
 * this at a real deployment would delete rows from it.
 */

const url = process.env.TEST_DATABASE_URL
const describeDb = url ? describe : describe.skip

describeDb('erasing an account leaves nothing that names the person', () => {
  const USER = '3f0b1c2d-4e5a-6b7c-8d9e-0a1b2c3d4e5f'
  const EMAIL = 'erasure-integration@example.test'
  let db: Awaited<ReturnType<typeof open>>

  async function open() {
    process.env.DATABASE_URL = url
    const { getDb } = await import('./client')
    return getDb()
  }

  beforeAll(async () => {
    db = await open()
    await cleanup()
    await db.execute(sql`
      INSERT INTO users (id, auth_provider, external_id, username, display_name, full_name)
      VALUES (${USER}::uuid, 'standalone', ${EMAIL}, 'erasure-int', 'Erase Me', 'Real Name')
    `)
    await db.execute(sql`
      INSERT INTO credentials (user_id, email, password_hash)
      VALUES (${USER}::uuid, ${EMAIL}, 'not-a-real-hash')
    `)
    await db.execute(sql`
      INSERT INTO visitors (id, subject_key, user_id, provider, display_name, country_code, country_name, region, visit_count)
      VALUES (gen_random_uuid(), ${'erasure-int-subject'}, ${USER}::uuid, 'standalone', 'Erase Me', 'SA', 'Saudi Arabia', 'Riyadh', 42)
    `)
    await db.execute(sql`
      INSERT INTO verification_codes (id, email, code_hash, purpose, expires_at)
      VALUES (gen_random_uuid(), ${EMAIL}, 'h', 'signup', now() + interval '1 hour')
    `)
    await db.execute(sql`
      INSERT INTO email_followers (id, email, locale, confirm_token_hash, unsubscribe_token_hash)
      VALUES (gen_random_uuid(), ${EMAIL}, 'ar', 'h1', 'h2')
    `)
  }, 30_000)

  async function cleanup() {
    await db.execute(sql`DELETE FROM visitors WHERE subject_key = ${'erasure-int-subject'}`)
    await db.execute(sql`DELETE FROM verification_codes WHERE email = ${EMAIL}`)
    await db.execute(sql`DELETE FROM email_followers WHERE email = ${EMAIL}`)
    await db.execute(sql`DELETE FROM users WHERE id = ${USER}::uuid`)
  }

  afterAll(async () => {
    await cleanup()
  }, 30_000)

  it('removes every trace of the person, in the tables the cascades never reached', async () => {
    const { repo } = await import('./index')
    const removed = await repo.users.remove(USER)
    expect(removed, 'the account was not found to delete').toBeTruthy()

    const surviving = (await db.execute(sql`
      SELECT 'visitors.display_name' AS field, display_name AS value FROM visitors WHERE display_name IS NOT NULL
      UNION ALL SELECT 'visitors.country_name', country_name FROM visitors WHERE country_name IS NOT NULL
      UNION ALL SELECT 'visitors.region', region FROM visitors WHERE region IS NOT NULL
      UNION ALL SELECT 'verification_codes.email', email FROM verification_codes WHERE email = ${EMAIL}
      UNION ALL SELECT 'email_followers.email', email FROM email_followers WHERE email = ${EMAIL}
      UNION ALL SELECT 'credentials.email', email FROM credentials WHERE email = ${EMAIL}
    `)) as unknown as Array<{ field: string; value: string }>

    expect(
      surviving,
      'these fields still identify somebody who asked to be erased',
    ).toEqual([])
  }, 30_000)

  /**
   * The other half, and the reason erasure anonymises the visitor row rather
   * than deleting it: the counters are a legitimate aggregate, and once nothing
   * in the row describes a person it is no longer personal data. Deleting it
   * would lose a real record to satisfy a rule that no longer applies to it.
   */
  it('keeps the anonymous counters it is entitled to keep', async () => {
    const rows = (await db.execute(sql`
      SELECT visit_count::int AS visits, user_id FROM visitors WHERE subject_key = ${'erasure-int-subject'}
    `)) as unknown as Array<{ visits: number; user_id: string | null }>
    expect(rows).toHaveLength(1)
    expect(rows[0].visits).toBe(42)
    expect(rows[0].user_id).toBeNull()
  }, 30_000)
})

/**
 * The catalogue questions from the audit, kept as assertions.
 *
 * Both were true of the live schema and neither was visible from any file: a
 * foreign key with no index is a decision Postgres makes for you, and the only
 * place it is recorded is `pg_index`.
 */
describeDb('the shape of the database itself', () => {
  let db: Awaited<ReturnType<typeof openDb>>
  async function openDb() {
    process.env.DATABASE_URL = url
    const { getDb } = await import('./client')
    return getDb()
  }
  beforeAll(async () => {
    db = await openDb()
  }, 30_000)

  it('has an index behind every single-column foreign key', async () => {
    const rows = (await db.execute(sql`
      SELECT c.conrelid::regclass::text || '.' || a.attname AS fk
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]
        )
      ORDER BY 1
    `)) as unknown as Array<{ fk: string }>
    expect(
      rows.map((r) => r.fk),
      'an unindexed foreign key makes every join and every cascade delete a sequential scan',
    ).toEqual([])
  }, 30_000)

  it('has row-level security on every table', async () => {
    const rows = (await db.execute(sql`
      SELECT c.relname AS table_name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
      ORDER BY 1
    `)) as unknown as Array<{ table_name: string }>
    expect(
      rows.map((r) => r.table_name),
      'a table without RLS is readable by anyone holding the public anon key',
    ).toEqual([])
  }, 30_000)

  /** No function can carry the owner's rights past the checks above. */
  it('defines no SECURITY DEFINER functions', async () => {
    const rows = (await db.execute(sql`
      SELECT p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
    `)) as unknown as Array<{ proname: string }>
    expect(rows.map((r) => r.proname)).toEqual([])
  }, 30_000)
})
