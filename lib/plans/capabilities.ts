import type { Feature, PlanId } from './plans'

/**
 * Every capability this product can sell, and exactly where each one is gated.
 *
 * ## Why this file exists
 *
 * `lib/plans/plans.ts` declares eleven features and assigns them to tiers. A
 * search of the codebase for the check that enforces them returns **one call
 * site** — `ai_analyst`, in the analyst route. The other ten are declared and
 * unenforced. Flipping `ENFORCE_TIERS` today would change almost nothing, which
 * means the tier system is a description of an intention rather than a
 * mechanism, and nobody could tell from reading `plans.ts`.
 *
 * That is the gap this registry closes. Every capability names the routes that
 * enforce it, and `capabilities.test.ts` asserts those routes exist. A
 * capability claiming to be gated at a route that does not exist fails the
 * build; a capability marked `live` with no enforcement point fails the build.
 * So "ready to switch on" becomes a checkable claim instead of a hope.
 *
 * ## What `status` means, and why the honest value is usually not `live`
 *
 * - `live` — built, and the tier check is wired at every listed route.
 * - `built-not-gated` — the capability works and anyone can use it. The check
 *   is not written yet. **This is the honest state of most of this product**,
 *   and saying so is the point: a product that quietly ships everything free
 *   while its pricing page implies otherwise has a trust problem, not a
 *   billing problem.
 * - `planned` — not built. Carries no enforcement point and must not appear on
 *   a pricing page.
 *
 * ## Why tiers are argued rather than assigned
 *
 * Each entry carries a `fieldNote`: what the strongest platform in this field
 * charges for the same thing, read from their own published documents
 * (`docs/MONETIZATION-FIELD.md`). The single clearest lesson from that
 * research is that the market leader **gates no data at all** — all 56 map
 * layers, 500+ feeds, country briefs, chokepoints and instability scores are
 * free without an account — and sells the *decision layer*: analyst chat,
 * scenario work, digests, export and programmatic access.
 *
 * Our current assignment does the opposite: it gates whole gateways (threat,
 * finance, ownership, procurement) behind Pro. That makes the free product look
 * thin while giving the expensive part away, and it contradicts charter §1,
 * which says the gateways are usable without an account. The `minPlan` values
 * here are written the way the evidence argues for, and the discrepancies with
 * `plans.ts` are listed at the bottom of this file rather than silently
 * resolved — changing what we charge for is the owner's decision, not a
 * refactor.
 */

export type CapabilityStatus = 'live' | 'built-not-gated' | 'planned'

export type CapabilityFamily =
  | 'gateways'
  | 'analysis'
  | 'delivery'
  | 'programmatic'
  | 'workspace'

export interface Capability {
  id: Feature
  name: string
  /** What a buyer gets, in the words they would use. */
  description: string
  family: CapabilityFamily
  /** The lowest plan that should unlock it, argued by `fieldNote`. */
  minPlan: PlanId
  status: CapabilityStatus
  /**
   * Route directories under `app/` whose handlers must check this capability.
   * Asserted against the filesystem, so a stale path fails the build.
   */
  enforcedAt: string[]
  /** What the field charges for the same thing, and where that was read. */
  fieldNote: string
}

export const CAPABILITIES: Capability[] = [
  // ── Gateways: the data itself ──────────────────────────────────────────────
  {
    id: 'core_osint',
    name: 'Core OSINT gateways',
    description:
      'Domain and infrastructure, email and username footprint, media verification, geospatial, scholarly research and open-data federation.',
    family: 'gateways',
    minPlan: 'free',
    status: 'built-not-gated',
    enforcedAt: [],
    fieldNote:
      'Free everywhere. The market leader gates no data at all, and charter §1 requires the gateways to work without an account.',
  },
  {
    id: 'threat',
    name: 'Threat intelligence gateway',
    description:
      'Indicators, national CERT advisories, exploited-vulnerability catalogues and exposure signals.',
    family: 'gateways',
    minPlan: 'free',
    status: 'built-not-gated',
    enforcedAt: [],
    fieldNote:
      'Currently Pro in plans.ts. The field gives the equivalent away — CISA KEV and national CERT feeds are public data we merely aggregate, and charging for a public advisory is a weak position.',
  },
  {
    id: 'markets',
    name: 'Markets & economy gateway',
    description: 'Instruments, indices, commodities and macroeconomic series.',
    family: 'gateways',
    minPlan: 'free',
    status: 'built-not-gated',
    enforcedAt: [],
    fieldNote: 'Free on the leading platform, including commodities and energy inventories.',
  },
  {
    id: 'globe',
    name: 'The live world board',
    description:
      'Every measured hazard and reported event, graded, deduplicated and fused, with the coverage layer that says where we are blind.',
    family: 'gateways',
    minPlan: 'free',
    status: 'built-not-gated',
    enforcedAt: [],
    fieldNote:
      'All 56 of their map layers are free except one (Resilience). Ours should follow.',
  },
  {
    id: 'finance',
    name: 'Finance, sanctions & corporate',
    description:
      'Sanctions designations, corporate registries and legal-entity identifiers.',
    family: 'gateways',
    minPlan: 'free',
    status: 'built-not-gated',
    enforcedAt: [],
    fieldNote:
      'Their sanctions data is a free tool. OFAC SDN is a public list; gating it is not defensible.',
  },
  {
    id: 'ownership',
    name: 'Ownership & control networks',
    description: 'Beneficial ownership and control graphs from public registries.',
    family: 'gateways',
    minPlan: 'free',
    status: 'built-not-gated',
    enforcedAt: [],
    fieldNote: 'Public registry data. Same argument as sanctions.',
  },
  {
    id: 'procurement',
    name: 'Public contracts & tenders',
    description: 'Tenders and awards from open contracting registries.',
    family: 'gateways',
    minPlan: 'free',
    status: 'built-not-gated',
    enforcedAt: [],
    fieldNote:
      'They route procurement search through a Pro tool. This is the one gateway where a paid tier is arguable, because the value is the search rather than the data.',
  },

  // ── Analysis: the decision layer, which is what the field actually sells ───
  {
    id: 'ai_analyst',
    name: 'AI analyst',
    description:
      'Triage and written analysis over a live investigation, with citations back to the findings that support each statement.',
    family: 'analysis',
    minPlan: 'pro',
    status: 'live',
    enforcedAt: ['api/analyst'],
    fieldNote:
      'Their WM Analyst is the headline Pro feature at $39.99/mo, limited to 500 requests/day. This is the single clearest paid capability in the field.',
  },
  {
    id: 'calibration',
    name: 'Calibration ledger',
    description:
      'Our own assessments scored against what actually happened, with Brier and log scores and a domain breakdown.',
    family: 'analysis',
    minPlan: 'pro',
    status: 'built-not-gated',
    enforcedAt: [],
    fieldNote:
      'They ship a forecast scorecard with calibration and Brier scores under Pro. Being scored in public is rare and worth charging for.',
  },

  // ── Delivery: getting the answer out ──────────────────────────────────────
  {
    id: 'monitoring',
    name: 'Monitors & alerting',
    description:
      'Standing rules over live signals, delivered by signed webhook so the receiver can verify the sender.',
    family: 'delivery',
    minPlan: 'pro',
    status: 'built-not-gated',
    enforcedAt: [],
    fieldNote:
      'Their digest — Slack, Discord, Telegram, email, webhook — is Pro, with delivery cadence as a tier lever. Watchlists themselves are free.',
  },
  {
    id: 'export',
    name: 'Export & citations',
    description:
      'PDF, CSV and JSON export with formatted citations, and a shareable permalink for any investigation.',
    family: 'delivery',
    minPlan: 'pro',
    status: 'built-not-gated',
    enforcedAt: [],
    fieldNote:
      'Export is the *only* capability separating their $39.99 tier from their $49.99 tier. The field prices export as a commercial-use signal, not a feature.',
  },
]

