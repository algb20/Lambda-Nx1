/**
 * lib/payments — the app's only payments entry point. Selects the provider by
 * env (PAYMENT_PROVIDER, default 'pi'). A standard gateway (e.g. Stripe) is
 * registered here in phase P12 without changing checkout flows.
 */
import type { PaymentProvider } from './types'
import { piPaymentProvider } from './pi'
import { stripePaymentProvider } from './stripe'

export * from './types'

export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? 'pi'
  switch (name) {
    case 'pi':
      return piPaymentProvider
    case 'standard':
    case 'stripe':
      return stripePaymentProvider
    default:
      throw new Error(`PAYMENT_PROVIDER="${name}" is not configured. Available: pi, standard (Stripe).`)
  }
}
