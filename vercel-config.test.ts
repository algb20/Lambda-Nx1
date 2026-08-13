import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_MODES } from './lib/gateways'

/**
 * `vercel.json` is deployment configuration, which means its mistakes do not
 * look like mistakes. A cron expression the plan does not allow does not get
 * throttled or warned about — **the whole deployment fails**, and the symptom
 * the operator sees is "I merged and nothing changed": an application problem's
 * costume worn by a hosting problem.
 *
 * That happened here. A six-hourly publish schedule was committed, and from that
 * moment every Vercel build failed with:
 *
 *   Hobby accounts are limited to daily cron jobs. This cron expression
 *   (0 * / 6 * * *) would run more than once per day.
 *
 * It cost most of a day to find, because the site kept serving — just the old
 * code. These assert the constraints so it cannot happen twice.
 */
const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
  crons?: Array<{ path: string; schedule: string }>
  functions?: Record<string, { maxDuration?: number }>
}

/** Vercel's Hobby plan: two cron jobs, each at most once per day. */
const HOBBY_MAX_CRONS = 2

/**
 * True when a 5-field expression fires at most once a day — i.e. both the minute
 * and hour fields name a single value rather than a list, range or step.
 */
export function isDailyOrLess(schedule: string): boolean {
  const [minute, hour] = schedule.trim().split(/\s+/)
  if (!minute || !hour) return false
  const single = (field: string) => /^\d+$/.test(field)
  return single(minute) && single(hour)
}

describe('isDailyOrLess', () => {
  it('accepts a fixed time of day', () => {
    expect(isDailyOrLess('0 6 * * *')).toBe(true)
    expect(isDailyOrLess('30 5 * * 1')).toBe(true)
  })

  it('rejects everything that fires more than once a day', () => {
    expect(isDailyOrLess('0 */6 * * *')).toBe(false) // the one that broke it
    expect(isDailyOrLess('15 * * * *')).toBe(false)
    expect(isDailyOrLess('*/5 * * * *')).toBe(false)
    expect(isDailyOrLess('0 1,13 * * *')).toBe(false)
    expect(isDailyOrLess('0 9-17 * * *')).toBe(false)
  })

  it('rejects a malformed expression rather than assuming it is fine', () => {
    expect(isDailyOrLess('')).toBe(false)
    expect(isDailyOrLess('0')).toBe(false)
  })
})

describe('vercel.json stays deployable on the plan this project is on', () => {
  const crons = config.crons ?? []

  it('declares no more crons than the plan allows', () => {
    expect(crons.length).toBeLessThanOrEqual(HOBBY_MAX_CRONS)
  })

  it('schedules every cron at most once a day', () => {
    for (const cron of crons) {
      expect(isDailyOrLess(cron.schedule), `${cron.path} → "${cron.schedule}"`).toBe(true)
    }
  })

  it('points every cron at a job the route actually implements', () => {
    const jobs = ['publish', 'radar', 'radar-monitors', 'radar-watch']
    for (const cron of crons) {
      const job = cron.path.replace('/api/cron/', '')
      expect(jobs, `${cron.path} is not a job the route knows`).toContain(job)
    }
  })

  it('gives no two crons the same minute, so they do not contend', () => {
    const times = crons.map((c) => c.schedule.split(/\s+/).slice(0, 2).join(' '))
    expect(new Set(times).size).toBe(times.length)
  })
})

describe('the fan-out routes get a ceiling above the platform default', () => {
  const functions = config.functions ?? {}

  it('lifts every listed route to 60s', () => {
    for (const [path, settings] of Object.entries(functions)) {
      expect(settings.maxDuration, path).toBe(60)
    }
  })

  /**
   * A gateway killed at the 10s default returns an HTML error page where the
   * client expects JSON — which is how the world map ends up empty.
   */
  it('covers the routes that query several providers at once', () => {
    for (const path of ['app/api/world/route.ts', 'app/api/cron/[job]/route.ts']) {
      expect(Object.keys(functions), path).toContain(path)
    }
  })

  it('references gateways that exist', () => {
    const gatewayRoutes = Object.keys(functions).filter((p) =>
      p.startsWith('app/api/intelligence/'),
    )
    for (const route of gatewayRoutes) {
      const mode = route.split('/')[3]
      expect(ALL_MODES as readonly string[], route).toContain(mode)
    }
  })
})
