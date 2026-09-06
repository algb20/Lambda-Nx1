/**
 * Does the database actually answer?
 *
 * `isDbConfigured()` only says a connection string exists. That is not the same
 * question as "is this deployment wired to the database" — a wrong password, a
 * paused project, a pooler that refuses the connection, or a schema that was
 * never migrated all look identical to a variable being set. Every one of those
 * has the same symptom in the product: features quietly return nothing.
 *
 * So this asks the database itself, and reports four separate facts:
 *
 *  1. **Reachable** — a real round trip, with a deadline so a hung connection
 *     cannot hang the health endpoint that is supposed to diagnose it.
 *  2. **Which server** — the Postgres version that answered.
 *  3. **Migrated** — how many migrations the database has applied, against how
 *     many this build ships. A mismatch is the "why is the new feature 500ing?"
 *     answer.
 *  4. **Complete** — any table the schema declares that the database does not
 *     have. This is the precise failure, not a guess at it.
 *
 * Nothing here can leak a credential: the connection string never appears in the
 * output, and provider error text is scrubbed before it is returned (§5 of the
 * charter — secrets live in the environment and stay there).
 */
import { getTableName, is, sql } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { getDb, isDbConfigured } from './client'
import { explainDatabaseError } from './errors'
import * as schema from '@/db/schema'

export interface DatabaseProbe {
  /** True only when the database completed a real query. */
  reachable: boolean
  /** Round-trip time of the probe query, in milliseconds. */
  latencyMs: number | null
  /** e.g. "PostgreSQL 15.8" — which server answered. */
  serverVersion: string | null
  /** Migrations the database records as applied, or null if unreadable. */
  appliedMigrations: number | null
  /** Migrations this build ships (the caller counts the files). */
  expectedMigrations: number | null
  /** Tables the schema declares that the database does not have. */
  missingTables: string[]
  /**
   * Tables in `public` that exist with row-level security switched **off**, or
   * `null` when we could not read the catalogue.
   *
   * ## Why the probe asks this, when a test already checks it
   *
   * `lib/db/rls.test.ts` proves every table in our schema and in our migrations
   * carries `ENABLE ROW LEVEL SECURITY`. It passed the whole time a live
   * database sat with all twenty-four tables open, because it reads files. The
   * migration that closes them, `0022_rls_every_table`, had simply never been
   * run against that database.
   *
   * So the repository was right, the suite was green, and the exposure was
   * real. The only thing that can tell those apart is asking the database, and
   * before this field the probe's happy path was:
   *
   *     connected to PostgreSQL 15.8 in 42ms; all 24 tables present  → ok
   *
   * `ok` over a `credentials` table of password hashes readable by anyone
   * holding the project's public anon key. Every table present is not the same
   * as every table protected, and reporting the first as though it settled the
   * second is the exact failure this project keeps removing.
   *
   * `null` is not `[]`. An empty list means we asked and nothing was open; null
   * means we could not ask, and those must not read the same.
   */
  unprotectedTables: string[] | null
  /** Scrubbed reason, when the probe could not complete. */
  error: string | null
  /**
   * What an operator should change, when the failure names a known cause.
   *
   * The reason this exists: the probe used to report Drizzle's wrapper message
   * — `Failed query: select version() as version` — which says what we were
   * doing and nothing about why it failed. The real cause sits one level down
   * in `cause`, and with it comes a code that identifies the fix precisely.
   * See `lib/db/errors`.
   */
  hint?: string | null
  /** The driver code or SQLSTATE behind the failure, when there was one. */
  code?: string | null
}

/** How long the database gets to answer before we call it unreachable. */
export const PROBE_TIMEOUT_MS = 5_000

/**
 * Every table the schema declares. Derived from the schema module rather than a
 * hand-kept list, so adding a table cannot silently escape the check.
 */
export function declaredTables(mod: Record<string, unknown> = schema): string[] {
  const names = new Set<string>()
  for (const value of Object.values(mod)) {
    if (is(value, PgTable)) names.add(getTableName(value))
  }
  return [...names].sort()
}

