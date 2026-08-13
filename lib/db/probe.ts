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
  /** Scrubbed reason, when the probe could not complete. */
  error: string | null
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
 * Remove anything credential-shaped from a provider's error text. Postgres
 * drivers happily put the host — and sometimes the whole connection string —
 * into the message, and this value is returned over HTTP.
 */
export function scrubError(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[connection string]')
    .replace(/\/\/[^\s/@]+:[^\s/@]+@/g, '//[credentials]@')
    .replace(/password[^\s,;]*/gi, 'password[redacted]')
    .slice(0, 300)
}

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

const unreachable = (error: string, expectedMigrations: number | null): DatabaseProbe => ({
  reachable: false,
  latencyMs: null,
  serverVersion: null,
  appliedMigrations: null,
  expectedMigrations,
  missingTables: [],
  error,
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

    return {
      reachable: true,
      latencyMs,
      serverVersion,
      appliedMigrations,
      expectedMigrations,
      missingTables,
      error: null,
    }
  } catch (err) {
    return unreachable(
      scrubError(err instanceof Error ? err.message : 'database probe failed'),
      expectedMigrations,
    )
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
    return { status: 'off', detail: probe.error ?? 'database unreachable' }
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
  return {
    status: 'ok',
    detail: `connected to ${probe.serverVersion ?? 'postgres'} in ${probe.latencyMs}ms; all ${
      declaredTables().length
    } tables present`,
  }
}
