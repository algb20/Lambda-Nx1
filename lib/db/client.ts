/**
 * Internal database client. NOTHING in app/ or components/ imports this — access
 * goes through the repositories in lib/db (charter rule #4). Swapping the backing
 * store (Supabase → any Postgres) means changing DATABASE_URL only.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/db/schema'

export type Database = ReturnType<typeof drizzle<typeof schema>>

let cached: { client: postgres.Sql; db: Database } | null = null

export function getDb(): Database {
  if (cached) return cached.db
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Set it to a Postgres connection string (Supabase or any Postgres).',
    )
  }
  /**
   * Connection options chosen for the way this actually runs: many short-lived
   * serverless invocations against a pooled Postgres.
   *
   * - `prepare: false` — required by transaction-pooled connections (Supabase's
   *   pooler, PgBouncer): prepared statements do not survive a pooled session.
   * - `max` — each function instance opens its own pool, so the provider's
   *   connection limit is shared by every instance the platform decides to run.
   *   A small default keeps a traffic spike from exhausting it; overridable for
   *   long-running hosts where a larger pool is the right answer.
   * - `connect_timeout` — without it a host that does not answer (the single
   *   most common misconfiguration: Supabase's IPv6-only direct host, which no
   *   serverless platform can reach) hangs until the platform kills the
   *   function, and the visitor gets a timeout with no diagnosis anywhere. Ten
   *   seconds turns that into a real error with a code attached.
   * - `idle_timeout` — return connections to the pooler rather than holding a
   *   slot open for an instance that has already gone cold.
   */
  const poolMax = Number(process.env.DATABASE_POOL_MAX)
  const client = postgres(url, {
    prepare: false,
    max: Number.isFinite(poolMax) && poolMax > 0 ? Math.min(poolMax, 20) : 3,
    connect_timeout: 10,
    idle_timeout: 20,
    onnotice: reportNotice,
  })
  const db = drizzle(client, { schema })
  cached = { client, db }
  return db
}

/**
 * Postgres codes meaning "that already existed, so I skipped it".
 *
 * The schema is deliberately idempotent, so applying it to a database that is
 * already complete raises one of these for nearly every statement — around
 * sixty notices for a single run. The driver prints each as a multi-line object
 * by default, which buries anything real in the function log and, on a metered
 * host, is charged for.
 */
const ROUTINE_NOTICES = new Set(['42P07', '42701', '42710', '42P06', '42723'])

/**
 * Notices, filtered rather than silenced.
 *
 * Turning them off entirely would be the easy fix and the wrong one: a notice
 * is how Postgres reports a truncated identifier or a cast it chose for you,
 * and those are worth seeing. Only the "already exists, skipping" family — the
 * expected consequence of an idempotent schema — is dropped, and what survives
 * is printed as one line instead of a paragraph.
 */
function reportNotice(notice: { code?: string; message?: string }): void {
  if (notice.code && ROUTINE_NOTICES.has(notice.code)) return
  console.warn(`[db] ${notice.code ?? 'notice'}: ${notice.message ?? ''}`)
}

/**
 * The raw driver handle, for the one job Drizzle cannot do.
 *
 * Applying the schema means sending a file of DDL — `CREATE TYPE`, `DO $$…$$`,
 * `ALTER TYPE … ADD VALUE` — as *one* request. Drizzle's `execute` sends a
 * single parameterised statement over the extended protocol, which rejects
 * multi-statement input by design. The simple protocol accepts it, and the
 * driver is the only thing that speaks it.
 *
 * **This is internal to `lib/db` and must stay that way** (charter rule #4): no
 * route, component or engine module may import it, or the storage backend stops
 * being swappable. `lib/db/apply-schema` is its only caller.
 */
export function getSqlClient(): postgres.Sql {
  getDb()
  return cached!.client
}

/** Whether a database connection is configured (used to degrade gracefully in dev). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
