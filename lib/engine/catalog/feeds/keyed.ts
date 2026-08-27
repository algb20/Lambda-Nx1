import type { CatalogSource } from '../types'
import { ccBy, needsAgreement, nonCommercial, PUBLIC_DOMAIN } from '../licence'

/**
 * The routes that exist, work, and need a credential we do not have.
 *
 * ## Why these are records and not a paragraph in a document
 *
 * `docs/GATEWAY-MAP.md` §4 states the rule this file implements: *"'Keyed' is
 * recorded, not hidden. They belong in the catalogue as keyed and inactive, so
 * the gap is visible and the fix is one environment variable — rather than
 * quietly absent, which is how a platform ends up not knowing what it lacks."*
 *
 * Until now the rule was written down and half-applied. Seven keyed records
 * existed; eight more routes were named only in prose, which means the running
 * platform could not report them. `coverage()` counts what is in the
 * catalogue — so a gap that lives in a Markdown file is a gap the product is
 * blind to, and the whole argument of this project is that a platform should
 * know what it does not know.
 *
 * Every entry below was **probed** on 2026-08-22 and its `note` records what
 * the endpoint actually answered. None of them is a guess at a URL that might
 * work.
 *
 * ## What these records do and do not do
 *
 * They never run. `activeSources()` requires `keyless || process.env[keyEnv]`,
 * so each stays out of every sweep until someone sets the variable — at which
 * point it joins with no further code change. That is the entire point: the
 * remedy is an environment variable, and the record is what makes the remedy
 * findable.
 *
 * ## One route that is deliberately *not* here
 *
 * Raw AIS — live ship positions — is the maritime gateway's stated gap, and
 * AISstream is the obvious candidate. It is absent because its only channel is
 * `wss://`, and every record in this catalogue is a promise that the adapter
 * can fetch the URL over HTTPS. `catalog.test.ts` enforces that, correctly, and
 * it caught the entry when it was written. Bending an invariant to make a gap
 * visible trades one kind of honesty for another; the gap is stated in
 * GATEWAY-MAP §3.1, and adopting AIS needs a streaming adapter before it needs
 * a key. Global Fishing Watch, below, is HTTPS and carries more than positions.
 *
 * Several entries also carry a licence that forbids commercial use without an
 * agreement. `partitionByLicence` will exclude those even with a key, and it
 * should: a credential is not permission. Both facts are separate and both are
 * recorded, because "we have no key" and "we may not use it commercially" are
 * different problems with different fixes.
 */
