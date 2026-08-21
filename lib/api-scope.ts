/**
 * Which API paths are exempt from the gateway rate limit.
 *
 * In its own module because the middleware and its test both need it, and a
 * Next middleware file should export only `middleware` and `config` — the same
 * boundary that `lib/mail/sender.ts` exists for.
 *
 * Being exempt from the *limit* is not being exempt from `no-store`. Every API
 * answer depends on a session or on configuration, so none of them may be
 * cached; these four simply must not be throttled:
 *
 *  - `/api/cron/*` — the scheduler calls from the platform's own address, so a
 *    shared limit would starve the jobs against each other.
 *  - `/api/auth/*` — sign-in needs its own far tighter policy; a shared 30/min
 *    is both too loose to matter and too tight to be a real product.
 *  - `/api/visit` — one fire-and-forget beacon per page open.
 *  - `/api/health` — an unreachable health check during an incident is worse
 *    than no health check.
 */
export const UNLIMITED_API = /^\/api\/(?:cron\/|auth\/|visit(?:$|\/)|health(?:$|\/))/

/** Whether this path is exempt from the gateway limit. */
export function isUnlimited(pathname: string): boolean {
  return UNLIMITED_API.test(pathname)
}
