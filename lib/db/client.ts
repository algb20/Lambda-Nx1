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
  })
  const db = drizzle(client, { schema })
  cached = { client, db }
  return db
}

/** Whether a database connection is configured (used to degrade gracefully in dev). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
