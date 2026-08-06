import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { stripePaymentProvider } from './stripe'

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123'
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.STRIPE_SECRET_KEY
})

describe('stripePaymentProvider', () => {
  it('maps approve/complete/cancel onto the PaymentIntent API with auth', async () => {
    const calls: Array<{ url: string; method: string; auth: string | null }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push({
          url,
          method: init?.method ?? 'GET',
          auth: (init?.headers as Record<string, string> | undefined)?.Authorization ?? null,
        })
        return Promise.resolve(res({ id: 'pi_1', status: 'succeeded' }))
      }),
    )

    expect(stripePaymentProvider.name).toBe('standard')
    const a = await stripePaymentProvider.approve('pi_1')
    expect(a.ok).toBe(true)
    await stripePaymentProvider.complete('pi_1', 'ignored-txid')
    await stripePaymentProvider.cancel('pi_1')

    expect(calls[0]).toMatchObject({ method: 'GET', auth: 'Bearer sk_test_123' })
    expect(calls[0].url).toMatch(/\/payment_intents\/pi_1$/)
    expect(calls[1].url).toMatch(/\/payment_intents\/pi_1\/capture$/)
    expect(calls[1].method).toBe('POST')
    expect(calls[2].url).toMatch(/\/payment_intents\/pi_1\/cancel$/)
  })

  it('throws a clear error when the key is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY
    await expect(stripePaymentProvider.cancel('pi_1')).rejects.toThrow(/STRIPE_SECRET_KEY/)
  })
})
