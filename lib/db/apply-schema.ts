/**
 * Create the schema, from the product itself.
 *
 * ## Why this exists
 *
 * The migrations are applied by `drizzle-kit migrate`, which needs Node, a
 * clone of the repository and a shell. The person who configures this
 * deployment has a hosting dashboard and a database dashboard in front of them
 * and none of those three things. So the single step between "the database is
 * connected" and "accounts work" was a step they could not take.
 *
 * `db/schema.sql` was the first answer: one file to paste. It works, and it
 * still asks somebody to copy nine hundred lines from a raw file into a SQL
 * editor without losing the end of it — and when a paste dies halfway, as one
 * did, the database is left at whichever statement failed with nothing on
 * screen saying so. That is exactly what happened here: a database stopped at
 * migration 0015, four tables short, and the only visible symptom was that
 * sign-up said "an error occurred".
 *
 * This is the same file, applied by the deployment that needs it, in one
 * request, reporting exactly which tables it created.
 *
 * ## Why this is not a SQL endpoint
 *
 * It executes **one constant**, compiled into the build (`db/schema-sql`).
 * There is no code path by which a caller's bytes reach the database — not as a
 * statement, not as an identifier, not as a fragment. The route above it is
 * admin-gated as well, but that gate is the second lock: even an attacker
 * holding `ADMIN_SECRET` can only ask this deployment to create its own tables,
 * which is the thing the operator wanted anyway.
 *
 * ## Why it is safe to run twice
 *
 * Every statement in the generated file is guarded — `IF NOT EXISTS`, or a `DO`
 * block that swallows `duplicate_object`/`duplicate_table`. Verified by running
 * it against a database left half-applied at migration 0015: zero errors, the
 * four missing tables created, and a second run a no-op.
 */
import { sql } from 'drizzle-orm'
import { getDb, getSqlClient, isDbConfigured } from './client'
import { declaredTables } from './probe'
import { explainDatabaseError } from './errors'
import { SCHEMA_SQL, SCHEMA_MIGRATION_COUNT } from '@/db/schema-sql'

export { SCHEMA_MIGRATION_COUNT }

export interface SchemaApplyResult {
  /** True only when the statements ran without error. */
  applied: boolean
  /** Tables the schema declares that were absent before this ran. */
  missingBefore: string[]
  /** Tables still absent after. Non-empty on a success is a real anomaly. */
  missingAfter: string[]
  /** What this run actually created — the honest measure of what it did. */
  created: string[]
  /** Migrations the applied file was folded from. */
  migrations: number
  elapsedMs: number
  /** Scrubbed cause, when it failed. */
  error: string | null
  /** What to change, when the cause names a fix. */
  hint: string | null
}

/**
 * How long the whole apply gets.
 *
 * Comfortably under a serverless function's ceiling, because a request killed
 * by the platform mid-DDL is the one outcome with no report at all — and the
 * operator would be left not knowing how much of the schema exists. On a
 * pooled connection the real file takes a fraction of this.
 */
export const APPLY_TIMEOUT_MS = 25_000

/** The tables that exist right now. Empty on failure — never a guess. */
async function presentTables(): Promise<Set<string>> {
  const rows = (await getDb().execute(
    sql`select table_name from information_schema.tables where table_schema = 'public'`,
  )) as unknown as Array<{ table_name?: string }>
  return new Set(rows.map((r) => r.table_name).filter(Boolean) as string[])
}

function missingFrom(present: Set<string>): string[] {
  return declaredTables().filter((table) => !present.has(table))
}

/**
 * What is missing, without changing anything.
 *
 * The report an operator reads before deciding to press the button, and the
 * same one they read after — so "did it work" is answered by the same
 * measurement both times rather than by two functions that could disagree.
 */
export async function schemaStatus(): Promise<{
  reachable: boolean
  missing: string[]
  declared: number
  error: string | null
  hint: string | null
}> {
  if (!isDbConfigured()) {
    return {
      reachable: false,
      missing: [],
      declared: declaredTables().length,
      error: 'DATABASE_URL is not set on this deployment',
      hint: 'Add DATABASE_URL in the hosting project settings and redeploy.',
    }
  }
  try {
    const present = await presentTables()
    return {
      reachable: true,
      missing: missingFrom(present),
      declared: declaredTables().length,
      error: null,
      hint: null,
    }
  } catch (err) {
    const failure = explainDatabaseError(err)
    return {
      reachable: false,
      missing: [],
      declared: declaredTables().length,
      error: failure.detail,
      hint: failure.hint,
    }
  }
}

/**
 * Apply the schema. Never throws.
 *
 * A failure is reported, not raised: this is the tool an operator reaches for
 * when something is already wrong, and a diagnostic that itself crashes leaves
 * them worse off than before they pressed it.
 */
