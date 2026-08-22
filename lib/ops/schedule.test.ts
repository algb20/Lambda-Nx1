import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dueJobs, SCHEDULE, SCHEDULED_JOBS, UNSCHEDULED, VERCEL_FALLBACK } from './schedule'

/**
 * The guard that makes "exists but never runs" impossible.
 *
 * `radar-monitors` was a real route, listed in `JOBS`, documented in DEPLOY.md
 * with a suggested cadence of every 15–60 minutes — and scheduled on neither
 * host. The monitors users saved never swept on their own. Nothing failed,
 * because nothing was comparing the jobs that exist to the jobs that run.
 */
describe('every job either has a clock or a stated reason it has none', () => {
  it('accounts for every job the route can run', () => {
    const scheduled = new Set(SCHEDULE.map((s) => s.job))
    const excused = new Set(Object.keys(UNSCHEDULED))
    const orphans = SCHEDULED_JOBS.filter((j) => !scheduled.has(j) && !excused.has(j))
    expect(orphans, 'a job that exists and nothing ever triggers').toEqual([])
  })

  it('schedules nothing that does not exist', () => {
    const known = new Set<string>(SCHEDULED_JOBS)
    const ghosts = [...SCHEDULE.map((s) => s.job), ...Object.keys(UNSCHEDULED)].filter(
      (j) => !known.has(j),
    )
    expect(ghosts, 'a schedule pointing at a route that is not there').toEqual([])
  })

  /**
   * The route's own list is the authority, and this file copies it. A copy that
   * can drift is the bug this module exists to remove, so it is checked.
   */
  it('lists exactly the jobs the route lists', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/cron/[job]/route.ts'), 'utf8')
    const declared = route.match(/const JOBS = \[([^\]]+)\]/)?.[1] ?? ''
    const fromRoute = [...declared.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort()
    expect(fromRoute).toEqual([...SCHEDULED_JOBS].sort())
  })

  it('gives every cadence a reason', () => {
    for (const s of SCHEDULE) {
      expect(s.why.length, `${s.job} has a number with no reason beside it`).toBeGreaterThan(40)
    }
    for (const [job, why] of Object.entries(UNSCHEDULED)) {
      expect(why.length, `${job} is excused with no reason`).toBeGreaterThan(20)
    }
  })
})

describe('the fallback host is a degraded subset, and says so', () => {
  /**
   * I began this by asserting the two hosts run identical work, because
   * `netlify.toml` says the scheduler exists *"so both hosts drive identical
   * code"*. They cannot. **Vercel's plan allows two cron jobs, each at most once
   * a day** — a constraint `vercel-config.test.ts` has asserted ever since a
   * previous session spent most of a day discovering that exceeding it fails
   * the whole deployment while the site keeps serving the old code.
   *
   * My first version wrote `0,20,40 * * * *` into `vercel.json` and would have
   * broken every Vercel build. The existing test caught it immediately, which
   * is the entire argument for asserting hosting constraints in the repository
   * rather than remembering them.
   *
   * So the fallback is not equality with a rounding error. It is two chosen
   * jobs, each carrying what its cadence costs.
   */
  it('matches the checked-in vercel.json exactly', () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons?: Array<{ path: string; schedule: string }>
    }
    const actual = [...(config.crons ?? [])].sort((a, b) => a.path.localeCompare(b.path))
    const expected = VERCEL_FALLBACK.map(({ path, schedule }) => ({ path, schedule })).sort((a, b) =>
      a.path.localeCompare(b.path),
    )
    expect(actual).toEqual(expected)
  })

  it('stays inside the plan it has to deploy on', () => {
    expect(VERCEL_FALLBACK.length, "two cron jobs is the whole budget").toBeLessThanOrEqual(2)
    for (const cron of VERCEL_FALLBACK) {
      const [minute, hour] = cron.schedule.split(/\s+/)
      expect(/^\d+$/.test(minute) && /^\d+$/.test(hour), `${cron.path} fires more than once a day`).toBe(true)
    }
  })

  /**
   * The gap between the hosts is written down rather than left to be
   * rediscovered. A fallback that is quietly worse is how an operator ends up
   * asking why alerts are a day late.
   */
  it('says what each slot costs in freshness', () => {
    for (const cron of VERCEL_FALLBACK) {
      expect(cron.costs.length, `${cron.path} is slower and does not say by how much`).toBeGreaterThan(30)
    }
  })

  it('reaches the monitors on the fallback too, even if only daily', () => {
    // The bug being fixed is that saved monitors never swept on the default
    // host. On the capped host they must at least sweep — `radar` is how.
    const paths = VERCEL_FALLBACK.map((c) => c.path)
    expect(paths.some((p) => p.endsWith('/radar') || p.endsWith('/radar-monitors'))).toBe(true)
  })
})

describe('what is due on a tick', () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 7, 22, 9, minute))

  it('runs the frequent jobs on every tick', () => {
    for (const minute of [0, 20, 40]) {
      expect(dueJobs(at(minute))).toContain('publish')
      expect(dueJobs(at(minute)), 'a saved monitor is only useful if it sweeps').toContain(
        'radar-monitors',
      )
    }
  })

  it('runs the hourly job once an hour, at the top', () => {
    expect(dueJobs(at(0))).toContain('radar-watch')
    expect(dueJobs(at(20))).not.toContain('radar-watch')
    expect(dueJobs(at(40))).not.toContain('radar-watch')
  })

  /**
   * The tick counted the hour, so `everyMinutes: 1440` produced `everyTicks =
   * 72` against a tick that never exceeded 2 — matching at minute 0 of every
   * hour. A daily job would have run twenty-four times a day with the number
   * beside it saying once: the schedule lying about itself, which is the exact
   * fault this module was written to end.
   */
  it('runs a daily job once a day, not once an hour', () => {
    const ticks: Date[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 20, 40]) ticks.push(new Date(Date.UTC(2026, 7, 22, hour, minute)))
    }
    const due = ticks.filter((t) => dueJobs(t).includes('sources'))
    expect(due, 'a daily cadence that fires more than once a day').toHaveLength(1)
    expect(due[0].getUTCHours()).toBe(0)
  })

  it('still runs the hourly job every hour, at the top', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(dueJobs(new Date(Date.UTC(2026, 7, 22, hour, 0)))).toContain('radar-watch')
      expect(dueJobs(new Date(Date.UTC(2026, 7, 22, hour, 20)))).not.toContain('radar-watch')
    }
  })

  it('never returns a job that is not on the schedule', () => {
    const scheduled = new Set(SCHEDULE.map((s) => s.job))
    for (const minute of [0, 20, 40]) {
      for (const job of dueJobs(at(minute))) expect(scheduled.has(job)).toBe(true)
    }
  })
})
