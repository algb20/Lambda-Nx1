/**
 * Checkout — the pure half of buying a plan.
 *
 * Money is the one place where "it looked like it worked" is unacceptable, so
 * the rules that decide what a payment is *for* and whether it earns anything
 * live here: no network, no React, no Pi SDK, fully testable.
 *
 * The Pi payment flow is three server-verified steps, and the order matters:
 *   1. the client asks Pi to create a payment (amount + memo + metadata)
 *   2. Pi calls back "ready for server approval" → our server approves it
 *   3. Pi calls back "ready for server completion" with a txid → our server
 *      completes it, and only then is the plan granted
 *
 * The grant hangs off step 3 alone. Approving a payment says "we recognise this
 * charge", not "we have been paid" — granting on approval would hand out Pro to
 * anyone who starts a checkout and abandons it.
 */
import { PLANS, type Plan, type PlanId } from '../plans/plans'

export interface CheckoutIntent {
  plan: PlanId
  /** Amount in π, taken from the plans table — never from the client. */
  amount: number
  memo: string
  metadata: { kind: 'subscription'; plan: PlanId; interval: 'month' }
}

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CheckoutError'
  }
}

/** Plans a user can actually buy: priced above zero and not already the floor. */
export function purchasablePlans(): Plan[] {
  return Object.values(PLANS).filter((p) => p.price.pi > 0)
}

/**
 * Build the payment a plan requires.
 *
 * The amount comes from our own plans table, never from the caller — a client
 * that could name its own price could buy Pro for 0π.
 */
export function buildCheckoutIntent(planId: string): CheckoutIntent {
  const plan = PLANS[planId as PlanId]
  if (!plan) throw new CheckoutError(`Unknown plan "${planId}"`)
  if (plan.price.pi <= 0) {
    throw new CheckoutError(`"${plan.name}" is free — there is nothing to pay for`)
  }
  return {
    plan: plan.id,
    amount: plan.price.pi,
    memo: `Lambda NX ${plan.name} — 1 month`,
    metadata: { kind: 'subscription', plan: plan.id, interval: 'month' },
  }
}

/** What the server should do once a payment step reports success. */
export interface GrantDecision {
  grant: boolean
  plan: PlanId | null
  reason: string
}

/**
 * Decide whether a completed payment earns a plan.
 *
 * Deliberately strict: an unrecognised plan in the metadata grants nothing
 * rather than defaulting to something. Metadata arrives from the client, so it
 * is a request, not an instruction — the price was already fixed server-side by
 * `buildCheckoutIntent`, and this only reads which plan was asked for.
 */
export function decideGrant(input: {
  action: string
  ok: boolean
  metadata?: unknown
}): GrantDecision {
  if (input.action !== 'complete') {
    return { grant: false, plan: null, reason: 'only a completed payment grants a plan' }
  }
  if (!input.ok) {
    return { grant: false, plan: null, reason: 'payment did not complete' }
  }
  const meta = input.metadata as { plan?: unknown } | undefined
  const planId = typeof meta?.plan === 'string' ? meta.plan : null
  if (!planId || !(planId in PLANS)) {
    return { grant: false, plan: null, reason: 'payment carried no recognisable plan' }
  }
  const plan = PLANS[planId as PlanId]
  if (plan.price.pi <= 0) {
    return { grant: false, plan: null, reason: 'free plans are not granted by payment' }
  }
  return { grant: true, plan: plan.id, reason: `completed payment for ${plan.name}` }
}
