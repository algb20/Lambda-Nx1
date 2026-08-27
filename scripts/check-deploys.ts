/**
 * Ask every deployment whether it works, and say so in one screen.
 *
 * `npm run check:deploys`
 *
 * ## Why this is a script and not a test
 *
 * It reaches the network and looks at the world as it is right now, so its
 * answer changes without any commit changing — which is precisely what a test
 * must never do. The *judgement* it prints is tested (`deploy-check.test.ts`,
 * from the real readings of 2026-08-27); the asking is here.
 *
 * ## What it cannot leak
 *
 * `/api/health` is public and reports only whether each setting is configured,
 * never its value. This script is given no credential and passes none, so its
 * output is safe to paste anywhere — which matters, because the whole point is
 * that somebody reads it.
 *
 * Exits non-zero when anything is blocking, stale or unreachable, so it can
 * gate a release without anyone having to interpret it.
 */
import { judgeDeployments, summariseDeployments, type Reading } from '../lib/ops/deploy-check'
import { deploymentsToCheck } from '../lib/ops/deployments'

const TIMEOUT_MS = 20_000

const MARK: Record<string, string> = {
  unreachable: '✖',
  blocking: '✖',
  stale: '▲',
  degraded: '·',
}

async function read(name: string, origin: string): Promise<Reading> {
  try {
    const res = await fetch(`${origin}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // A health route answers 503 when it judges itself unhealthy, and that body
    // is the most useful one there is. Reading only 200s would discard exactly
    // the reports worth having.
    const body = (await res.json()) as Reading['health']
    return { site: name, health: body }
  } catch (err) {
    return { site: name, health: null, error: err instanceof Error ? err.message : 'unknown error' }
  }
}

async function main() {
  const deployments = deploymentsToCheck()
  const readings = await Promise.all(deployments.map((d) => read(d.name, d.origin)))

  const width = Math.max(...deployments.map((d) => d.name.length), 4)
  console.log('')
  for (const r of readings) {
    const build = r.health?.build
    const stamp = build?.shortCommit ? `${build.shortCommit}  ${build.builtAt ?? ''}` : (r.error ?? 'no answer')
    console.log(`  ${r.site.padEnd(width)}  ${(r.health?.status ?? 'unreachable').padEnd(10)}  ${stamp}`)
  }

  const findings = judgeDeployments(readings)
  if (findings.length) {
    console.log('')
    for (const f of findings) {
      console.log(`  ${MARK[f.severity] ?? '·'} ${f.site.padEnd(width)}  ${f.detail}`)
    }
  }

  console.log(`\n  ${summariseDeployments(findings, deployments.length)}\n`)

  const acted = findings.some((f) => f.severity !== 'degraded')
  process.exit(acted ? 1 : 0)
}

void main()
