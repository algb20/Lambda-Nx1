import { NextResponse } from 'next/server'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildHealthReport } from '@/lib/modules/health'

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

export async function GET() {
  const report = buildHealthReport({
    uptimeSeconds: typeof process.uptime === 'function' ? process.uptime() : 0,
    migrationCount: countMigrations(),
  })
  const httpStatus = report.status === 'unhealthy' ? 503 : 200
  return NextResponse.json(report, {
    status: httpStatus,
    headers: { 'cache-control': 'no-store' },
  })
}
