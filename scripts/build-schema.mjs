/**
 * Fold the migration series into one file an owner can paste into a database.
 *
 * ## Why this exists
 *
 * The migrations are applied by `drizzle-kit migrate`, which needs Node, the
 * repository and a shell. An owner configuring a deployment from a hosting
 * panel and a Supabase dashboard has none of those in front of them — so the
 * one step between "I added DATABASE_URL" and "registration works" was a step
 * they could not take, and the product looked broken for a reason nothing on
 * screen could explain.
 *
 * This produces `db/schema.sql`: the whole series, in order, in one paste.
 *
 * ## Why it is made idempotent here rather than in the migrations
 *
 * Fourteen of the twenty-two migrations use bare `CREATE TABLE` / `ADD COLUMN`,
 * which is correct *for a migration*: a migration runs exactly once against a
 * known state, and failing loudly when that assumption is broken is the point.
 *
 * A paste-once schema has the opposite requirement. It will be run by hand, by
 * someone who may have run part of it already, on a database whose state nobody
 * has recorded — and the honest failure mode there is "nothing happened",
 * never "half the schema exists and the error is three screens up".
 *
 * So the guards are added at this boundary, and the migrations keep their
 * strictness. The two files are generated from one source, so they cannot
 * disagree about what the schema is.
 *
 *   node scripts/build-schema.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'db/migrations'
const OUT = 'db/schema.sql'

/**
 * Wrap a statement so running it twice is a no-op.
 *
 * Dollar-quoted with a distinctive tag rather than escaped with doubled single
 * quotes: the statements being wrapped contain quotes of their own, and
 * escape-counting across nested quoting is how the first version of this broke.
 * A tag nothing else uses cannot collide.
 */
function guard(sql) {
  const body = sql.replace(/;\s*$/, '')
  return [
    'DO $lambda_guard$ BEGIN',
    `  EXECUTE $lambda_stmt$${body}$lambda_stmt$;`,
    /**
     * Both codes, because a UNIQUE constraint is two things at once.
     *
     * Adding a constraint twice raises `duplicate_object` — except when the
     * constraint is UNIQUE, which creates an index behind it, and the second
     * attempt trips on the *index* with `duplicate_table` instead. Catching
     * only the first left `credentials_pi_username_unique` failing on every
     * re-run, which is the one thing this file must never do.
     */
    'EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;',
    'END $lambda_guard$;',
  ].join('\n')
}

/**
 * Make one statement safe to run twice.
 *
 * Only the four shapes this series actually uses are handled, and anything
 * unrecognised is passed through untouched — a rewrite that silently mangled a
 * statement it did not understand would be far worse than one that left it
 * alone, because the result would still look like a clean run.
 */
function idempotent(statement) {
  const sql = statement.trim()
  if (!sql) return ''

  /**
   * Some migrations already guard themselves — a hand-written `DO $$ … END $$`
   * with its own existence check, or an explicit `IF NOT EXISTS`. Those are
   * left exactly as they are.
   *
   * Not an optimisation. Wrapping one of those in a second `DO $$` block nests
   * the dollar-quoting and produces SQL that will not parse, which is precisely
   * what happened: migration 0015 carries its own guarded `ADD CONSTRAINT`, the
   * `ADD CONSTRAINT` rule below matched it, and the generated file died at
   * `syntax error at or near "BEGIN"`.
   */
  if (/DO\s+\$\$/i.test(sql) || /EXCEPTION\s+WHEN/i.test(sql)) return sql

  // CREATE TABLE "x" → guarded
  if (/^CREATE TABLE\s+"/i.test(sql)) {
    return sql.replace(/^CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ')
  }
  // CREATE INDEX / UNIQUE INDEX → guarded
  if (/^CREATE (UNIQUE )?INDEX\s+"/i.test(sql)) {
    return sql.replace(/^CREATE (UNIQUE )?INDEX\s+/i, (m) => `${m.trim()} IF NOT EXISTS `)
  }
  // ALTER TABLE … ADD COLUMN "x" → guarded
  if (/ADD COLUMN\s+"/i.test(sql)) {
    return sql.replace(/ADD COLUMN\s+/i, 'ADD COLUMN IF NOT EXISTS ')
  }
  /**
   * Adding an enum label twice raises `duplicate_object`, and Postgres has a
   * native guard for exactly this since 9.6 — which is better than a DO block,
   * because `ALTER TYPE … ADD VALUE` may not run inside a transaction on some
   * versions and a DO block is one.
   */
  if (/^ALTER TYPE\s+.*ADD VALUE\s+/i.test(sql) && !/IF NOT EXISTS/i.test(sql)) {
    return sql.replace(/ADD VALUE\s+/i, 'ADD VALUE IF NOT EXISTS ')
  }
  /**
   * `CREATE TYPE` has no IF NOT EXISTS in Postgres, so it needs a DO block.
   * Without this the whole paste stops on the very first line for anyone who
   * has run it before — the single most likely way this file gets used.
   */
  if (/^CREATE TYPE\s+/i.test(sql)) return guard(sql)
  /**
   * A foreign key added twice is a duplicate_object too, and these arrive as
   * bare `ALTER TABLE … ADD CONSTRAINT`.
   */
  if (/ADD CONSTRAINT\s+/i.test(sql)) return guard(sql)
  return sql
}

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const parts = [
  '-- Lambda NX — the whole schema, in one paste.',
  '--',
  '-- Generated by scripts/build-schema.mjs from db/migrations. Do not edit by',
  '-- hand: edit a migration and regenerate, or the two will disagree about what',
  '-- the schema is.',
  '--',
  '-- Safe to run more than once. Every statement is guarded, so a partial',
  '-- earlier run does not have to be unpicked before this one.',
  `-- Covers ${files.length} migrations, ${files[0]} … ${files[files.length - 1]}.`,
  '',
]

for (const file of files) {
  const raw = readFileSync(join(DIR, file), 'utf8')
  parts.push(`-- ─────────────────────────────────────────────────────────────`)
  parts.push(`-- ${file}`)
  parts.push('')
  for (const statement of raw.split('--> statement-breakpoint')) {
    const out = idempotent(statement)
    if (out) parts.push(out.endsWith(';') ? out : `${out};`, '')
  }
}

writeFileSync(OUT, parts.join('\n'))
console.log(`${OUT}: ${files.length} migrations folded into one file`)
