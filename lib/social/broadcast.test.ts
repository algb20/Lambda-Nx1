import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { broadcast, channelsForAutoPublish, deliver, type ChannelRecord } from './broadcast'
import { encryptSecret } from './secrets'
import type { SocialMessage } from './types'

const message: SocialMessage = {
  title: 'A finding',
  body: 'Detail.',
  url: 'https://lambda-nx.example/p/abc',
  kind: 'research',
  author: 'analyst',
  publishedAt: '2026-08-07T12:00:00.000Z',
}

function channel(over: Partial<ChannelRecord> = {}): ChannelRecord {
  return {
    id: 'c1',
    platform: 'webhook',
    label: 'Test',
    target: 'https://hooks.example.com/abc',
    secretEnc: null,
    enabled: true,
    autoPublish: true,
    kindFilter: null,
    ...over,
  }
}

afterEach(() => vi.unstubAllGlobals())

/**
 * Three independent switches. "It started posting everything" is the failure
 * operators actually fear, so each one is asserted on its own.
 */
describe('channelsForAutoPublish', () => {
  it('needs all three conditions before a channel is reached automatically', () => {
    const channels = [
      channel({ id: 'on' }),
      channel({ id: 'disabled', enabled: false }),
      channel({ id: 'manual', autoPublish: false }),
      channel({ id: 'other-kind', kindFilter: 'post' }),
      channel({ id: 'matching-kind', kindFilter: 'research' }),
    ]
    const chosen = channelsForAutoPublish(channels, 'research').map((c) => c.id)
    expect(chosen).toEqual(['on', 'matching-kind'])
  })

  it('sends nothing at all when no channel opted in', () => {
    expect(channelsForAutoPublish([channel({ autoPublish: false })], 'post')).toEqual([])
    expect(channelsForAutoPublish([], 'post')).toEqual([])
  })

  it('treats a null filter as every kind', () => {
    for (const kind of ['post', 'research', 'signal'] as const) {
      expect(channelsForAutoPublish([channel()], kind)).toHaveLength(1)
    }
  })
})

describe('deliver', () => {
  it('refuses a disabled channel without contacting the platform', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    const result = await deliver(channel({ enabled: false }), message)
    expect(result.ok).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('sends through the publisher for the channel platform', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 204 }) as Response))
    expect((await deliver(channel(), message)).ok).toBe(true)
  })

  it('never throws, whatever the platform does', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('exploded')
      }),
    )
    const result = await deliver(channel(), message)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('exploded')
  })

  describe('channels that need a token', () => {
    beforeEach(() => {
      process.env.SOCIAL_SECRET_KEY = 'test-key-for-social-secrets'
    })

    it('decrypts the stored token and uses it', async () => {
      const spy = vi.fn(async (url: string) => {
        void url
        return { ok: true, status: 200 } as Response
      })
      vi.stubGlobal('fetch', spy)
      const result = await deliver(
        channel({ platform: 'telegram', target: '-1001234567890', secretEnc: encryptSecret('TOK') }),
        message,
      )
      expect(result.ok).toBe(true)
      expect(String(spy.mock.calls[0][0])).toContain('/botTOK/')
    })

    it('says the token is missing rather than calling the API without one', async () => {
      const spy = vi.fn()
      vi.stubGlobal('fetch', spy)
      const result = await deliver(
        channel({ platform: 'telegram', target: '-1001234567890', secretEnc: null }),
        message,
      )
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/no stored token/i)
      expect(spy).not.toHaveBeenCalled()
    })

    /** A rotated key must read as a diagnosable message, not a crash. */
    it('reports an undecryptable token and points at key rotation', async () => {
      const encrypted = encryptSecret('TOK')
      process.env.SOCIAL_SECRET_KEY = 'a-different-key'
      const spy = vi.fn()
      vi.stubGlobal('fetch', spy)
      const result = await deliver(
        channel({ platform: 'telegram', target: '-1001234567890', secretEnc: encrypted }),
        message,
      )
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/rotated/i)
      expect(spy).not.toHaveBeenCalled()
    })
  })
})

describe('broadcast', () => {
  it('attempts every channel and reports each outcome independently', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('bad')
          ? ({ ok: false, status: 500, text: async () => 'boom' } as Response)
          : ({ ok: true, status: 204 } as Response),
      ),
    )
    const outcomes = await broadcast(
      [
        channel({ id: 'good', target: 'https://hooks.example.com/good' }),
        channel({ id: 'bad', target: 'https://hooks.example.com/bad' }),
      ],
      message,
    )
    expect(outcomes).toHaveLength(2)
    expect(outcomes.find((o) => o.channelId === 'good')!.result.ok).toBe(true)
    // One failure does not take its siblings down.
    expect(outcomes.find((o) => o.channelId === 'bad')!.result.ok).toBe(false)
  })

  it('does nothing, successfully, with no channels', async () => {
    expect(await broadcast([], message)).toEqual([])
  })
})
