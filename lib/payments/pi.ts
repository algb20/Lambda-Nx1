import type { PaymentProvider, PaymentResult } from './types'

/**
 * Pi Network payments (server-side). Mirrors the server approve/complete/cancel
 * flow, authenticated with the secret PI_API_KEY (never exposed to the client).
 */
const PI_API_BASE = process.env.PI_API_BASE ?? 'https://api.minepi.com'

async function piCall(subpath: string, body?: object): Promise<PaymentResult> {
  const apiKey = process.env.PI_API_KEY
  if (!apiKey) throw new Error('PI_API_KEY is not set')
  const res = await fetch(`${PI_API_BASE}/v2/payments/${subpath}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

export const piPaymentProvider: PaymentProvider = {
  name: 'pi',
  approve: (paymentId) => piCall(`${encodeURIComponent(paymentId)}/approve`),
  complete: (paymentId, txid) => piCall(`${encodeURIComponent(paymentId)}/complete`, { txid }),
  cancel: (paymentId) => piCall(`${encodeURIComponent(paymentId)}/cancel`),
}