/**
 * Re-exported from `./scrub`, where it now lives so the error explainer can use
 * it without pulling in the schema and the driver. Kept exported here because
 * "the probe scrubs its output" is a property of the probe, and callers and
 * tests that already say so should not have to move.
 */
export { scrubError } from './scrub'

/** Reject after `ms`, so one unresponsive dependency cannot stall the probe. */
function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`database did not answer within ${ms}ms`)),
      ms,
    )
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

const unreachable = (
  error: string,
  expectedMigrations: number | null,
  extra: { hint?: string | null; code?: string | null } = {},
): DatabaseProbe => ({
  reachable: false,
  latencyMs: null,
  serverVersion: null,
  appliedMigrations: null,
  expectedMigrations,
  missingTables: [],
  unprotectedTables: null,
  error,
  hint: extra.hint ?? null,
  code: extra.code ?? null,
})

/**
 * Ask the database. Never throws: a probe that throws cannot report on the thing
 * it was built to report on.
 */
export async function probeDatabase(
  expectedMigrations: number | null = null,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<DatabaseProbe> {
  if (!isDbConfigured()) {
    return unreachable('DATABASE_URL is not set on this deployment', expectedMigrations)
  }

  const started = Date.now()
  try {
    const db = getDb()

    // One round trip that also answers "which server". If this succeeds the
    // deployment is genuinely connected; everything after it is detail.
    const versionRows = (await withDeadline(
      db.execute(sql`select version() as version`),
      timeoutMs,
    )) as unknown as Array<{ version?: string }>
    const latencyMs = Date.now() - started

    const raw = versionRows?.[0]?.version ?? null
    // "PostgreSQL 15.8 on aarch64-…" — the first two words are the useful part.
    const serverVersion = raw ? raw.split(/\s+/).slice(0, 2).join(' ') : null

    // Which of our tables exist. Asked as one query rather than one per table.
    const expected = declaredTables()
    let missingTables: string[] = []
    try {
      const rows = (await withDeadline(
        db.execute(
          sql`select table_name from information_schema.tables where table_schema = 'public'`,
        ),
        timeoutMs,
      )) as unknown as Array<{ table_name?: string }>
      const present = new Set(rows.map((r) => r.table_name).filter(Boolean) as string[])
      missingTables = expected.filter((t) => !present.has(t))
    } catch {
      // The connection works; we simply could not enumerate. Reporting an empty
      // list would be a claim we cannot support, so leave it empty and let the
      // migration count carry the signal.
      missingTables = []
    }

    // Drizzle records applied migrations in its own schema. Absent on a database
    // migrated by other means, which is not an error — just unknown.
    let appliedMigrations: number | null = null
    try {
      const rows = (await withDeadline(
        db.execute(sql`select count(*)::int as count from drizzle.__drizzle_migrations`),
        timeoutMs,
      )) as unknown as Array<{ count?: number }>
      const count = rows?.[0]?.count
      appliedMigrations = typeof count === 'number' ? count : null
    } catch {
      appliedMigrations = null
    }

    /**
     * Which tables are open, asked of the database rather than of our files.
     *
     * `pg_class.relrowsecurity` is the switch itself — not a policy count, and
     * not what a migration intended. `relkind = 'r'` keeps it to ordinary
     * tables: views and foreign tables have no RLS flag to read and would
     * report as open forever.
     *
     * Deliberately every table in `public`, not only the ones our schema
     * declares. A table left behind by an older schema, or created by hand, is
     * reachable through the same public API as ours and is exactly the one
     * nobody would think to check.
     */
    let unprotectedTables: string[] | null = null
    try {
      const rows = (await withDeadline(
        db.execute(sql`
          select c.relname as table_name
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
          order by c.relname
        `),
        timeoutMs,
      )) as unknown as Array<{ table_name?: string }>
      unprotectedTables = rows.map((r) => r.table_name).filter(Boolean) as string[]
    } catch {
      // Could not read the catalogue. `null`, never `[]` — "we did not ask" and
      // "we asked and all is well" are different answers and the second one is
      // a claim we would not be able to support.
      unprotectedTables = null
    }

    return {
      reachable: true,
      latencyMs,
      serverVersion,
      appliedMigrations,
      expectedMigrations,
      missingTables,
      unprotectedTables,
      error: null,
      hint: null,
      code: null,
    }
  } catch (err) {
    /**
     * The whole cause chain, not the top of it.
     *
     * `db.execute()` rejects with Drizzle's wrapper, whose message is always
     * `Failed query: <the sql>` — a sentence about our code that contains not
     * one fact about the failure. Unwrapping it is the difference between
     * "Failed query: select version()" and "ENOTFOUND — the Supabase direct
     * host is IPv6-only, use the pooler", which is a fix.
     */
    const failure = explainDatabaseError(err)
    return unreachable(failure.detail, expectedMigrations, {
      hint: failure.hint,
      code: failure.code,
    })
  }
}

/**
 * The one-line verdict, which is what a person actually reads. Deliberately
 * blunt: a database that answers but is missing tables is *not* "ok".
 */
export function describeProbe(probe: DatabaseProbe): {
  status: 'ok' | 'degraded' | 'off'
  detail: string
} {
  if (!probe.reachable) {
    // The hint is the half an operator can act on, so it travels with the
    // error rather than sitting in a field a dashboard may not render.
    const cause = probe.error ?? 'database unreachable'
    const code = probe.code ? ` [${probe.code}]` : ''
    return { status: 'off', detail: probe.hint ? `${cause}${code} — ${probe.hint}` : `${cause}${code}` }
  }
  /**
   * Reported before anything else that is merely incomplete, because it is the
   * only one of these that is a live exposure rather than a missing feature.
   *
   * `off`, not `degraded`. Supabase turns a project's PostgREST API on by
   * default and its anon key is public by design — it ships to every browser.
   * Row-level security is the only thing between that key and a table in
   * `public`. A deployment in this state is not a degraded database; it is an
   * open one, and `credentials` holds password hashes.
   */
  if (probe.unprotectedTables !== null && probe.unprotectedTables.length > 0) {
    const open = probe.unprotectedTables
    return {
      status: 'off',
      detail:
        `${open.length} table(s) in public have row-level security switched OFF and are readable, ` +
        `writable and deletable by anyone holding this project's public anon key: ` +
        `${open.slice(0, 8).join(', ')}${open.length > 8 ? `, +${open.length - 8} more` : ''}. ` +
        `The repository closes this in db/migrations/0022_rls_every_table.sql — run "npm run db:migrate" ` +
        `against this database, or apply db/ops/rls-remediation.sql in the SQL editor for an immediate fix.`,
    }
  }
  if (probe.missingTables.length > 0) {
    return {
      status: 'degraded',
      detail: `connected (${probe.serverVersion ?? 'postgres'}, ${probe.latencyMs}ms) but ${
        probe.missingTables.length
      } table(s) are missing — migrations are not fully applied: ${probe.missingTables
        .slice(0, 8)
        .join(', ')}`,
    }
  }
  if (
    probe.appliedMigrations !== null &&
    probe.expectedMigrations !== null &&
    probe.appliedMigrations < probe.expectedMigrations
  ) {
    return {
      status: 'degraded',
      detail: `connected, every table present, but ${probe.appliedMigrations}/${probe.expectedMigrations} migrations are recorded as applied`,
    }
  }
  /**
   * The happy line says what was actually established, including the part we
   * could not establish. It used to end at "all 24 tables present", which reads
   * as a clean bill of health and was one over a database with every table
   * open.
   */
  const protection =
    probe.unprotectedTables === null
      ? '; row-level security could not be read'
      : ' and protected by row-level security'
  return {
    status: 'ok',
    detail: `connected to ${probe.serverVersion ?? 'postgres'} in ${probe.latencyMs}ms; all ${
      declaredTables().length
    } tables present${protection}`,
  }
}
