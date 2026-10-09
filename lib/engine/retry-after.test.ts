import { afterEach, describe, expect, it, vi } from 'vitest'
import { Guardrail, MAX_RETRY_AFTER_MS, ProviderCooldownError, retryAfterMs } from './guardrail'

/**
 * Charter §3: respect rate limits. A provider that answers 429 or 503 with
 * `Retry-After` has told us when we may return (NEW-05, batch 24). GDELT,
 * OpenAlex and NASA all sent one in batches 05 and 19.
 */
describe('Retry-After is the provider\'s instruction, and it is followed', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads delay-seconds and HTTP-dates, and ignores what it cannot read', () => {
    const now = Date.parse('2026-10-09T12:00:00Z')
    expect(retryAfterMs('120', now)).toBe(120_000)
    expect(retryAfterMs('Fri, 09 Oct 2026 12:05:00 GMT', now)).toBe(300_000)
    expect(retryAfterMs('Fri, 09 Oct 2026 11:00:00 GMT', now)).toBe(0)
    expect(retryAfterMs('soon', now)).toBeNull()
    expect(retryAfterMs(null, now)).toBeNull()
    expect(retryAfterMs('9999999', now)).toBe(MAX_RETRY_AFTER_MS)
  })

  it('does not call the host again before the time it named — for any source on that host', async () => {
    const g = new Guardrail()
    g.allowHosts(['api.busy.test'])
    const fetchMock = vi.fn().mockResolvedValue(new Response('slow down', { status: 429, headers: { 'retry-after': '60' } }))
    vi.stubGlobal('fetch', fetchMock)

    const first = await g.createFetch('a')('https://api.busy.test/x')
    expect(first.status).toBe(429)
    await expect(g.createFetch('a')('https://api.busy.test/x')).rejects.toBeInstanceOf(ProviderCooldownError)
    await expect(g.createFetch('b')('https://api.busy.test/y')).rejects.toThrow(/asked us to wait until .*Retry-After/)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('calls again once the time has passed', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(Date.parse('2026-10-09T12:00:00Z'))
      const g = new Guardrail()
      g.allowHosts(['api.busy.test'])
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response('', { status: 503, headers: { 'retry-after': '30' } }))
        .mockResolvedValue(new Response('ok'))
      vi.stubGlobal('fetch', fetchMock)
      await g.createFetch('a')('https://api.busy.test/x')
      vi.setSystemTime(Date.parse('2026-10-09T12:00:31Z'))
      const res = await g.createFetch('a')('https://api.busy.test/x')
      expect(await res.text()).toBe('ok')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('adds no wait of its own: a 429 without Retry-After, or another status, changes nothing', async () => {
    const g = new Guardrail()
    g.allowHosts(['api.busy.test'])
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 403, headers: { 'retry-after': '60' } }))
      .mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)
    await g.createFetch('a')('https://api.busy.test/x')
    await g.createFetch('a')('https://api.busy.test/x')
    await g.createFetch('a')('https://api.busy.test/x')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
