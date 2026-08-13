import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { gatewayLimiter, GATEWAY_LIMIT, callerKey, rateLimitHeaders } from '@/lib/rate-limit'

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
 * **Deliberately excluded:** `/api/cron/*` (authenticated by shared secret and
 * called by the scheduler, which would otherwise be throttled by the platform's
 * own outbound address), `/api/auth/*` (login attempts need their own, much
 * tighter policy than a gateway read — a shared 30/min would be far too loose to
 * matter and far too tight to be a real product), `/api/visit` (one fire-and-
 * forget beacon per page open) and `/api/health` (an unreachable health check
 * during an incident is worse than no health check).
 */
export function middleware(request: NextRequest) {
  const result = gatewayLimiter.check(callerKey(request.headers))
  const headers = rateLimitHeaders(result, GATEWAY_LIMIT)

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          'Too many requests. The gateways read public providers that rate-limit us in turn, so this protects everyone using the app.',
        retryAfterSeconds: result.retryAfterSeconds,
      },
      { status: 429, headers },
    )
  }

  // Let the request through, but tell an honest client how much room is left so
  // it can pace itself rather than discover the wall.
  const response = NextResponse.next()
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
  return response
}

/**
 * Which paths the gate covers.
 *
 * Negative lookahead rather than a list of gateways: a new gateway is protected
 * by default, and the exemptions are the part that must be stated explicitly.
 * `matcher` is read at build time and must stay a literal — it cannot reference
 * a constant — so `middleware.test.ts` re-parses this exact string.
 */
export const config = {
  matcher: ['/api/((?!cron/|auth/|visit|health).*)'],
}
