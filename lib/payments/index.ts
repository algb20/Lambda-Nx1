/**
 * lib/payments — the app's only payments entry point.
 *
 * Two ways to reach a provider, and the difference matters:
 *
 *  - `providerFor(rail)` — the rail is already known, because the caller worked
 *    out where the payer is. This is what request handlers use, via
 *    `railForRequest()` in `./rail`.
 *  - `getPaymentProvider()` — the deployment-wide default from
 *    `PAYMENT_PROVIDER`. Correct for background work that has no payer in front
 *    of it, and wrong for anything serving a request: it can only ever name one
 *    rail, so a build configured for π cannot take a card from the website and a
 *    build configured for cards cannot take π inside Pi Browser.
 *
 * Either way, app code depends on the `PaymentProvider` port and never on Pi or
 * Stripe directly (charter rule #4).
 */
import type { PaymentProvider, PaymentProviderName } from './types'
import { piPaymentProvider } from './pi'
import { stripePaymentProvider } from './stripe'

export * from './types'
export { railForRequest, railForSurface, surfaceOfRequest } from './rail'

/** The provider that runs a named rail. */
export function providerFor(rail: PaymentProviderName): PaymentProvider {
  return rail === 'pi' ? piPaymentProvider : stripePaymentProvider
}

/**
 * The deployment-wide default rail.
 *
 * Kept for callers with no request to read — never use it to serve one, because
 * the payer's surface is the thing that decides, and this cannot see it.
 */
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
