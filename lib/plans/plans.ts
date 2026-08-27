/**
 * Plans & pricing — the SINGLE source of truth. To change a price or what a tier
 * unlocks, edit THIS file (or override the price via an env var, no code change):
 *   PRICE_PRO_PI / PRICE_PRO_USD  → Pro monthly price.
 * `GET /api/plans` serves this to the UI, so pricing updates in one place.
 *
 * Enforcement is OFF by default (ENFORCE_TIERS !== 'true'): tiers are defined and
 * checkable now, and switch on cleanly when subscriptions actually ship.
 */
export type PlanId = 'free' | 'pro'

export type Feature =
  | 'core_osint' // domain, identity, media, geo, research
  | 'threat'
  | 'markets'
  | 'finance'
  | 'ownership'
  | 'procurement'
  | 'ai_analyst'
  | 'monitoring'
  | 'calibration'
  | 'export'
  | 'globe'

export interface Plan {
  id: PlanId
  name: string
  /** Higher = more access; used to compare tiers. */
  rank: number
  price: { pi: number; usd: number; interval: 'month' }
  limits: { dailyInvestigations: number; monitors: number }
  features: Feature[]
}

function priceEnv(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v >= 0 ? v : fallback
}

const ALL_FEATURES: Feature[] = [
  'core_osint',
  'threat',
  'markets',
  'finance',
  'ownership',
  'procurement',
  'ai_analyst',
  'monitoring',
  'calibration',
  'export',
  'globe',
]

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    rank: 0,
    price: { pi: 0, usd: 0, interval: 'month' },
    limits: { dailyInvestigations: 20, monitors: 1 },
    features: ['core_osint', 'threat', 'markets', 'globe'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    rank: 1,
    price: { pi: priceEnv('PRICE_PRO_PI', 10), usd: priceEnv('PRICE_PRO_USD', 9), interval: 'month' },
    limits: { dailyInvestigations: 1000, monitors: 50 },
    features: ALL_FEATURES,
  },
}

export const PLAN_LIST: Plan[] = [PLANS.free, PLANS.pro]

/** Whether tier checks are actually enforced (off until subscriptions ship). */
export const TIERS_ENFORCED = process.env.ENFORCE_TIERS === 'true'

/**
 * Whether to *show* subscriptions at all. Hidden while the pricing is decided.
 *
 * Separate from `TIERS_ENFORCED`, and both halves of that separation matter.
 * Enforcement answers "does the free plan stop at twenty investigations";
 * this answers "does a visitor see a price at all". They were one thing for a
 * moment while this was written, and one thing is wrong: with enforcement off
 * and the panel still on screen, the product invited a payment for something
 * every visitor already had — which is the shape of a promise you cannot keep.
 *
 * Hidden, not deleted, and deliberately: the tiers, the prices, the Pi payment
 * flow and their tests all stay exactly where they are and stay tested, so
 * turning this back on is one variable rather than a rebuild. `docs/GATEWAYS.md`
 * still describes the intended model.
 *
 * `NEXT_PUBLIC_` because the decision is needed while rendering, on the client,
 * before any request — and because a build serves both surfaces, so it cannot
 * be answered by the server alone.
 */
export const SUBSCRIPTION_VISIBLE = process.env.NEXT_PUBLIC_SHOW_SUBSCRIPTION === 'true'

export function getPlan(id: string | null | undefined): Plan {
  return (id && PLANS[id as PlanId]) || PLANS.free
}

export function planHasFeature(planId: string | null | undefined, feature: Feature): boolean {
  return getPlan(planId).features.includes(feature)
}

export interface TierCheck {
  ok: boolean
  /** The lowest plan that unlocks the feature, when the current one doesn't. */
  upgradeTo?: PlanId
}

/** Does this plan unlock the feature? If not, which plan does. */
export function requireTier(planId: string | null | undefined, feature: Feature): TierCheck {
  if (planHasFeature(planId, feature)) return { ok: true }
  const upgrade = PLAN_LIST.find((p) => p.features.includes(feature))
  return { ok: false, upgradeTo: upgrade?.id }
}
