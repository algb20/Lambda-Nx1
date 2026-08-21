import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { gatewayLimiter, GATEWAY_LIMIT, callerKey, rateLimitHeaders } from '@/lib/rate-limit'
import { isUnlimited } from '@/lib/api-scope'

/**
 * One gate in front of the open API, rather than a copy of the same guard in
 * twenty route files.
 *
 * The gateways are deliberately usable without an account (charter §1). That is
 * worth keeping, and it is also what makes a limit necessary: every gateway call
 * fans out to public providers — NASA, USGS, Wikipedia, CISA, OpenSanctions —
 * who rate-limit *Lambda*, not the visitor. One looping client therefore takes
 * the product down for everyone else, and the symptom is an empty map rather
 * than an error anyone can trace back.
 *
 * Putting it here instead of in each route means a gateway added later is
 * covered the day it is written, with nothing to remember. The matcher is the
 * only thing that has to stay correct, and it is asserted in the tests.
 *
 * **Deliberately excluded from the limit:** `/api/cron/*` (authenticated by
 * shared secret and called by the scheduler, which would otherwise be throttled
 * by the platform's own outbound address), `/api/auth/*` (login attempts need
 * their own, much tighter policy than a gateway read — a shared 30/min would be
 * far too loose to matter and far too tight to be a real product), `/api/visit`
 * (one fire-and-forget beacon per page open) and `/api/health` (an unreachable
 * health check during an incident is worse than no health check).
 *
 * ## The second job: nothing under /api is ever cached
 *
 * Every API answer here depends on either the caller's session or the
 * deployment's configuration, and **not one of them was declaring that**. Six
 * routes went out with no `Cache-Control` at all, which on a CDN-fronted host
 * means the platform may cache and replay them.
 *
 * Two failures, one cause. The visible one cost days: the owner added
 * `DATABASE_URL`, redeployed, and kept seeing "accounts are not available",
 * because `/api/auth/methods` was still being served from a copy taken before
 * the variable existed. Nothing was wrong with their configuration at all.
 *
 * The serious one is `/api/auth/me`, which returns the signed-in person's id,
 * handle, real name and plan. A shared cache holding that would hand one
 * reader's identity to the next — and it would look, from every side, like the
 * product working normally.
 *
 * So the matcher now spans all of `/api`, the limiter keeps its narrower scope
 * inside, and `no-store` is set on everything. A route added next year is
 * covered on the day it is written, which is the only way this stays true.
 */

export function middleware(request: NextRequest) {
  const limited = !isUnlimited(request.nextUrl.pathname)

  if (limited) {
    const result = gatewayLimiter.check(callerKey(request.headers))
    const headers = rateLimitHeaders(result, GATEWAY_LIMIT)

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            'Too many requests. The gateways read public providers that rate-limit us in turn, so this protects everyone using the app.',
          retryAfterSeconds: result.retryAfterSeconds,
        },
        // A refusal must not be cached either: a cached 429 would keep refusing
        // long after the window that produced it had passed.
        { status: 429, headers: { ...headers, 'Cache-Control': 'no-store' } },
      )
    }

    // Let the request through, but tell an honest client how much room is left
    // so it can pace itself rather than discover the wall.
    const response = NextResponse.next()
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'no-store')
  return response
}

/**
 * Which paths the middleware runs on: everything under `/api`.
 *
 * It used to exclude four prefixes, because the only job here was the rate
 * limit. That exclusion is now expressed in `UNLIMITED` instead, and the
 * matcher spans everything — because the second job, `no-store`, must apply to
 * the excluded routes most of all. `/api/auth/me` was one of them.
 *
 * `matcher` is read at build time and must stay a literal — it cannot reference
 * a constant — so `middleware.test.ts` re-parses this exact string as a regular
 * expression. That is why it is written `/api/(.*)` and not `/api/:path*`:
 * both are valid Next matchers, and only the first is also a valid regex.
 */
export const config = {
  matcher: ['/api/(.*)'],
}
