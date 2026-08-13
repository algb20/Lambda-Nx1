import { NextResponse } from 'next/server'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildHealthReport } from '@/lib/modules/health'
import { buildAgeHours, getBuildInfo } from '@/lib/build-info'
import { describeProbe, probeDatabase } from '@/lib/db/probe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/health — readiness probe for deploy verification and uptime monitors.
 *
 * Inspects the running instance's own configuration only (no network, no target,
 * no secrets leaked — booleans and provider names only). Returns 200 when
 * healthy or degraded, 503 when a required check fails, so a load balancer can
 * gate traffic on it.
 */
function countMigrations(): number | undefined {
  try {
    const dir = join(process.cwd(), 'db', 'migrations')
    return readdirSync(dir).filter((f) => f.endsWith('.sql')).length
  } catch {
    return undefined
  }
}

export async function GET(request: Request) {
  const migrationCount = countMigrations()

  /**
   * `?deep=1` asks the database instead of asking the environment.
   *
   * Kept opt-in because the default probe is what an uptime monitor hits every
   * thirty seconds, and that should stay free of database round trips. The deep
   * form is what a person runs to settle "is this deployment actually wired to
   * the database, and is its schema current?" — the question a set environment
   * variable cannot answer.
   */
  const deep = new URL(request.url).searchParams.get('deep') === '1'
  const probe = deep ? await probeDatabase(migrationCount ?? null) : null

  const report = buildHealthReport({
    uptimeSeconds: typeof process.uptime === 'function' ? process.uptime() : 0,
    migrationCount,
    liveDatabase: probe ? describeProbe(probe) : undefined,
  })
  // Which commit is serving this, so "is the link current?" is answerable
  // without a hosting dashboard.
  const build = getBuildInfo()
  const httpStatus = report.status === 'unhealthy' ? 503 : 200
  return NextResponse.json(
    {
      ...report,
      build: { ...build, ageHours: buildAgeHours(build) },
      ...(probe ? { database: probe } : {}),
    },
    { status: httpStatus, headers: { 'cache-control': 'no-store' } },
  )
}
