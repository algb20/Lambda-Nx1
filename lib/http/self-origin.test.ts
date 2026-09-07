import { describe, expect, it } from 'vitest'
import { configuredOrigin, selfOrigin, trustedHosts, NO_ORIGIN_REASON } from './self-origin'

/**
 * Who this deployment thinks it is, and who is allowed to tell it.
 *
 * Each case here was a live call site: a confirmation link emailed to a victim,
 * a shared dossier permalink, and an MCP tool that fetched whatever host the
 * caller named. All three read `X-Forwarded-Host` and believed it.
 */

const req = (headers: Record<string, string>, url = 'https://internal.local/api/x') =>
  new Request(url, { headers })

describe('configuration decides, and nothing else does', () => {
  it('uses an explicitly configured site URL', () => {
    expect(configuredOrigin({ NEXT_PUBLIC_SITE_URL: 'https://lambdanx.com' })).toBe(
      'https://lambdanx.com',
    )
  })

  it('reads the platform variables Netlify and Vercel set', () => {
    expect(configuredOrigin({ URL: 'https://site.netlify.app' })).toBe('https://site.netlify.app')
    expect(configuredOrigin({ VERCEL_URL: 'site.vercel.app' })).toBe('https://site.vercel.app')
  })

  it('prefers an operator’s choice over a platform default', () => {
    expect(
      configuredOrigin({ NEXT_PUBLIC_SITE_URL: 'https://chosen.com', URL: 'https://auto.net' }),
    ).toBe('https://chosen.com')
  })

  it('drops a trailing slash so a path can be concatenated', () => {
    expect(configuredOrigin({ URL: 'https://x.com/' })).toBe('https://x.com')
  })

  /** A broken value in the environment must read as absent, not as a broken link. */
  it('treats a malformed or non-http value as not configured', () => {
    expect(configuredOrigin({ URL: 'not a url' })).toBeNull()
    expect(configuredOrigin({ URL: 'javascript:alert(1)' })).toBeNull()
    expect(configuredOrigin({ URL: '   ' })).toBeNull()
    expect(configuredOrigin({})).toBeNull()
  })

  it('ignores the request entirely once configured', () => {
    const origin = selfOrigin(req({ 'x-forwarded-host': 'evil.example' }), {
      URL: 'https://real.app',
    })
    expect(origin).toBe('https://real.app')
  })
})

describe('a header cannot name us', () => {
  /**
   * The confirmation-email hole, stated as an assertion. `POST /api/follow`
   * built the link from this header, so setting it mailed the victim a link on
   * the attacker's domain carrying the victim's token.
   */
  it('refuses an unknown X-Forwarded-Host rather than believing it', () => {
    expect(selfOrigin(req({ 'x-forwarded-host': 'attacker.example' }), {})).toBeNull()
  })

  it('refuses an unknown Host', () => {
    expect(selfOrigin(req({ host: 'attacker.example' }), {})).toBeNull()
  })

  /**
   * The SSRF, stated as an assertion. `POST /api/mcp` fetched `${origin}${path}`
   * with the origin from the request, so these two hosts reached the cloud
   * metadata service and the loopback runtime API from inside the deployment.
   */
  it('refuses the addresses an SSRF reaches for', () => {
    expect(selfOrigin(req({ host: '169.254.169.254' }), {})).toBeNull()
    expect(selfOrigin(req({ 'x-forwarded-host': '10.0.0.5:8080' }), {})).toBeNull()
    expect(selfOrigin(req({ 'x-forwarded-host': 'metadata.google.internal' }), {})).toBeNull()
  })

  it('refuses the origin baked into request.url when nothing is configured', () => {
    expect(selfOrigin(req({}, 'https://spoofed.example/api/mcp'), {})).toBeNull()
  })
})

describe('the two ways a header may still be believed', () => {
  it('accepts a host the operator named in TRUSTED_HOSTS', () => {
    const env = { TRUSTED_HOSTS: 'intel.example.com, other.example.com' }
    expect(selfOrigin(req({ 'x-forwarded-host': 'intel.example.com' }), env)).toBe(
      'https://intel.example.com',
    )
    expect(selfOrigin(req({ 'x-forwarded-host': 'not-listed.com' }), env)).toBeNull()
  })

  it('honours the forwarded protocol for a trusted host', () => {
    const env = { TRUSTED_HOSTS: 'intel.example.com' }
    expect(
      selfOrigin(req({ 'x-forwarded-host': 'intel.example.com', 'x-forwarded-proto': 'http' }), env),
    ).toBe('http://intel.example.com')
  })

  it('parses the trusted list tolerantly, because it is typed by hand', () => {
    expect(trustedHosts({ TRUSTED_HOSTS: ' A.com , ,b.com ' })).toEqual(['a.com', 'b.com'])
    expect(trustedHosts({})).toEqual([])
  })

  /** A development machine talking to itself; nothing outside can set this. */
  it('accepts loopback, which no remote caller can claim', () => {
    expect(selfOrigin(req({ host: 'localhost:3000' }), {})).toBe('http://localhost:3000')
    expect(selfOrigin(req({ host: '127.0.0.1:3000' }), {})).toBe('http://127.0.0.1:3000')
    expect(selfOrigin(req({ host: '[::1]:3000' }), {})).toBe('http://[::1]:3000')
  })

  /**
   * `evil-localhost.com` ends with neither `localhost` as a label nor a
   * loopback address, and `localhost.attacker.com` is the attacker's domain.
   * Both were worth pinning: a substring check would have passed them.
   */
  it('does not mistake an attacker domain for loopback', () => {
    expect(selfOrigin(req({ host: 'evil-localhost.com' }), {})).toBeNull()
    expect(selfOrigin(req({ host: 'localhost.attacker.com' }), {})).toBeNull()
    expect(selfOrigin(req({ host: '127.0.0.1.attacker.com' }), {})).toBeNull()
  })
})

describe('the refusal explains itself', () => {
  it('names the variable to set and why the header is not used', () => {
    expect(NO_ORIGIN_REASON).toContain('NEXT_PUBLIC_SITE_URL')
    expect(NO_ORIGIN_REASON).toContain('TRUSTED_HOSTS')
    expect(NO_ORIGIN_REASON).toContain('caller controls')
  })
})
