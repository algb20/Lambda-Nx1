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
 * Runs every six hours. Each job is idempotent — the publisher skips anything
 * already published and the Radar fingerprints its findings — so an extra run
 * costs time and never duplicates.
 */
export const config: Config = {
  schedule: '0 */6 * * *',
}

/** Jobs to run, in order. A failure in one must not skip the others. */
const JOBS = ['publish', 'radar-watch'] as const

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

  for (const job of JOBS) {
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
