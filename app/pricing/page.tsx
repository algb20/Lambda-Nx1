import Link from 'next/link'
import type { Metadata } from 'next'
import { PLAN_LIST, TIERS_ENFORCED, type Feature, type Plan } from '@/lib/plans/plans'
import { RATE_LIMIT } from '@/lib/api-catalog'
import { CATALOG, activeSources } from '@/lib/engine/catalog'

/**
 * Pricing.
 *
 * ## Why every number here is computed
 *
 * Not one figure on this page is typed into it. The prices, the limits and what
 * each tier unlocks come from `lib/plans/plans.ts` — the same definition the
 * app enforces — and the source counts come from the catalogue itself. A
 * pricing page that states a number the product does not honour is the most
 * expensive kind of documentation error there is, and the only reliable defence
 * is to make the page incapable of holding its own copy.
 *
 * ## Why it says tiers are not enforced yet
 *
 * Because they are not: `ENFORCE_TIERS` is off, so everything currently works
 * on the free tier. Publishing a price list while quietly giving everything
 * away would be harmless; publishing one that implies a paywall which does not
 * exist would not be. The banner says which state we are in and disappears on
 * its own when enforcement is switched on.
 */
export const metadata: Metadata = {
  title: 'Pricing — Lambda NX',
  description:
    'What each Lambda NX tier unlocks, what it costs in Pi or in dollars, and what stays free.',
  alternates: { canonical: '/pricing' },
}

/**
 * What a feature means to someone deciding whether to pay.
 *
 * The `Feature` ids are engineering vocabulary; nobody buys `core_osint`. This
 * table is the only place the two are joined, so a new feature that nobody has
 * described will show as its raw id rather than silently vanishing from the
 * comparison — visible is better than absent.
 */
const FEATURE_LABEL: Record<Feature, string> = {
  core_osint: 'Core OSINT — domain, email, username, media, geospatial, research',
  threat: 'Threat intelligence — indicators, advisories, exploited vulnerabilities',
  markets: 'Markets & economy — instruments, indices, macro series',
  globe: 'The live world board and globe',
  finance: 'Finance, sanctions & corporate registries',
  ownership: 'Ownership & beneficial-control networks',
  procurement: 'Public contracts & tenders',
  ai_analyst: 'AI analyst — triage and written summaries',
  monitoring: 'Monitors & alerting with signed webhooks',
  calibration: 'Calibration ledger — our forecasts scored against outcomes',
  export: 'Export — PDF, CSV, JSON, citations, shareable permalinks',
}

const ALL: Feature[] = Object.keys(FEATURE_LABEL) as Feature[]

function Price({ plan }: { plan: Plan }) {
  if (plan.price.usd === 0 && plan.price.pi === 0) {
    return <p className="text-3xl font-bold">Free</p>
  }
  return (
    <p className="space-x-2">
      <span className="text-3xl font-bold">{plan.price.pi} π</span>
      <span className="text-sm text-muted-foreground">
        or ${plan.price.usd} / {plan.price.interval}
      </span>
    </p>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  const included = new Set(plan.features)
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{plan.name}</h2>
        <Price plan={plan} />
      </div>

      <ul className="space-y-1 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">{plan.limits.dailyInvestigations}</strong>{' '}
          investigations a day
        </li>
        <li>
          <strong className="text-foreground">{plan.limits.monitors}</strong>{' '}
          {plan.limits.monitors === 1 ? 'monitor' : 'monitors'}
        </li>
      </ul>

      <ul className="space-y-1.5 border-t pt-4 text-sm">
        {ALL.map((feature) => (
          <li
            key={feature}
            className={included.has(feature) ? '' : 'text-muted-foreground/50 line-through'}
          >
            <span aria-hidden className="mr-2">
              {included.has(feature) ? '✓' : '·'}
            </span>
            {FEATURE_LABEL[feature] ?? feature}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PricingPage() {
  // Counted the way §2a of the charter requires, and labelled as what it is.
  const integrations = CATALOG.length
  const active = activeSources().length

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Pricing</h1>
        <p className="text-sm text-muted-foreground">
          Every gateway works without an account. A paid tier raises the limits and unlocks the
          specialist families, the analyst layer and monitoring.
        </p>
      </header>

      {!TIERS_ENFORCED && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Tiers are defined but not yet enforced.</strong>{' '}
          Everything on this page is currently available on the free tier. This notice disappears
          when subscriptions ship — it is rendered from the same switch that turns enforcement on,
          so it cannot be left behind by accident.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {PLAN_LIST.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What both tiers include</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">Every finding is auditable.</strong> Source link,
            retrieval time, the publication time the source stated, an Admiralty rating and a
            confidence grade — on every item, on both tiers. This is not a paid feature and will not
            become one.
          </li>
          <li>
            <strong className="text-foreground">Corroboration counted by origin.</strong> Twenty
            outlets carrying one wire is one confirmation, and the product says so rather than
            showing you twenty.
          </li>
          <li>
            <strong className="text-foreground">Passive only.</strong> The engine never sends a
            packet to a subject of an investigation. No scanning, no probing — enforced in code, not
            promised in marketing.
          </li>
          <li>
            <strong className="text-foreground">
              {integrations} integrations, {active} active right now.
            </strong>{' '}
            Counted honestly: these are providers we call and parse, not the far larger number of
            publishers reachable through them. A platform advertising “a million sources” is quoting
            the second number.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">The API</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The read endpoints are open and need no key, at {RATE_LIMIT.requests} requests per{' '}
          {RATE_LIMIT.windowSeconds} seconds. See the{' '}
          <Link href="/docs/api" className="underline">
            API reference
          </Link>
          .
        </p>
      </section>

      <footer className="border-t pt-6 text-sm text-muted-foreground">
        <Link href="/" className="underline">
          Back to Lambda
        </Link>
        <span className="px-2">·</span>
        <Link href="/terms" className="underline">
          Terms
        </Link>
        <span className="px-2">·</span>
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
      </footer>
    </main>
  )
}
