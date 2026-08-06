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
  // `prepare: false` keeps us compatible with transaction-pooled connections (e.g. Supabase pooler).
  const client = postgres(url, { prepare: false })
  const db = drizzle(client, { schema })
  cached = { client, db }
  return db
}

/** Whether a database connection is configured (used to degrade gracefully in dev). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