export const KEYED_SOURCES: CatalogSource[] = [
  // ── Patents: the applied half of discovery (GATEWAY-MAP §3.4) ────────────
  {
    /**
     * The one route that can answer "what has this company patented".
     *
     * The keyless EPO Linked Open Data endpoint answers by publication date
     * only — its `_search`, `title` and `applicant` filters are accepted and
     * silently return nothing, which is the Stooq failure shape this codebase
     * has already paid for. OPS is the searchable register, and it is keyed.
     */
    key: 'epo_ops_patents',
    name: 'EPO Open Patent Services — searchable patent register',
    publisher: 'European Patent Office',
    url: 'https://ops.epo.org/3.2/rest-services/published-data/search?q={query}',
    kind: 'json',
    discipline: 'sci',
    topics: ['research', 'technology', 'corporate'],
    coverage: 'global',
    // The register itself, published by the office that maintains it.
    admiralty: 'A',
    independence: 'epo',
    licence: needsAgreement('EPO OPS fair-use terms', 'https://www.epo.org/en/searching-for-patents/data/web-services/ops'),
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'EPO_OPS_KEY',
    enabled: false,
    note:
      'Free tier exists but requires OAuth registration. The keyless data.epo.org LOD endpoint was probed 2026-08-22: full record by publication number works, date filtering works, and applicant/title search returns zero items for every query — so search is only reachable here.',
  },
  {
    key: 'uspto_odp_patents',
    name: 'USPTO Open Data Portal — US patent applications and grants',
    publisher: 'United States Patent and Trademark Office',
    url: 'https://api.uspto.gov/api/v1/patent/applications/search?q={query}',
    kind: 'json',
    discipline: 'sci',
    topics: ['research', 'technology', 'corporate'],
    coverage: ['US'],
    admiralty: 'A',
    independence: 'uspto',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'USPTO_ODP_KEY',
    enabled: false,
    note:
      'US government work, so no licence obstacle — only a key. The legacy keyless routes were probed 2026-08-22 and are gone: api.patentsview.org and developer.uspto.gov/ibd-api both return the HTML landing page, and the trademark search API answers 404.',
  },

  // ── Debarment and exclusion (GATEWAY-MAP §3.3) ───────────────────────────
  {
    /**
     * The half of due diligence we cannot currently answer.
     *
     * `finance` reads sanctions and `ownership` reads corporate control, but
     * "has this supplier been barred from public contracts" is a different
     * question, and it is the one a procurement reader asks first.
     */
    key: 'worldbank_debarred',
    name: 'World Bank — debarred and cross-debarred firms',
    publisher: 'World Bank Group',
    url: 'https://apigwext.worldbank.org/dvsvc/v1.0/json/APPLICATION/ADOBE_EXPERIENCE_MANAGER/FIRM/SANCTIONED_FIRM',
    kind: 'json',
    discipline: 'fin',
    topics: ['procurement', 'corporate', 'sanctions'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'worldbank',
    licence: ccBy('World Bank', 'https://www.worldbank.org/en/about/legal/terms-and-conditions'),
    minIntervalSec: 86_400,
    keyless: false,
    keyEnv: 'WORLDBANK_API_KEY',
    enabled: false,
    note:
      'Probed 2026-08-22: the formerly public JSON endpoint answers 401. The list is still published for humans; the machine route now authenticates.',
  },
  {
    key: 'sam_gov_exclusions',
    name: 'SAM.gov — US federal exclusions (barred contractors)',
    publisher: 'US General Services Administration',
    url: 'https://api.sam.gov/entity-information/v3/entities?includeSections=exclusions',
    kind: 'json',
    discipline: 'fin',
    topics: ['procurement', 'corporate', 'sanctions'],
    coverage: ['US'],
    admiralty: 'A',
    independence: 'sam-gov',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 86_400,
    keyless: false,
    keyEnv: 'SAM_GOV_API_KEY',
    enabled: false,
    note:
      'US government work; the key is free but registration-gated. The authoritative US debarment list, and the direct complement to the procurement gateway.',
  },

  // ── Verification (GATEWAY-MAP §3.2) ──────────────────────────────────────
  {
    /**
     * Every ClaimReview publisher at once, rather than the five feeds the
     * `verify` gateway reads directly.
     *
     * Worth recording precisely because `verify` already works without it: the
     * gap is reach, not capability, and a record makes the difference legible.
     */
    key: 'google_factcheck_tools',
    name: 'Google Fact Check Tools — ClaimReview across all publishers',
    publisher: 'Google',
    url: 'https://factchecktools.googleapis.com/v1alpha1/claims:search?query={query}',
    kind: 'json',
    discipline: 'osint',
    topics: ['factcheck', 'news'],
    coverage: 'global',
    // An index of other people's checks: reliable aggregator, second-hand
    // information. The checkers themselves are graded where they are read.
    admiralty: 'B',
    independence: 'google-factcheck',
    licence: needsAgreement('Google APIs Terms of Service', 'https://developers.google.com/fact-check/tools/api/terms'),
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'GOOGLE_FACTCHECK_KEY',
    enabled: false,
    note:
      'Indexes ClaimReview markup from every publisher that emits it, which is far wider than the five IFCN feeds `verify` reads. Adds reach, not a capability we lack.',
  },

  // ── Maritime: ship movement (GATEWAY-MAP §3.1) ───────────────────────────
  {
    key: 'global_fishing_watch',
    name: 'Global Fishing Watch — vessel activity and fishing effort',
    publisher: 'Global Fishing Watch',
    url: 'https://gateway.api.globalfishingwatch.org/v3/vessels/search?query={query}',
    kind: 'json',
    discipline: 'geoint',
    topics: ['maritime', 'conflict'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'gfw',
    licence: nonCommercial('Global Fishing Watch API terms', 'https://globalfishingwatch.org/our-apis/documentation'),
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'GFW_API_TOKEN',
    enabled: false,
    note:
      'Free tokens for non-commercial use. Carries what plain AIS does not — identity resolution and inferred fishing activity — which is why it is listed beside a raw AIS relay rather than instead of it.',
  },

  // ── Earth observation (GATEWAY-MAP §3.5) ─────────────────────────────────
  {
    /**
     * §3.5 defers earth observation for a scope reason rather than a licence
     * one: the imagery is genuinely open, and a raster layer is a different
     * product surface from a row on a board. The record keeps the route
     * findable for when the globe can carry one.
     */
    key: 'copernicus_dataspace',
    name: 'Copernicus Data Space — Sentinel imagery catalogue',
    publisher: 'European Space Agency / European Commission',
    url: 'https://catalogue.dataspace.copernicus.eu/stac/search',
    kind: 'json',
    discipline: 'geoint',
    topics: ['wildfire', 'flood', 'drought', 'storm'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'copernicus',
    licence: ccBy('Copernicus Sentinel data', 'https://dataspace.copernicus.eu/terms-and-conditions'),
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'COPERNICUS_TOKEN',
    enabled: false,
    note:
      'Free registration, open data licence. Deferred by scope, not by terms: imagery needs a raster layer on the globe before a catalogue search means anything to a reader.',
  },
  {
    key: 'usgs_m2m_landsat',
    name: 'USGS Machine-to-Machine — Landsat scene search',
    publisher: 'US Geological Survey',
    url: 'https://m2m.cr.usgs.gov/api/api/json/stable/scene-search',
    kind: 'json',
    discipline: 'geoint',
    topics: ['wildfire', 'flood', 'drought'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'usgs',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'USGS_M2M_TOKEN',
    enabled: false,
    note:
      'US government work, freely licensed, but every request needs a login token. Fifty years of continuous imagery — the longest earth-observation record there is.',
  },
]
