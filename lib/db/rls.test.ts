import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const schema = readFileSync(join(process.cwd(), 'db/schema.sql'), 'utf8')

const tablesIn = (sql: string) => new Set([...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"?([a-z_]+)"?/g)].map((m) => m[1]))
const rlsIn = (sql: string) =>
  new Set([...sql.matchAll(/ALTER TABLE "?([a-z_]+)"? ENABLE ROW LEVEL SECURITY/g)].map((m) => m[1]))

/**
 * Every table denies everyone the application is not.
 *
 * ## What this was written after
 *
 * Five tables carried row-level security — the five added once the practice
 * began — and the nineteen older ones did not. No policy existed anywhere in
 * the project, which was correct; the absence of *RLS itself* was not.
 *
 * On Supabase that gap is not theoretical. A project's PostgREST API is on by
 * default and its anon key is public by design — it ships to every browser and
 * is meant to. Row-level security is the only thing between that key and a
 * table in `public`. Left open were `credentials` (password hashes),
 * `verification_codes` (live sign-up and reset codes), `users` and
 * `email_followers` (personal data the charter's §3 minimisation rule exists to
 * protect), and every investigation, scan and piece of evidence the product had
 * ever stored.
 *
 * Enabling it costs the application nothing: it reaches Postgres through
 * `postgres-js` with `DATABASE_URL`, a direct connection as the owner, which
 * bypasses RLS by definition.
 *
 * The point of this test is that the gap reopened the moment somebody added a
 * table and forgot — which is exactly how it opened. A rule nobody can forget
 * is a rule in the suite.
 */
describe('row-level security covers every table', () => {
  it('leaves no table in the schema without it', () => {
    const missing = [...tablesIn(schema)].filter((t) => !rlsIn(schema).has(t)).sort()
    expect(
      missing,
      'a table without RLS is readable by anyone holding the public anon key',
    ).toEqual([])
  })

  /**
   * The migrations are what an existing deployment runs; the schema file is
   * what a fresh one applies. A table protected in one and not the other means
   * the two databases differ in exactly the way nobody would think to check.
   */
  it('protects the same tables through the migrations as through the schema', () => {
    const dir = join(process.cwd(), 'db/migrations')
    const migrations = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n')
    const missing = [...tablesIn(migrations)].filter((t) => !rlsIn(migrations).has(t)).sort()
    expect(missing, 'a migrated database would be left open where a fresh one is not').toEqual([])
  })

  /**
   * Deliberately none. A policy grants access, and the correct grant is none:
   * nothing outside the app's own connection should read these at all. A policy
   * appearing without this test being updated would mean somebody opened a door
   * without saying so.
   */
  it('grants nothing to anyone, on purpose', () => {
    expect(schema).not.toMatch(/CREATE POLICY/i)
  })

  /** Applying the schema twice must stay safe — it is applied on first use. */
  it('is idempotent, like the rest of the schema file', () => {
    const enables = [...schema.matchAll(/ALTER TABLE "?([a-z_]+)"? ENABLE ROW LEVEL SECURITY/g)]
    expect(enables.length).toBeGreaterThan(20)
    // ENABLE on an already-enabled table is a no-op in Postgres, so no guard is
    // needed — but a DROP or a DISABLE here would break that property loudly.
    expect(schema).not.toMatch(/DISABLE ROW LEVEL SECURITY/i)
  })
})

/**
 * A migration file that the migration runner will never run.
 *
 * `drizzle-kit migrate` does not read the directory. It reads
 * `db/migrations/meta/_journal.json` and applies the files that journal names,
 * in the order it names them. A `.sql` file with no entry is invisible to it:
 * it sits in the repository, passes review, is quoted in a commit message, and
 * is never executed against any database.
 *
 * Three were in that state when this test was written — `0021_email_followers`,
 * `0022_rls_every_table` and `0023_fk_indexes`. The second is the one that
 * closes row-level security on every table, so the fix for a live security
 * alert had been committed in a form the tooling could not apply, and
 * `rls.test.ts` above passed the whole time because it reads the file. The
 * third was added by this session, repeating the mistake it was about to find.
 *
 * This is the cheapest possible check and it closes the whole class.
 */
describe('every migration is reachable by the migration runner', () => {
  const journalTags = (): string[] => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), 'db/migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string; idx: number; when: number }> }
    return journal.entries.map((e) => e.tag)
  }

  const sqlFiles = (): string[] =>
    readdirSync(join(process.cwd(), 'db/migrations'))
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.replace(/\.sql$/, ''))
      .sort()

  it('names every .sql file in the journal', () => {
    const tags = new Set(journalTags())
    const unreachable = sqlFiles().filter((f) => !tags.has(f))
    expect(
      unreachable,
      'these migrations exist as files and would never be applied: drizzle-kit reads the journal, not the directory',
    ).toEqual([])
  })

  it('names no migration the journal has lost', () => {
    const files = new Set(sqlFiles())
    const orphans = journalTags().filter((t) => !files.has(t))
    expect(orphans, 'the journal points at a migration that is not in the repository').toEqual([])
  })

  /** Order is what the runner applies; a repeated or out-of-sequence index reorders history. */
  it('indexes the journal in a strict, gapless sequence', () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), 'db/migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ idx: number; when: number; tag: string }> }
    const idxs = journal.entries.map((e) => e.idx)
    expect(idxs).toEqual(idxs.map((_, i) => i))
  })

  it('orders the journal by time, so a replay matches the history it records', () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), 'db/migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ when: number }> }
    for (let i = 1; i < journal.entries.length; i += 1) {
      expect(journal.entries[i].when).toBeGreaterThan(journal.entries[i - 1].when)
    }
  })
})
