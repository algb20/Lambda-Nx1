/**
 * Open Government Data gateway — "which state holds a record of this?"
 *
 * Distinct from every other gateway in one respect that matters to an analyst:
 * a hit here is not a report *about* the world, it is a government stating that
 * it **holds a record**. That is the strongest kind of pointer OSINT produces
 * and the one most often missed, because the catalogues are national, scattered
 * across thirty domains, and in a dozen languages.
 *
 * The module goes to the federation directly rather than through `collect()`,
 * because the per-portal health is half the answer. A search that returns
 * nothing because Brazil and Mexico were both down is a different answer from a
 * search that returns nothing because neither holds such a record, and an
 * orchestrator result — a single ok/failed per *source* — cannot tell them
 * apart when the source is thirty portals. The passive guarantee is unchanged:
 * the fetch is still the guardrail's, bound to the registered source.
 */
import { registry } from '../engine/registry'
import { registerOpenDataGateway } from '../engine/sources'
import { analystOrder, ckanFederation, datasetToEvidence } from '../engine/sources/opendata'
import type { Evidence } from '../engine/types'
import {
  activePortals,
  federatedSearch,
  independentPortals,
  type CkanDataset,
  type PortalHealth,
} from '../engine/registries/ckan'

export interface OpenDataReport {
  subject: string
  generatedAt: string
  datasets: CkanDataset[]
  /**
   * The same records as graded evidence.
   *
   * Carried alongside `datasets` rather than instead of them, because the two
   * are read by different things: the interface renders datasets, while the
   * AI-analyst panel, the dossier export and the pivot graph all consume
   * `Evidence`. Built by the engine's own mapper so a rating rule cannot mean
   * one thing in a report and another in an export.
   */
  findings: Evidence[]
  portals: PortalHealth[]
  summary: {
    /** Datasets returned, after a harvested copy is collapsed into its origin. */
    datasets: number
    /** Copies of a dataset already counted through its origin portal. */
    duplicatesRemoved: number
    /** Distinct publishing organizations — ministries, agencies, municipalities. */
    publishers: number
    countries: number
    portalsQueried: number
    portalsOk: number
    portalsEmpty: number
    portalsFailed: number
    /**
     * The portals' own totals summed. The size of the haystack, and always far
     * larger than what came back — reported so nobody mistakes a page of
     * results for the whole record.
     */
    matchesAcrossPortals: number
  }
  /**
   * Said in words, because a row of counters does not tell an operator whether
   * to trust an empty result — which is the single question this gateway has to
   * answer honestly.
   */
  explanation: string
}

/**
 * Exported because it is the part of this gateway most worth testing: the
 * wording of an *empty* result. "Nothing found" and "we could not look" are the
 * same screen on every comparable platform, and telling them apart is the whole
 * claim this module makes.
 */
export function explainFederation(
  found: Awaited<ReturnType<typeof federatedSearch>>,
  portalCount: number,
): string {
  const { portalsOk, portalsEmpty, portalsFailed, matchesAcrossPortals } = found.summary

  if (portalsFailed === portalCount) {
    return `No catalogue answered. All ${portalCount} portals failed, so this is an outage on our side of the connection — not evidence that no such record exists.`
  }
  if (found.datasets.length === 0) {
    const caveat =
      portalsFailed > 0
        ? ` ${portalsFailed} of ${portalCount} could not be reached, so the search was incomplete.`
        : ' Every portal answered, so the absence is a real finding for these catalogues.'
    return `No matching dataset in ${portalsEmpty} catalogue${portalsEmpty === 1 ? '' : 's'} that answered.${caveat}`
  }

  const reach =
    matchesAcrossPortals > found.datasets.length
      ? ` The portals report ${matchesAcrossPortals.toLocaleString('en-US')} matches in total — these are the most recently updated.`
      : ''
  const lost =
    portalsFailed > 0
      ? ` ${portalsFailed} portal${portalsFailed === 1 ? '' : 's'} did not answer, so coverage is partial.`
      : ''
  const merged =
    found.duplicatesRemoved > 0
      ? ` ${found.duplicatesRemoved} republished cop${found.duplicatesRemoved === 1 ? 'y was' : 'ies were'} merged into the originating catalogue.`
      : ''

  return `${found.datasets.length} dataset${found.datasets.length === 1 ? '' : 's'} from ${found.summary.publishers} publisher${found.summary.publishers === 1 ? '' : 's'} across ${portalsOk} catalogue${portalsOk === 1 ? '' : 's'}.${reach}${merged}${lost}`
}

export async function investigateOpenData(input: string): Promise<OpenDataReport> {
  const subject = input.trim()
  if (subject.length < 3) throw new Error('Enter at least three characters to search the catalogues')

  // Registering allow-lists every portal host with the guardrail, which is what
  // makes the fetch below legal to issue at all.
  registerOpenDataGateway()
  const guardedFetch = registry.guardrail.createFetch(
    ckanFederation.key,
    ckanFederation.minIntervalMs,
  )

  const portals = activePortals()
  const found = await federatedSearch(guardedFetch, subject, { portals, rowsPerPortal: 10 })
  const generatedAt = new Date().toISOString()
  const datasets = [...found.datasets].sort(analystOrder)

  return {
    subject,
    generatedAt,
    datasets,
    findings: datasets.map((d) => datasetToEvidence(d, generatedAt)),
    portals: found.health,
    summary: {
      datasets: found.datasets.length,
      duplicatesRemoved: found.duplicatesRemoved,
      publishers: found.summary.publishers,
      countries: found.summary.countries,
      portalsQueried: found.summary.portalsQueried,
      portalsOk: found.summary.portalsOk,
      portalsEmpty: found.summary.portalsEmpty,
      portalsFailed: found.summary.portalsFailed,
      matchesAcrossPortals: found.summary.matchesAcrossPortals,
    },
    explanation: explainFederation(found, portals.length),
  }
}

/** What the federation covers, for the source dossier. Costs no requests. */
export function openDataCoverage() {
  const portals = activePortals()
  return {
    portals: portals.length,
    independentPortals: independentPortals(portals).length,
    countries: [...new Set(portals.map((p) => p.country))].sort(),
  }
}
