import { NextResponse } from 'next/server'
import { adminGate } from '@/lib/social/admin'
import { applySchema, schemaStatus, SCHEMA_MIGRATION_COUNT } from '@/lib/db/apply-schema'

/**
 * The schema, applied by the deployment that needs it.
 *
 *   GET  /api/admin/schema  — what is missing. Reads. Changes nothing.
 *   POST /api/admin/schema  — create it. Idempotent.
 *
 * ## Why this route exists at all
 *
 * Every other way of applying the schema assumes a shell: `drizzle-kit migrate`
 * needs Node and a clone, and pasting `db/schema.sql` needs somebody to carry
 * nine hundred lines into a SQL editor without dropping the end. The second one
 * failed on this very deployment — the paste stopped at migration 0015, four
 * tables short, and the only symptom anyone could see was sign-up answering
 * "an error occurred". Days went into that.
 *
 * ## What a caller can and cannot make this do
 *
 * It executes one compile-time constant (`db/schema-sql`). **No part of the
 * request reaches the database** — not the body, not the query string, not a
 * header. There is no parameter to abuse because there is no parameter: POST
 * takes no input at all. The worst thing an authorised caller can do is ask
 * this deployment to create its own tables, twice.
 *
 * `adminGate` is still required, and is the second lock rather than the only
 * one. Schema creation is an operator action and should carry an operator
 * credential, and the refusal when `ADMIN_SECRET` is unset (503, not 403) says
 * plainly that the door was never fitted rather than that the key was wrong.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Read-only: which declared tables the database does not have. */
export async function GET(request: Request) {
  const refusal = adminGate(request)
  if (refusal) return refusal

  const status = await schemaStatus()
  return NextResponse.json(
    {
      ...status,
      migrations: SCHEMA_MIGRATION_COUNT,
      complete: status.reachable && status.missing.length === 0,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** Create the schema. Safe to call more than once. */
export async function POST(request: Request) {
  const refusal = adminGate(request)
  if (refusal) return refusal

  const result = await applySchema()

  /**
   * 200 on success, 500 on failure — and the body is the same shape either way,
   * because the interesting half of a failure is what it *did* manage to
   * create. A run that died partway is the state that caused this whole
   * incident, and it must never again be a thing nobody can see.
   */
  return NextResponse.json(result, {
    status: result.applied ? 200 : 500,
    headers: { 'Cache-Control': 'no-store' },
  })
}
