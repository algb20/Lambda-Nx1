/**
 * Who is allowed to trigger a scheduled job.
 *
 * The platform's own work — sweeping the Radar, publishing findings to the front
 * page — has to run without a person present. That means an endpoint a scheduler
 * can call, which means exactly one credential guarding it and no way to reach
 * it without.
 *
 * Two header forms are accepted because two things call these routes and they
 * disagree about the header:
 *
 *  - `Authorization: Bearer <secret>` — what Vercel Cron sends, and what any
 *    ordinary HTTP scheduler sends. Not negotiable from our side.
 *  - `x-cron-secret: <secret>` — what our own tooling and the Supabase pg_cron
 *    entry already send, kept so existing schedules keep working.
 *
 * The comparison is constant-time: a scheduler endpoint is a public URL, and a
 * comparison that returns early leaks the secret one byte at a time to anyone
 * patient enough to measure.
 */
import { timingSafeEqual } from 'node:crypto'

export type CronAuth = 'ok' | 'not-configured' | 'forbidden'

/** Constant-time string equality that does not leak length through timing. */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    // Still burn a comparison so a wrong length is not measurably faster.
    timingSafeEqual(b, b)
    return false
  }
  return timingSafeEqual(a, b)
}

/** Pull the presented secret out of whichever header carried it. */
export function presentedSecret(headers: Headers): string {
  const bearer = headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(bearer.trim())
  if (match) return match[1].trim()
  return headers.get('x-cron-secret')?.trim() ?? ''
}

/**
 * Decide. Separated from the HTTP response so the decision is testable and every
 * scheduled route refuses in exactly the same way.
 */
export function authorizeCron(request: Request, secret = process.env.CRON_SECRET): CronAuth {
  if (!secret || !secret.trim()) return 'not-configured'
  const provided = presentedSecret(request.headers)
  if (!provided) return 'forbidden'
  return secretsMatch(provided, secret) ? 'ok' : 'forbidden'
}

/** The standard refusal, so no scheduled route invents its own wording. */
export function cronGate(request: Request, secret = process.env.CRON_SECRET): Response | null {
  const verdict = authorizeCron(request, secret)
  if (verdict === 'ok') return null
  if (verdict === 'not-configured') {
    return Response.json(
      { error: 'CRON_SECRET is not configured on this deployment' },
      { status: 503 },
    )
  }
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}
