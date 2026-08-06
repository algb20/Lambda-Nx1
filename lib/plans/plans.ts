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
