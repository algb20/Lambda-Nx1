import type { Config } from '@netlify/functions'

/**
 * The platform's own work, on a Netlify schedule.
 *
 * `vercel.json` declares these jobs for Vercel. Netlify does not read that file,
 * so on the host this project actually deploys to, nothing ran: the front page
 * had no automatic posts and the Radar never swept, because the scheduler that
 * was supposed to drive them existed only in another platform's config.
 *
 * This is deliberately a *caller*, not a second implementation. It performs one
 * authenticated HTTP request to the same `/api/cron/<job>` route Vercel Cron
 * would hit, so both hosts drive identical code and there is no second copy of
 * the publishing logic to drift out of step with the first.
 *
 * Every job is idempotent — the publisher skips anything already published and
 * the Radar fingerprints its findings — so an extra run costs time and never
 * duplicates. That is what makes a short interval safe (see `config` below).
 */
import { dueJobs } from '../../lib/ops/schedule'

/**
 * How often Netlify wakes this function. Every scheduled job's cadence is a
 * multiple of it, so a job is due when the tick lands on its interval.
 */
const TICK_MINUTES = 20

export const config: Config = {
  /**
   * Every twenty minutes, not every six hours.
   *
   * Six hours was chosen when this was a research tool. The front page is now
   * meant to be the world as it stands, and a page that renews itself four
   * times a day is a page a reader learns to stop revisiting. Twenty minutes
   * is roughly the interval at which the underlying publishers themselves
   * update — going faster would spend their goodwill for nothing new.
   */
  schedule: `*/${TICK_MINUTES} * * * *`,
}

/**
 * What runs on this tick comes from `lib/ops/schedule.ts`, not from here.
 *
 * This file used to hold its own arrays — `ALWAYS = ['publish']`, `HOURLY =
 * ['radar-watch']` — while `vercel.json` held a different pair. Two
 * declarations of one schedule, and nothing comparing them, so the two hosts
 * ran different work for months. `netlify.toml` says in its own comment that
 * this scheduler exists *"so both hosts drive identical code"*; it did not.
 *
 * Worse, `radar-monitors` appeared in neither, so the monitors users saved
 * never swept on their own on this host at all.
 *
 * Both hosts now derive from the one declaration, and a test fails if a job
 * exists with no schedule or a schedule names a job that does not exist.
 */

export default async function handler(): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Say why rather than failing silently: an unconfigured deployment that
    // quietly publishes nothing is the exact failure this replaces.
    console.error('[scheduled-jobs] CRON_SECRET is not set — nothing was run')
    return new Response('CRON_SECRET is not configured', { status: 503 })
  }

  // `URL` is the site's own address, set by Netlify on every deploy.
  const origin = process.env.URL ?? process.env.DEPLOY_PRIME_URL
  if (!origin) {
    console.error('[scheduled-jobs] no site URL in the environment')
    return new Response('Site URL unavailable', { status: 500 })
  }

  const outcomes: Record<string, string> = {}

  const jobs = dueJobs(new Date(), TICK_MINUTES)

  for (const job of jobs) {
    try {
      const res = await fetch(`${origin}/api/cron/${job}`, {
        headers: { Authorization: `Bearer ${secret}` },
      })
      const body = await res.text()
      outcomes[job] = `${res.status} ${body.slice(0, 300)}`
      if (!res.ok) console.error(`[scheduled-jobs] ${job} answered ${res.status}: ${body.slice(0, 300)}`)
    } catch (err) {
      // One unreachable job must not cancel the rest of the run.
      outcomes[job] = `failed: ${err instanceof Error ? err.message : 'unknown'}`
      console.error(`[scheduled-jobs] ${job} threw:`, err)
    }
  }

  return Response.json({ ranAt: new Date().toISOString(), outcomes })
}
