/**
 * Open government data — the CKAN federation as an engine source.
 *
 * ## Why this is one source and not thirty
 *
 * Every other entry in this engine is one source per provider. This one is a
 * federation, because the providers speak an identical protocol: adding Chile
 * is adding a row to `registries/ckan/portals.ts`, not writing a module. It is
 * the only place in the platform where the source population grows by data.
 *
 * ## What an open-data hit actually proves
 *
 * A dataset is an **official body stating that it holds a record**. That is a
 * strong fact of a narrow kind, and the rating reflects exactly that and no
 * more: `A2` for a dataset published by a government catalogue — the operator
 * is the record-holder (A), and the claim is "this record exists and was last
 * touched on this date", which is probably true but not independently
 * confirmed (2). It is emphatically *not* a rating of the data inside the
 * dataset, which we have not read.
 *
 * A catalogue run by a civil-society organization (Code for Africa's pan-African
 * catalogue, for instance) is a `B` — competent and well-regarded, but it is
 * republishing someone else's record rather than holding it.
 */
import type { Admiralty, Evidence, Source } from '../types'
import type { CkanDataset, DataPortal } from '../registries/ckan'
import { CKAN_HOSTS, PORTALS, activePortals, federatedSearch } from '../registries/ckan'

/**
 * Government catalogues hold their own records; aggregators republish them.
 * Keyed by portal so the rating is a property of the publisher rather than a
 * guess made per result.
 */
const AGGREGATOR_PORTALS = new Set(['africa_open_data', 'ke_open_data'])

function ratingFor(portalKey: string): Admiralty {
  return AGGREGATOR_PORTALS.has(portalKey) ? { source: 'B', info: 2 } : { source: 'A', info: 2 }
}

/**
 * One line an analyst can read without opening anything.
 *
 * The publisher leads because "who holds this" is the question a dataset
 * answers. The date is stated only when the portal stated one — "last updated
 * unknown" is a real and useful finding, and defaulting it to the retrieval
 * time would turn a decade-old file into today's news.
 */
function claimFor(d: CkanDataset): string {
  const publisher = d.organization ?? d.portalName
  const when = d.modifiedAt
    ? `last updated ${d.modifiedAt.slice(0, 10)}`
    : 'last update not stated'
  const formats = d.formats.length ? ` — ${d.formats.slice(0, 4).join(', ')}` : ''
  return `${publisher} publishes “${d.title}” (${d.portalName}, ${d.country}; ${when}${formats})`
}

/**
 * One dataset as graded evidence.
 *
 * Exported because the gateway module builds the same evidence outside the
 * orchestrator — it goes to the federation directly to keep the per-portal
 * health — and two copies of this mapping would drift the first time a rating
 * rule changed. One definition, both callers.
 */
export function datasetToEvidence(d: CkanDataset, retrievedAt: string): Evidence {
  return {
    claim: claimFor(d),
    entity: d.organization ? { type: 'organization', value: d.organization } : undefined,
    sourceKey: `ckan:${d.portalKey}`,
    sourceUrl: d.url,
    retrievedAt,
    admiralty: ratingFor(d.portalKey),
    // "This catalogue holds this record" is a first-hand statement by the body
    // that holds it. Nothing about the record's *contents* is being graded here,
    // and the claim text is careful to say only that.
    confidence: 'confirmed',
    data: {
      portal: d.portalKey,
      country: d.country,
      organization: d.organization,
      licenceId: d.licenceId,
      licenceTitle: d.licenceTitle,
      modifiedAt: d.modifiedAt,
      formats: d.formats,
      resources: d.resourceCount,
      tags: d.tags.slice(0, 12),
    },
  }
}

/** Datasets ranked for an analyst: freshest first, then by how usable they are. */
export function analystOrder(a: CkanDataset, b: CkanDataset): number {
  const at = a.modifiedAt ? Date.parse(a.modifiedAt) : -Infinity
  const bt = b.modifiedAt ? Date.parse(b.modifiedAt) : -Infinity
  if (at !== bt) return bt - at
  // A dataset with machine-readable distributions is worth more than a PDF.
  return b.resourceCount - a.resourceCount
}

export const MAX_EVIDENCE = 12

export function buildOpenDataSource(portals: DataPortal[] = activePortals()): Source {
  return {
    key: 'ckan_federation',
    capability: 'open_data',
    passive: true,
    // Every portal in the registry, including the disabled ones: the allowlist
    // must cover a portal the moment it is switched on, and a guardrail that
    // needs a second edit to match the registry is a guardrail that will drift.
    hosts: CKAN_HOSTS,
    minIntervalMs: 1000,
    async run(input, ctx) {
      const q = input.value.trim()
      // Below three characters `package_search` matches most of a catalogue,
      // which is noise rather than a result.
      if (q.length < 3) return []

      const found = await federatedSearch(ctx.fetch, q, { portals, rowsPerPortal: 10 })

      // Every portal failing is an outage, not an empty catalogue. Saying so is
      // the whole reason per-portal health is carried out of the federation.
      if (found.summary.portalsFailed === found.summary.portalsQueried && portals.length > 0) {
        throw new Error(
          `ckan_federation: all ${portals.length} portals unreachable (${found.health[0]?.error ?? 'no detail'})`,
        )
      }

      const retrievedAt = new Date().toISOString()
      return found.datasets
        .sort(analystOrder)
        .slice(0, MAX_EVIDENCE)
        .map((d) => datasetToEvidence(d, retrievedAt))
    },
  }
}

export const ckanFederation: Source = buildOpenDataSource()

/** Declared for the catalogue dossier: this one source reaches every portal. */
export const openDataPortalCount = PORTALS.length
export const openDataActivePortalCount = activePortals().length
