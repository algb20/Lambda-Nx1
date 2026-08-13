import { describe, it, expect } from 'vitest'
import { buildContentSecurityPolicy, securityHeaders } from './csp.mjs'

/**
 * These assert the capabilities the policy has to permit, not the string it
 * happens to produce.
 *
 * The bug they exist for: the deployed policy allowed only `sdk.minepi.com`, so
 * on the live site the browser refused the translate stylesheet and the platform
 * toolbar, and the console filled with CSP violations that no test could see.
 * A policy is product behaviour; it belongs under test like any other.
 */
function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/)
      return [name, values]
    }),
  )
}

describe('the policy permits what the product actually loads', () => {
  const d = directives(buildContentSecurityPolicy())

  it('lets the Pi SDK load and open its approval frame', () => {
    expect(d.get('script-src')).toContain('https://sdk.minepi.com')
    expect(d.get('script-src')).toContain('https://app-cdn.minepi.com')
    expect(d.get('frame-src')).toContain('https://sdk.minepi.com')
    // Without this the SDK loads and then cannot talk to Pi — worse than not loading.
    expect(d.get('connect-src')).toContain('https://api.minepi.com')
  })

  it('lets a translating browser style the page it just translated', () => {
    for (const directive of ['style-src', 'font-src', 'img-src']) {
      expect(d.get(directive), directive).toContain('https://www.gstatic.com')
    }
    expect(d.get('connect-src')).toContain('https://translate.googleapis.com')
  })

  it('allows the canvas exports the globe and the watermark produce', () => {
    expect(d.get('img-src')).toContain('blob:')
    expect(d.get('worker-src')).toContain('blob:')
  })
})

describe('the policy still refuses what it should', () => {
  const d = directives(buildContentSecurityPolicy())

  it('cannot be framed by anyone, and loads no plugins', () => {
    expect(d.get('frame-ancestors')).toEqual(["'none'"])
    expect(d.get('object-src')).toEqual(["'none'"])
  })

  it('pins the document base and form targets to our own origin', () => {
    expect(d.get('base-uri')).toEqual(["'self'"])
    expect(d.get('form-action')).toEqual(["'self'"])
  })

  it('never opens a directive to everything', () => {
    const csp = buildContentSecurityPolicy({ onVercel: true })
    expect(csp).not.toContain('*;')
    expect(csp.split(';').some((part) => part.trim().split(/\s+/)[1] === '*')).toBe(false)
  })

  /** Every directive must be explicit; a missing one silently falls back. */
  it('sets each directive the browser would otherwise infer', () => {
    for (const directive of [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'frame-src',
      'worker-src',
    ]) {
      expect(d.has(directive), directive).toBe(true)
    }
  })
})

describe('the Vercel toolbar allowance is scoped to Vercel', () => {
  it('is absent from a Netlify or self-hosted build', () => {
    const csp = buildContentSecurityPolicy({ onVercel: false })
    expect(csp).not.toContain('vercel.live')
    expect(csp).not.toContain('pusher.com')
  })

  it('is present when the build runs on Vercel, in every directive it needs', () => {
    const d = directives(buildContentSecurityPolicy({ onVercel: true }))
    expect(d.get('script-src')).toContain('https://vercel.live')
    expect(d.get('style-src')).toContain('https://vercel.live')
    expect(d.get('frame-src')).toContain('https://vercel.live')
    // The toolbar holds a websocket open; without this it retries forever.
    expect(d.get('connect-src')).toContain('wss://*.pusher.com')
  })
})

describe('securityHeaders', () => {
  it('ships the whole set, not just the policy', () => {
    const keys = securityHeaders().map((h) => h.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy',
        'Strict-Transport-Security',
        'Content-Security-Policy',
      ]),
    )
  })

  it('carries the same policy the builder produces', () => {
    const header = securityHeaders({ onVercel: true }).find(
      (h) => h.key === 'Content-Security-Policy',
    )
    expect(header?.value).toBe(buildContentSecurityPolicy({ onVercel: true }))
  })
})
