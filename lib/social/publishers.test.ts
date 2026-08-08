import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ALL_PUBLISHERS,
  discordPublisher,
  publisherFor,
  safeWebhookUrl,
  slackPublisher,
  telegramPublisher,
  webhookPublisher,
} from './publishers'
import { renderPlainText, type SocialMessage } from './types'

const message: SocialMessage = {
  title: 'A finding',
  body: 'The detail of the finding.',
  url: 'https://lambda-nx.example/p/abc',
  kind: 'research',
  author: 'analyst',
  publishedAt: '2026-08-07T12:00:00.000Z',
}

afterEach(() => vi.restoreAllMocks())

/**
 * The server POSTs to an operator-supplied address, which is the exact shape of
 * an SSRF. These are the cases that must never be storable.
 */
describe('safeWebhookUrl', () => {
  it('accepts a public https URL', () => {
    expect(safeWebhookUrl('https://hooks.example.com/abc')).toBe('https://hooks.example.com/abc')
    expect(safeWebhookUrl('  https://example.com/x  ')).toBe('https://example.com/x')
  })

  it('refuses plaintext http, so a token is never sent in the clear', () => {
    expect(safeWebhookUrl('http://example.com/x')).toBeNull()
  })

  it('refuses loopback and link-local addresses', () => {
    expect(safeWebhookUrl('https://localhost/x')).toBeNull()
    expect(safeWebhookUrl('https://127.0.0.1/x')).toBeNull()
    expect(safeWebhookUrl('https://127.1.2.3/x')).toBeNull()
    expect(safeWebhookUrl('https://0.0.0.0/x')).toBeNull()
    expect(safeWebhookUrl('https://169.254.169.254/latest/meta-data')).toBeNull()
  })

  it('refuses private network ranges', () => {
    expect(safeWebhookUrl('https://10.0.0.5/x')).toBeNull()
    expect(safeWebhookUrl('https://192.168.1.1/x')).toBeNull()
    expect(safeWebhookUrl('https://172.16.0.1/x')).toBeNull()
    expect(safeWebhookUrl('https://172.31.255.255/x')).toBeNull()
    // …but 172.32 is public space and must still be allowed.
    expect(safeWebhookUrl('https://172.32.0.1/x')).not.toBeNull()
  })

  it('refuses other schemes and junk', () => {
    expect(safeWebhookUrl('file:///etc/passwd')).toBeNull()
    expect(safeWebhookUrl('ftp://example.com')).toBeNull()
    expect(safeWebhookUrl('not a url')).toBeNull()
    expect(safeWebhookUrl('')).toBeNull()
  })
})

describe('platform target validation', () => {
  it('holds Discord to a Discord webhook URL', () => {
    expect(
      discordPublisher.validateTarget('https://discord.com/api/webhooks/1/abc'),
    ).not.toBeNull()
    expect(
      discordPublisher.validateTarget('https://discordapp.com/api/webhooks/1/abc'),
    ).not.toBeNull()
    expect(discordPublisher.validateTarget('https://example.com/api/webhooks/1')).toBeNull()
  })

  it('holds Slack to hooks.slack.com', () => {
    expect(slackPublisher.validateTarget('https://hooks.slack.com/services/A/B/C')).not.toBeNull()
    expect(slackPublisher.validateTarget('https://slack.com/services/A/B/C')).toBeNull()
  })

  it('accepts Telegram numeric and @name chat ids only', () => {
    expect(telegramPublisher.validateTarget('-1001234567890')).toBe('-1001234567890')
    expect(telegramPublisher.validateTarget('@my_channel')).toBe('@my_channel')
    expect(telegramPublisher.validateTarget('my_channel')).toBeNull()
    expect(telegramPublisher.validateTarget('12')).toBeNull()
    expect(telegramPublisher.validateTarget('https://t.me/x')).toBeNull()
  })

  it('registers every platform under its own key', () => {
    for (const p of ALL_PUBLISHERS) expect(publisherFor(p.platform)).toBe(p)
  })
})

describe('publishing', () => {
  function mockFetch(response: Partial<Response> = { ok: true, status: 204 }) {
    const spy = vi.fn(async () => response as Response)
    vi.stubGlobal('fetch', spy)
    return spy
  }

  it('sends a neutral JSON envelope to a plain webhook', async () => {
    const spy = mockFetch()
    const result = await webhookPublisher.publish(message, {
      platform: 'webhook',
      target: 'https://hooks.example.com/abc',
    })
    expect(result.ok).toBe(true)
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hooks.example.com/abc')
    const payload = JSON.parse(init.body as string)
    expect(payload).toMatchObject({ source: 'lambda-nx', title: 'A finding', kind: 'research' })
  })

  it('refuses to publish to an address that failed validation', async () => {
    const spy = mockFetch()
    const result = await webhookPublisher.publish(message, {
      platform: 'webhook',
      target: 'http://169.254.169.254/latest',
    })
    expect(result.ok).toBe(false)
    // The important part: nothing was sent at all.
    expect(spy).not.toHaveBeenCalled()
  })

  it('puts the Telegram token in the path and never in the body', async () => {
    const spy = mockFetch({ ok: true, status: 200 })
    const result = await telegramPublisher.publish(message, {
      platform: 'telegram',
      target: '-1001234567890',
      secret: 'BOT-TOKEN',
    })
    expect(result.ok).toBe(true)
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/botBOT-TOKEN/sendMessage')
    expect(init.body as string).not.toContain('BOT-TOKEN')
  })

  it('fails cleanly with no Telegram token rather than calling the API', async () => {
    const spy = mockFetch()
    const result = await telegramPublisher.publish(message, {
      platform: 'telegram',
      target: '-1001234567890',
      secret: null,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/token/i)
    expect(spy).not.toHaveBeenCalled()
  })

  it('reports the platform status and body when a delivery is rejected', async () => {
    mockFetch({ ok: false, status: 404, text: async () => 'no_such_channel' } as Partial<Response>)
    const result = await webhookPublisher.publish(message, {
      platform: 'webhook',
      target: 'https://hooks.example.com/abc',
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
    expect(result.error).toContain('no_such_channel')
  })

  it('turns a network failure into a result rather than a throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
    )
    const result = await webhookPublisher.publish(message, {
      platform: 'webhook',
      target: 'https://hooks.example.com/abc',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('ECONNREFUSED')
  })
})

describe('renderPlainText', () => {
  it('carries the title, body and link', () => {
    const text = renderPlainText(message)
    expect(text).toContain('A finding')
    expect(text).toContain('The detail of the finding.')
    expect(text).toContain(message.url)
  })

  it('truncates a very long body instead of being rejected by the platform', () => {
    const text = renderPlainText({ ...message, body: 'x'.repeat(5000) })
    expect(text.length).toBeLessThan(1000)
    expect(text).toContain('…')
  })

  it('omits an empty body rather than leaving a hole', () => {
    expect(renderPlainText({ ...message, body: '   ' })).toBe(`A finding\n\n${message.url}`)
  })
})