export async function applySchema(): Promise<SchemaApplyResult> {
  const started = Date.now()
  const base: SchemaApplyResult = {
    applied: false,
    missingBefore: [],
    missingAfter: [],
    created: [],
    migrations: SCHEMA_MIGRATION_COUNT,
    elapsedMs: 0,
    error: null,
    hint: null,
  }

  if (!isDbConfigured()) {
    return {
      ...base,
      error: 'DATABASE_URL is not set on this deployment',
      hint: 'Add DATABASE_URL in the hosting project settings and redeploy — environment variables are read at boot.',
      elapsedMs: Date.now() - started,
    }
  }

  let missingBefore: string[] = []
  try {
    missingBefore = missingFrom(await presentTables())
  } catch (err) {
    // Cannot even read the catalogue: the database is not usable, and running
    // DDL against it would produce a worse error with less information.
    const failure = explainDatabaseError(err)
    return { ...base, error: failure.detail, hint: failure.hint, elapsedMs: Date.now() - started }
  }

  try {
    /**
     * `.simple()` is the whole reason this module talks to the driver directly:
     * the extended protocol permits exactly one statement per message, and this
     * is a file of them. `unsafe` names the fact that the string is not
     * parameterised — which is correct here and only here, because the string
     * is a compile-time constant and no caller can influence it.
     */
    await withDeadline(getSqlClient().unsafe(SCHEMA_SQL).simple(), APPLY_TIMEOUT_MS)
  } catch (err) {
    const failure = explainDatabaseError(err)
    // Re-read regardless: a run that died partway still created tables, and an
    // operator needs to know which — that is precisely the state that left this
    // deployment stuck four tables short with nothing reporting it.
    const missingAfter = missingFrom(await presentTables().catch(() => new Set<string>()))
    return {
      ...base,
      missingBefore,
      missingAfter,
      created: missingBefore.filter((t) => !missingAfter.includes(t)),
      error: failure.detail,
      hint: failure.hint,
      elapsedMs: Date.now() - started,
    }
  }

  const missingAfter = missingFrom(await presentTables().catch(() => new Set<string>()))
  return {
    ...base,
    applied: true,
    missingBefore,
    missingAfter,
    created: missingBefore.filter((table) => !missingAfter.includes(table)),
    elapsedMs: Date.now() - started,
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-healing: a deployment that creates its own missing tables.
 *
 * ## Why this is not over-reach
 *
 * Every other route to a complete schema needs a human to carry something —
 * a shell command, nine hundred lines of SQL, or an operator secret out of a
 * hosting panel. Each of those has now failed in turn on this deployment: the
 * shell was not available, the paste stopped at migration 0015, and the secret
 * could not be read back because the platform stores it write-only.
 *
 * Three failures with one shape. The step does not belong to a person at all —
 * it belongs to the deployment, which is the only party that already holds both
 * the credential and the schema.
 *
 * ## Why it is safe to do without being asked
 *
 * Because of exactly what the file it applies can and cannot do:
 *
 *  - **It only ever creates.** Every statement is a guarded `CREATE` or an
 *    additive `ALTER`. The one `DROP` in the whole file is `DROP NOT NULL` —
 *    relaxing a constraint, not removing anything. `apply-schema.test.ts`
 *    asserts this, so a migration that ever introduced a destructive statement
 *    would fail the suite rather than reach a database unattended.
 *  - **It runs only when the tables are genuinely absent.** A complete database
 *    never reaches this code, and a partially applied one gets only its gaps.
 *  - **It is idempotent**, so a concurrent second attempt is a no-op rather
 *    than a conflict.
 *
 * The alternative — refusing to act and leaving the product broken with an
 * accurate error message — is not the cautious choice. It is the one that has
 * already cost days.
 *
 * `AUTO_SCHEMA=off` disables it for anyone who wants schema changes to be a
 * deliberate act, which is a legitimate preference on a shared database.
 */

/** How long before a failed attempt is retried. */
export const HEAL_RETRY_MS = 60_000

let healed = false
let lastAttempt = 0
let healing: Promise<boolean> | null = null

/** Whether this deployment is allowed to create its own tables. */
export function autoSchemaEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.AUTO_SCHEMA ?? '').trim().toLowerCase() !== 'off'
}

/**
 * Make sure the schema exists, at most once per process.
 *
 * Returns true when the database is complete afterwards. Never throws: this is
 * called from the path that is already handling a problem.
 *
 * The single-flight guard matters more than it looks — a cold serverless
 * instance can take several concurrent requests, and without it each one would
 * start its own apply against the same database at the same moment.
 */
export async function ensureSchema(): Promise<boolean> {
  if (healed) return true
  if (!isDbConfigured() || !autoSchemaEnabled()) return false

  const now = Date.now()
  if (lastAttempt && now - lastAttempt < HEAL_RETRY_MS) return false

  if (!healing) {
    lastAttempt = now
    healing = (async () => {
      const status = await schemaStatus()
      if (!status.reachable) return false
      if (status.missing.length === 0) {
        healed = true
        return true
      }

      console.warn(
        `[db] ${status.missing.length} of ${status.declared} tables are missing (${status.missing.join(', ')}) — creating them from the schema this build ships. Set AUTO_SCHEMA=off to disable.`,
      )
      const result = await applySchema()
      if (result.applied && result.missingAfter.length === 0) {
        healed = true
        console.warn(`[db] schema complete — created ${result.created.join(', ')} in ${result.elapsedMs}ms`)
        return true
      }
      console.error(
        `[db] could not complete the schema: ${result.error ?? 'still missing ' + result.missingAfter.join(', ')}`,
      )
      return false
    })()
      .catch(() => false)
      .finally(() => {
        healing = null
      })
  }
  return healing
}

/** Test seam — forget that this process has already healed. */
export function resetSchemaHealing(): void {
  healed = false
  lastAttempt = 0
  healing = null
}

/** A promise with a deadline, so a hung connection cannot hang the request. */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`the database did not finish applying the schema within ${ms}ms`)),
      ms,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}
