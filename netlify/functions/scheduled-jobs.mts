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
  schedule: '*/20 * * * *',
}

/**
 * Jobs to run, in order. A failure in one must not skip the others.
 *
 * The Radar is not on every tick: it sweeps a watchlist that changes on the
 * scale of days, so running it three times an hour would be work nobody reads.
 * It is triggered on the hour instead — see `shouldRunRadar`.
 */
const ALWAYS = ['publish'] as const
const HOURLY = ['radar-watch'] as const

/** True near the top of the hour, which is when the 20-minute tick lands on :00. */
function shouldRunRadar(now = new Date()): boolean {
  return now.getUTCMinutes() < 20
}

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

  const jobs = [...ALWAYS, ...(shouldRunRadar() ? HOURLY : [])]

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
