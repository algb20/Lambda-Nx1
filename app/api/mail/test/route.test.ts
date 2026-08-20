import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST, senderShape } from './route'

/**
 * The route that answers "I set the key and it still does not work".
 *
 * These pin the three failures that actually happen, because each needs a
 * different repair and telling them apart is the whole value of the route.
 */

const ORIGINAL = { ...process.env }

function req(init: { method?: string; body?: unknown; secret?: string | null } = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const secret = init.secret === undefined ? 'operator-secret' : init.secret
  if (secret) headers['x-admin-secret'] = secret
  return new Request('https://lambda.example/api/mail/test', {
    method: init.method ?? 'GET',
    headers,
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
}

beforeEach(() => {
  for (const key of ['RESEND_API_KEY', 'BREVO_API_KEY', 'POSTMARK_TOKEN', 'MAIL_FROM', 'MAIL_PROVIDER', 'SMTP_URL']) {
    delete process.env[key]
  }
  process.env.ADMIN_SECRET = 'operator-secret'
})

afterEach(() => {
  process.env = { ...ORIGINAL }
  vi.restoreAllMocks()
})

describe('reading a sender address', () => {
  it('takes the domain out of a display-name form', () => {
    expect(senderShape('Lambda <no-reply@lambdanx.app>')).toEqual({
      present: true,
      domain: 'lambdanx.app',
      hasDisplayName: true,
    })
  })

  it('reads a bare address too', () => {
    expect(senderShape('no-reply@lambdanx.app').domain).toBe('lambdanx.app')
  })

  /** A value that is not an address at all is a different fault from an absent one. */
  it('reports no domain when the value is not an address', () => {
    expect(senderShape('Lambda').domain).toBeNull()
    expect(senderShape('Lambda').present).toBe(true)
  })

  it('reports absence as absence', () => {
    expect(senderShape(undefined).present).toBe(false)
    expect(senderShape('   ').present).toBe(false)
  })
})

describe('the operator gate', () => {
  it('refuses without the secret — this route sends mail to a supplied address', async () => {
    expect((await GET(req({ secret: null }))).status).toBe(403)
    expect((await POST(req({ method: 'POST', secret: null, body: { to: 'a@b.co' } }))).status).toBe(403)
  })

  it('refuses when no secret is configured at all', async () => {
    delete process.env.ADMIN_SECRET
    expect((await GET(req())).status).toBe(503)
  })
})

describe('diagnosing a configuration', () => {
  it('names the missing sender when only a key is set', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-x'
    const body = await (await GET(req())).json()
    expect(body.configured).toBe(false)
    expect(body.problems.join(' ')).toContain('MAIL_FROM is not set')
  })

  /** The leftover that silently overrides a perfectly good key. */
  it('catches MAIL_PROVIDER=disabled overriding a working key', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-x'
    process.env.MAIL_FROM = 'Lambda <no-reply@lambdanx.app>'
    process.env.MAIL_PROVIDER = 'disabled'
    const body = await (await GET(req())).json()
    expect(body.problems.join(' ')).toContain('MAIL_PROVIDER=disabled is overriding')
  })

  it('warns that log mode never actually sends', async () => {
    process.env.RESEND_API_KEY = 're_x'
    process.env.MAIL_FROM = 'no-reply@lambdanx.app'
    process.env.MAIL_PROVIDER = 'log'
    const body = await (await GET(req())).json()
    expect(body.problems.join(' ')).toContain('never sent')
  })

  /**
   * The most common real failure: everything is right and the provider refuses
   * because nobody proved they own the domain in the From line.
   */
  it('states the domain that has to be verified', async () => {
    process.env.RESEND_API_KEY = 're_x'
    process.env.MAIL_FROM = 'Lambda <no-reply@lambdanx.app>'
    const body = await (await GET(req())).json()
    expect(body.problems).toEqual([])
    expect(body.transport).toBe('https')
    expect(body.senderMustBeVerified).toContain('lambdanx.app')
  })

  it('never returns the key, in any field', async () => {
    process.env.RESEND_API_KEY = 're_super_secret_value'
    process.env.MAIL_FROM = 'no-reply@lambdanx.app'
    const raw = await (await GET(req())).text()
    expect(raw).not.toContain('re_super_secret_value')
  })
})

describe('sending the test message', () => {
  it('rejects a request with no recipient', async () => {
    process.env.RESEND_API_KEY = 're_x'
    process.env.MAIL_FROM = 'no-reply@lambdanx.app'
    expect((await POST(req({ method: 'POST', body: { to: 'not-an-address' } }))).status).toBe(400)
  })

  it('answers 503, not a crash, when nothing is configured', async () => {
    const res = await POST(req({ method: 'POST', body: { to: 'a@b.co' } }))
    expect(res.status).toBe(503)
    expect((await res.json()).delivered).toBe(false)
  })

  /** The provider's own words survive to the operator, which is the point. */
  it('relays the provider’s refusal verbatim', async () => {
    process.env.RESEND_API_KEY = 're_x'
    process.env.MAIL_FROM = 'no-reply@lambdanx.app'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => '{"message":"The lambdanx.app domain is not verified"}',
      })) as unknown as typeof fetch,
    )
    const body = await (await POST(req({ method: 'POST', body: { to: 'a@b.co' } }))).json()
    expect(body.delivered).toBe(false)
    expect(body.detail).toContain('domain is not verified')
  })

  it('reports a clean acceptance', async () => {
    process.env.RESEND_API_KEY = 're_x'
    process.env.MAIL_FROM = 'no-reply@lambdanx.app'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => '{"id":"abc"}' })) as unknown as typeof fetch,
    )
    const body = await (await POST(req({ method: 'POST', body: { to: 'a@b.co' } }))).json()
    expect(body.delivered).toBe(true)
    expect(body.provider).toBe('resend')
  })
})
