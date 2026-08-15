import { PLAN_LIST, TIERS_ENFORCED, type Plan } from '@/lib/plans/plans'
import { RATE_LIMIT } from '@/lib/api-catalog'

/**
 * `/pricing.md` — the plans, as markdown and as JSON, for machines.
 *
 * The strongest platform in the field publishes exactly this, ending in a JSON
 * block an agent can parse without reading prose. Six of the seven best-known
 * names publish no price at all: their pricing page is a *Request a Demo* form.
 *
 * That split is the opening. Every capability comparison in
 * `docs/COMPETITORS.md` has us behind; pricing transparency is somewhere we can
 * be ahead today, at the cost of one route, and where most of the field has
 * structurally chosen not to compete.
 *
 * Generated from `lib/plans/plans.ts` — the same definition the app enforces —
 * so this file cannot state a price the product does not honour. That is not a
 * theoretical risk: a stale pricing document is the most expensive kind of
 * documentation error there is.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function priceOf(plan: Plan): string {
  if (plan.price.usd === 0 && plan.price.pi === 0) return '$0/month'
  return `${plan.price.pi} PI or $${plan.price.usd}/${plan.price.interval}`
}

function section(plan: Plan): string {
  return [
    `## ${plan.name}`,
    ``,
    `- Price: ${priceOf(plan)}`,
    `- Signup required: ${plan.id === 'free' ? 'No' : 'Yes'}`,
    `- Daily investigations: ${plan.limits.dailyInvestigations}`,
    `- Monitors: ${plan.limits.monitors}`,
    `- Includes: ${plan.features.join(', ')}`,
  ].join('\n')
}

export async function GET(): Promise<Response> {
  const json = {
    product: 'Lambda NX',
    lifecycle: TIERS_ENFORCED ? 'launched' : 'tiers-defined-not-enforced',
    url: 'https://lambdanx.app/',
    pricing_url: 'https://lambdanx.app/pricing',
    api_docs_url: 'https://lambdanx.app/docs/api',
    currency: 'USD',
    also_accepts: 'PI',
    api: {
      key_required: false,
      account_required: false,
      requests: RATE_LIMIT.requests,
      window_seconds: RATE_LIMIT.windowSeconds,
      overage: 'rejected with 429, never silently charged',
    },
    plans: PLAN_LIST.map((p) => ({
      name: p.name,
      price_usd_monthly: p.price.usd,
      price_pi_monthly: p.price.pi,
      signup_required: p.id !== 'free',
      limits: {
        daily_investigations: p.limits.dailyInvestigations,
        monitors: p.limits.monitors,
      },
      features: p.features,
    })),
  }

  const body = `# Pricing — Lambda NX

<!-- Generated from lib/plans/plans.ts, the definition the app enforces. -->

Lambda NX has a free public product and paid tiers. **Every intelligence gateway
works without an account**, and the API needs no key.

Live plan data as JSON is at the end of this file. There is no sales call and no
demo form — the prices are the prices.

${TIERS_ENFORCED ? '' : `## Status

**Tiers are defined but not yet enforced.** Everything below currently runs on
the free tier. This notice is rendered from the same switch that turns
enforcement on, so it cannot be left behind by accident.

`}## What is free

Every gateway, every source, no account, no key. The API is open at
${RATE_LIMIT.requests} requests per ${RATE_LIMIT.windowSeconds} seconds.

Every finding — free or paid — carries its source link, the publication time the
source stated, the time we retrieved it, an Admiralty rating and a confidence
grade. That is not a paid feature and will not become one.

${PLAN_LIST.map(section).join('\n\n')}

## Limits and overage

- Rate limits are **hard limits**. Exceeding one returns \`429\` with
  \`retryAfterSeconds\`, and every response carries
  ${RATE_LIMIT.headers.join(', ')}.
- Usage above a quota is **rejected — never silently charged**. If opt-in
  metered overage is ever introduced, it will be documented here first.
- The limit exists because each gateway call fans out to public providers who
  rate-limit *us*, not the caller. One looping client would take the platform
  down for everyone.

## How sources are counted

Any figure published about coverage says which of three things it is:
**integrations** (providers we call and parse), **publishers** (outlets
reachable through them), **independent origins** (how many are genuinely not
copies of one another). Only the third enters a confidence score. A platform
advertising "a million sources" is quoting the second.

## Machine-Readable Summary

\`\`\`json
${JSON.stringify(json, null, 2)}
\`\`\`
`

  return new Response(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
