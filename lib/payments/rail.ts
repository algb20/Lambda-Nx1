/**
 * Which payment rail a request should use, decided where the payer actually is.
 *
 * ## The bug this exists to close
 *
 * `getPaymentProvider()` reads `PAYMENT_PROVIDER` — an environment variable
 * fixed at deploy time. That means **one deployment can only ever take one kind
 * of payment**: set it to `pi` and a visitor on the public website cannot buy
 * anything; set it to `standard` and a pioneer inside Pi Browser cannot pay with
 * π, which is the entire point of shipping a Pi app.
 *
 * That is the same mistake `lib/auth/environment.ts` already fixed for sign-in,
 * left unfixed one layer down. The charter's rule is one build that is a Pi app
 * *and* a public website, so the rail is a runtime decision about the payer, not
 * a build-time decision about the deployment.
 *
 * ## The rule
 *
 *  - **Inside Pi Browser → π.** The Pi SDK is present, the pioneer's wallet is
 *    there, and Pi is the currency the app is priced in.
 *  - **Anywhere else → the standard gateway.** Pi payments cannot complete
 *    outside Pi Browser: the SDK never settles, so offering that rail produces a
 *    checkout that hangs rather than one that fails.
 *  - **An explicit `PAYMENT_PROVIDER` still wins**, because an operator running
 *    a deliberately single-purpose instance should be able to say so — and
 *    because it is how every existing deployment is configured today, so this
 *    change cannot alter their behaviour.
 *
 * ## This is routing, not authorisation
 *
 * Worth stating plainly, because it looks like a security decision and is not.
 * The surface is read from the user agent, which anyone can set. A forged one
 * gets the payer *the other rail's API*, and that rail then rejects them: a Pi
 * payment id means nothing to Stripe and a PaymentIntent means nothing to Pi.
 * Nothing is granted until the real provider confirms a real charge against its
 * own API, which is where the actual verification lives. Choosing the wrong door
 * only wastes the payer's time.
 */
import { detectSurface, type Surface } from '../auth/environment'
import type { PaymentProviderName } from './types'

/**
 * The rail for a surface.
 *
 * Deliberately total rather than defaulting: adding a third surface later
 * should be a type error here, not a silent fall-through to Stripe.
 */
export function railForSurface(surface: Surface): PaymentProviderName {
  return surface === 'pi-browser' ? 'pi' : 'standard'
}

/**
 * The surface a server request came from.
 *
 * The user agent is the only signal a server has — `window.Pi` exists in the
 * browser and never reaches us. That is enough: Pi Browser identifies itself,
 * and the consequence of getting it wrong is a rejected checkout rather than an
 * unearned grant.
 */
export function surfaceOfRequest(headers: Headers): Surface {
  return detectSurface({ userAgent: headers.get('user-agent') ?? '', hasPiBridge: false })
}

/**
 * The rail this request should use, honouring an operator's explicit choice.
 *
 * An unrecognised `PAYMENT_PROVIDER` is ignored rather than obeyed: a typo in a
 * deploy variable should not take payments offline for everyone, and the
 * surface-derived answer is always a working one.
 */
export function railForRequest(headers: Headers): PaymentProviderName {
  const configured = process.env.PAYMENT_PROVIDER
  if (configured === 'pi') return 'pi'
  if (configured === 'standard' || configured === 'stripe') return 'standard'
  return railForSurface(surfaceOfRequest(headers))
}