/**
 * Capabilities the field sells that we have not built.
 *
 * Kept separate from `CAPABILITIES` on purpose: an unbuilt capability has no
 * `Feature` id, cannot be enforced, and must never reach a pricing page. Listing
 * them here rather than in the registry is what stops a roadmap from quietly
 * becoming a price list.
 */
export interface PlannedCapability {
  name: string
  description: string
  family: CapabilityFamily
  suggestedPlan: PlanId
  fieldNote: string
}

export const PLANNED: PlannedCapability[] = [
  {
    name: 'Programmatic access with a key',
    description:
      'An issued key, per-key quotas, usage visibility and webhook delivery, so the API can be used in someone else’s system.',
    family: 'programmatic',
    suggestedPlan: 'pro',
    fieldNote:
      'Their API Starter is $99.99/mo for 1,000 requests/day. Ours is currently open, unlimited and free forever, which is generous and unpriced.',
  },
  {
    name: 'Commercial licence',
    description:
      'The right to use output for employer, client or customer-facing work, stated in one sentence per tier.',
    family: 'workspace',
    suggestedPlan: 'pro',
    fieldNote:
      'Their whole ladder separates by permission — own research, client work, private systems, embed in your product, redistribute. We sell no permission at all, so a consultant has nothing to buy.',
  },
  {
    name: 'Reference geodata layers',
    description:
      'Submarine cables, pipelines, military and nuclear sites, chokepoints and spaceports as static context beneath the events.',
    family: 'gateways',
    suggestedPlan: 'free',
    fieldNote:
      'Roughly half their map layers, and free. Our board has no permanent world beneath it — everything we draw is an event.',
  },
  {
    name: 'Custom dashboards',
    description: 'Saved arrangements of panels and layers per user.',
    family: 'workspace',
    suggestedPlan: 'pro',
    fieldNote:
      'A pure tier lever for them: 3 tabs free, 10 on Pro, 25 on Pro Business. Costs little to build and scales cleanly with price.',
  },
  {
    name: 'Team workspaces with SSO and roles',
    description: 'Shared investigations, SSO/MFA, role-based access, audit trail.',
    family: 'workspace',
    suggestedPlan: 'pro',
    fieldNote: 'Enterprise-only across the entire field, and the gate to institutional buyers.',
  },
  {
    name: 'Scenario and cascade analysis',
    description:
      'What fails downstream when a cable, chokepoint or pipeline is cut, traced through the links between them.',
    family: 'analysis',
    suggestedPlan: 'pro',
    fieldNote:
      'Their cascade panel traces 1,453 links; the simulation is an MCP tool under Pro. Directly buildable on our fusion layer.',
  },
]

/** Every capability that is genuinely enforced right now. */
export function enforcedCapabilities(): Capability[] {
  return CAPABILITIES.filter((c) => c.status === 'live' && c.enforcedAt.length > 0)
}

/**
 * Capabilities that a paid plan claims to unlock but nothing actually checks.
 *
 * This is the number that says whether "switch on tiers" is one flag or a
 * project. It is reported by the diagnostics route for the same reason
 * `/api/diagnose` exists at all: the platform states its own defects.
 */
export function unenforcedPaidCapabilities(): Capability[] {
  return CAPABILITIES.filter((c) => c.minPlan !== 'free' && c.enforcedAt.length === 0)
}
