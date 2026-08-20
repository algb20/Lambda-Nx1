import { describe, expect, it, vi } from 'vitest'
import { httpMailFromEnv, httpMailProvider, type HttpMailConfig } from './http'
import type { MailMessage } from './types'

const message: MailMessage = {
  to: 'reader@example.org',
  subject: 'Your code',
  text: 'plain',
  html: '<p>rich</p>',
  headers: { 'List-Unsubscribe': '<https://example.org/u>' },
}

function capture(status = 200, body = '{"id":"abc"}') {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return { ok: status < 400, status, text: async () => body } as unknown as Response
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

function provider(service: HttpMailConfig['service'], fetchImpl: typeof fetch) {
  return httpMailProvider({ service, apiKey: 'k-123', from: 'lambda@example.org', fetchImpl })
}

describe('speaking each provider’s own dialect', () => {
  it('posts what Resend expects, with the key as a bearer token', async () => {
    const { calls, fetchImpl } = capture()
    const result = await provider('resend', fetchImpl).send(message)
    expect(result.delivered).toBe(true)

    const [call] = calls
    expect(call.url).toBe('https://api.resend.com/emails')
    expect((call.init.headers as Record<string, string>).authorization).toBe('Bearer k-123')
    const body = JSON.parse(String(call.init.body))
    expect(body).toMatchObject({ from: 'lambda@example.org', to: ['reader@example.org'], subject: 'Your code' })
  })

  it('posts what Brevo expects, with the key in its own header', async () => {
    const { calls, fetchImpl } = capture()
    await provider('brevo', fetchImpl).send(message)
    const [call] = calls
    expect(call.url).toBe('https://api.brevo.com/v3/smtp/email')
    expect((call.init.headers as Record<string, string>)['api-key']).toBe('k-123')
    const body = JSON.parse(String(call.init.body))
    expect(body.sender).toEqual({ email: 'lambda@example.org' })
    expect(body.to).toEqual([{ email: 'reader@example.org' }])
    expect(body.textContent).toBe('plain')
  })

  it('posts what Postmark expects, on the transactional stream', async () => {
    const { calls, fetchImpl } = capture()
    await provider('postmark', fetchImpl).send(message)
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.From).toBe('lambda@example.org')
    expect(body.TextBody).toBe('plain')
    // A bounce on a marketing send must not suppress a verification code.
    expect(body.MessageStream).toBe('outbound')
  })

  /**
   * The header that lets a reader leave. A provider silently dropping it would
   * cost us the one-click unsubscribe mailbox providers score senders on — and
   * nothing else in the system would notice.
   */
  it('carries List-Unsubscribe through every provider', async () => {
    const resend = capture()
    await provider('resend', resend.fetchImpl).send(message)
    expect(JSON.parse(String(resend.calls[0].init.body)).headers['List-Unsubscribe']).toContain('example.org')

    const brevo = capture()
    await provider('brevo', brevo.fetchImpl).send(message)
    expect(JSON.parse(String(brevo.calls[0].init.body)).headers['List-Unsubscribe']).toContain('example.org')

    const postmark = capture()
    await provider('postmark', postmark.fetchImpl).send(message)
    expect(JSON.parse(String(postmark.calls[0].init.body)).Headers).toContainEqual({
      Name: 'List-Unsubscribe',
      Value: '<https://example.org/u>',
    })
  })

  it('sends text alone when there is no HTML, rather than an empty field', async () => {
    const { calls, fetchImpl } = capture()
    await provider('resend', fetchImpl).send({ to: 'a@b.co', subject: 's', text: 't' })
    expect(JSON.parse(String(calls[0].init.body))).not.toHaveProperty('html')
  })
})

/**
 * "Delivery failed" tells an operator which of the three usual causes to fix:
 * none of them. A bad key is a settings change, an unverified sender is a DNS
 * record, and a rejected recipient is the reader's own address.
 */
describe('saying what actually went wrong', () => {
  it('reports the provider’s own message on a refusal', async () => {
    const { fetchImpl } = capture(401, '{"statusCode":401,"message":"API key is invalid"}')
    const result = await provider('resend', fetchImpl).send(message)
    expect(result.delivered).toBe(false)
    expect(result.detail).toContain('API key is invalid')
    expect(result.detail).toContain('401')
  })

  it('reads Postmark’s differently-cased field too', async () => {
    const { fetchImpl } = capture(401, '{"ErrorCode":10,"Message":"Request does not contain a valid Server token."}')
    const result = await provider('postmark', fetchImpl).send(message)
    expect(result.detail).toContain('valid Server token')
  })

  it('falls back to the raw body when the error is not JSON', async () => {
    const { fetchImpl } = capture(502, 'upstream unavailable')
    const result = await provider('brevo', fetchImpl).send(message)
    expect(result.detail).toContain('upstream unavailable')
  })

  /** Unreachable and refused lead an operator to opposite places. */
  it('distinguishes a network fault from a rejection', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    }) as unknown as typeof fetch
    const result = await provider('resend', fetchImpl).send(message)
    expect(result.delivered).toBe(false)
    expect(result.detail).toContain('could not reach')
    expect(result.detail).toContain('ENOTFOUND')
  })
})

describe('choosing a provider from the environment', () => {
  it('finds nothing when nothing is set', () => {
    expect(httpMailFromEnv({})).toBeNull()
  })

  it('reads a Resend key with a sender address', () => {
    expect(httpMailFromEnv({ RESEND_API_KEY: 're_x', MAIL_FROM: 'a@b.co' })).toEqual({
      service: 'resend',
      apiKey: 're_x',
      from: 'a@b.co',
    })
  })

  it('reads Brevo and Postmark by their own variables', () => {
    expect(httpMailFromEnv({ BREVO_API_KEY: 'b', MAIL_FROM: 'a@b.co' })?.service).toBe('brevo')
    expect(httpMailFromEnv({ POSTMARK_TOKEN: 'p', MAIL_FROM: 'a@b.co' })?.service).toBe('postmark')
  })

  /**
   * Every one of these services rejects a `From:` on a domain you have not
   * verified, so a guessed sender turns a clear configuration mistake into a
   * runtime failure on the first sign-up.
   */
  it('refuses a key with no sender address rather than inventing one', () => {
    expect(httpMailFromEnv({ RESEND_API_KEY: 're_x' })).toBeNull()
  })

  it('ignores a variable that is present but blank', () => {
    expect(httpMailFromEnv({ RESEND_API_KEY: '   ', MAIL_FROM: 'a@b.co' })).toBeNull()
  })
})
