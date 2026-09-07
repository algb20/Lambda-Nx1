/**
 * Where this deployment actually lives — decided from configuration, never from
 * the caller.
 *
 * ## The hole this closes
 *
 * Eight places built our own public URL out of `X-Forwarded-Host`, `Host`, or
 * `new URL(request.url).origin`. All three are the *request's* idea of who we
 * are, and a request is written by whoever sent it. Two consequences, both real:
 *
 * **A link in an email, pointed somewhere else.** `POST /api/follow` builds the
 * confirmation link from `x-forwarded-host`. Set that header and our server
 * emails the victim a link on your domain carrying their confirmation token.
 * The same shape applied to shared dossiers and published posts.
 *
 * **A fetch to an address of the caller's choosing.** `POST /api/mcp` fetched
 * `${origin}${gatewayPath}` with the origin taken from the request, so a `Host`
 * of `169.254.169.254` or `127.0.0.1:<port>` made our own server issue the
 * request from inside the deployment and hand back up to 300 characters of the
 * answer. A server-side request forgery, with the path fixed and the host free.
 *
 * A managed edge usually overwrites these headers with the real host, which is
 * why nothing had gone wrong. That is the platform's control, not ours, and
 * charter rule #4 says a deployment must be movable to a plain Node host
 * without an app rewrite — which would move it to a host with no such control.
 *
 * ## The rule
 *
 * Configuration wins, always. The request's own headers are consulted only when
 * an operator has said which hosts to trust, or when the caller is loopback and
 * this is therefore a development machine.
 *
 * `null` means "we do not know", and callers must treat it as a refusal rather
 * than as a reason to fall back to the header — that fallback is the hole.
 */

type Env = Record<string, string | undefined>

/** Trim a trailing slash so callers can concatenate a path without doubling it. */
const tidy = (raw: string): string => raw.trim().replace(/\/+$/, '')

/**
 * The origin an operator configured, or the platform set for us.
 *
 * Order matters: an explicit `NEXT_PUBLIC_SITE_URL` is somebody's decision and
 * outranks anything inferred. `URL` is Netlify's canonical site address and
 * `VERCEL_URL` is Vercel's — both are set by the platform, not by the caller,
 * which is the whole point. Same list and same order as `app/robots.ts` and
 * `app/sitemap.ts`, which already did this correctly.
 */
export function configuredOrigin(env: Env = process.env): string | null {
  const raw =
    env.NEXT_PUBLIC_SITE_URL ??
    env.NEXT_PUBLIC_APP_URL ??
    env.URL ??
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined)
  if (!raw || !raw.trim()) return null
  try {
    // Parsed rather than trusted: a malformed value in the environment should
    // read as "not configured", not as a broken URL pasted into an email.
    const url = new URL(tidy(raw))
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return tidy(url.origin)
  } catch {
    return null
  }
}

/** Hosts that are unambiguously this machine, where the header cannot be a lie. */
function isLoopback(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost')
}

/**
 * Hosts an operator has explicitly said belong to this deployment.
 *
 * The escape hatch for a self-hosted install behind a proxy that sets the
 * forwarded headers correctly and has no platform variable to read. Comma
 * separated, host[:port], no scheme — e.g. `TRUSTED_HOSTS=intel.example.com`.
 *
 * It exists so that closing this hole never strands a legitimate deployment,
 * and it is an allowlist rather than a switch: naming the hosts you trust is a
 * different act from trusting whatever arrives.
 */
export function trustedHosts(env: Env = process.env): string[] {
  return (env.TRUSTED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

/** The `Host`/`X-Forwarded-Host` pair a request is claiming, lowercased. */
function claimedHost(headers: Headers, fallbackUrl: string | null): { host: string; proto: string } {
  const host = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').trim().toLowerCase()
  const proto = (headers.get('x-forwarded-proto') ?? '').trim().toLowerCase()
  if (host) return { host, proto: proto || 'https' }
  if (fallbackUrl) {
    try {
      const url = new URL(fallbackUrl)
      return { host: url.host.toLowerCase(), proto: url.protocol.replace(':', '') }
    } catch {
      /* fall through */
    }
  }
  return { host: '', proto: proto || 'https' }
}

/**
 * This deployment's public origin, or `null` when it cannot be established
 * safely.
 *
 * Callers that put the result in a link or a fetch **must** treat `null` as a
 * refusal. Returning a header-derived value here "just so something works" is
 * the exact behaviour this module replaced.
 */
export function selfOrigin(request: Request | Headers, env: Env = process.env): string | null {
  const configured = configuredOrigin(env)
  if (configured) return configured

  const headers = request instanceof Headers ? request : request.headers
  const url = request instanceof Headers ? null : request.url
  const { host, proto } = claimedHost(headers, url)
  if (!host) return null

  // An operator named this host. That is configuration arriving by a different
  // route, and it is the only case where a header decides anything.
  if (trustedHosts(env).includes(host)) return tidy(`${proto}://${host}`)

  // A development machine talking to itself. Nothing outside can set this.
  const hostname = host.replace(/:\d+$/, '')
  if (isLoopback(hostname)) return tidy(`http://${host}`)

  return null
}

/**
 * The message a route shows when the origin cannot be established.
 *
 * One sentence, naming the variable to set, because the alternative an operator
 * reaches for otherwise is to put the header back.
 */
export const NO_ORIGIN_REASON =
  'This deployment does not know its own public address, so it will not build a link or make a request that depends on one. Set NEXT_PUBLIC_SITE_URL (or TRUSTED_HOSTS for a self-hosted proxy) and redeploy. It is deliberately not read from the request headers, which the caller controls.'
