/**
 * Prove a configured deployment actually works, subsystem by subsystem.
 *
 *   CRON_SECRET=… ADMIN_SECRET=… npm run verify:live -- https://your-site
 *
 * Run this **after** setting the variables in the host and redeploying. It is
 * the step between "the dashboard says the variable is set" and "the platform
 * is doing its work", and those are not the same thing: `docs/DEPLOY.md`
 * records the days lost to a `DATABASE_URL` that was correct except for a host
 * that serverless functions cannot resolve, while `/api/health` cheerfully
 * reported the check as passing because the *variable* was present.
 *
 * Secrets are read from this shell's environment, sent only to the origin you
 * name, over HTTPS, and never printed. Nothing is written to disk.
 *
 * Exit 0 only when every subsystem it was able to check answered.
 */
import { judgeDatabase, judgeProbe, summariseLive, type DeepDatabase, type Result } from '../lib/ops/live-check'

const TIMEOUT_MS = 60_000

const MARK: Record<string, string> = {
  working: '✓',
  'not-configured': '✖',
  rejected: '✖',
  failing: '✖',
  unknown: '?',
}

async function ask(url: string, headers: Record<string, string> = {}) {
  try {
    const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      /* some errors are not JSON, and that is itself informative */
    }
    return { status: res.status, json, text }
  } catch (err) {
    return { status: 0, json: undefined, text: err instanceof Error ? err.message : 'request failed' }
  }
}

async function main() {
  const origin = (process.argv[2] ?? process.env.NX_ORIGIN ?? '').replace(/\/+$/, '')
  if (!origin) {
    console.error('\n  Usage: npm run verify:live -- https://your-site\n')
    process.exit(2)
  }

  const results: Result[] = []
  console.log(`\n  Verifying ${origin}\n`)

  // 1. Configuration, as the deployment reports it — and the deep form, which
  //    asks the database instead of asking the environment.
  const deep = await ask(`${origin}/api/health?deep=1`)
  const body = deep.json as
    | { checks?: Array<{ name: string; status: string; required?: boolean }>; database?: DeepDatabase }
    | undefined

  const blocking = (body?.checks ?? []).filter((c) => c.required && c.status !== 'ok')
  results.push(
    blocking.length
      ? {
          subsystem: 'sign-in',
          verdict: 'not-configured',
          detail: `${blocking.map((c) => c.name).join(', ')} not set — nobody can sign in. Set it in the host, then redeploy.`,
        }
      : { subsystem: 'sign-in', verdict: 'working', detail: 'every required check is configured' },
  )
  results.push(judgeDatabase(deep.status, body?.database ?? null))

  // 2. The scheduler. A secret that is set but mistyped answers 403 forever
  //    while every configuration report says the check passes.
  const cron = process.env.CRON_SECRET
  const cronRes = cron
    ? await ask(`${origin}/api/cron/sources`, { Authorization: `Bearer ${cron}` })
    : { status: 0, json: undefined, text: '' }
  const cronReport = cronRes.json as { result?: { checked?: number; quarantined?: number } } | undefined
  results.push(
    judgeProbe(
      {
        subsystem: 'scheduler',
        status: cronRes.status,
        attempted: Boolean(cron),
        note:
          cronReport?.result?.checked !== undefined
            ? `re-probed ${cronReport.result.checked} of ${cronReport.result.quarantined ?? '?'} quarantined sources`
            : undefined,
      },
      'CRON_SECRET',
    ),
  )

  // 3. The admin surface, same shape.
  const admin = process.env.ADMIN_SECRET
  const adminRes = admin
    ? await ask(`${origin}/api/admin/visitors`, { 'x-admin-secret': admin })
    : { status: 0, json: undefined, text: '' }
  results.push(judgeProbe({ subsystem: 'admin', status: adminRes.status, attempted: Boolean(admin) }, 'ADMIN_SECRET'))

  const width = Math.max(...results.map((r) => r.subsystem.length))
  for (const r of results) {
    console.log(`  ${MARK[r.verdict] ?? '·'} ${r.subsystem.padEnd(width)}  ${r.detail}`)
  }
  console.log(`\n  ${summariseLive(results)}\n`)

  process.exit(results.some((r) => r.verdict !== 'working' && r.verdict !== 'unknown') ? 1 : 0)
}

void main()
