import type { PaymentProvider, PaymentResult } from './types'

/**
 * Standard (Stripe) payments — the off-Pi gateway, behind the same PaymentProvider
 * port so checkout flows never change (charter rule #4). Uses raw HTTPS to the
 * Stripe API (no extra SDK), authenticated with the secret STRIPE_SECRET_KEY
 * (never exposed to the client). PaymentIntent ids (pi_…) are the "paymentId".
 *
 * Mapping onto the Pi-style port:
 *   approve   → retrieve the PaymentIntent (status/next action)
 *   complete  → capture the PaymentIntent
 *   cancel    → cancel the PaymentIntent
 */
const STRIPE_API = process.env.STRIPE_API_BASE ?? 'https://api.stripe.com/v1'

async function stripeCall(method: 'GET' | 'POST', path: string): Promise<PaymentResult> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}` },
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

export const stripePaymentProvider: PaymentProvider = {
  name: 'standard',
  approve: (paymentId) => stripeCall('GET', `/payment_intents/${encodeURIComponent(paymentId)}`),
  complete: (paymentId) => stripeCall('POST', `/payment_intents/${encodeURIComponent(paymentId)}/capture`),
  cancel: (paymentId) => stripeCall('POST', `/payment_intents/${encodeURIComponent(paymentId)}/cancel`),
}
