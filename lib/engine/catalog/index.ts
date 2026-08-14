import type { CatalogSource, Discipline, Topic } from './types'
import { independenceGroup, sourceHost } from './types'
import { HAZARD_SOURCES } from './feeds/hazards'
import { OFFICIAL_SOURCES } from './feeds/official'
import { CYBER_SOURCES } from './feeds/cyber'
import { NEWS_SOURCES, RESEARCH_SOURCES } from './feeds/news'
import { INFRASTRUCTURE_SOURCES } from './feeds/infrastructure'
import { REGIONAL_SOURCES } from './feeds/regional'
import { REGIONAL_EXTRA_SOURCES } from './feeds/regional-extra'
import { NATIONAL_SOURCES } from './feeds/national'
import { SCIENCE_SOURCES } from './feeds/science'
import { MARKET_SOURCES } from './feeds/markets'
import { partitionByLicence, requiredAttributions, LAMBDA_USAGE, type UsageContext } from './licence'
import { SOURCE_FAMILIES, livePublisherReach, plannedPublisherReach } from './families'

export * from './types'
export * from './licence'
export * from './families'

/**
 * The whole catalogue.
 *
 * Order is by how directly a source observes the world: instruments and
 * official bodies first, reporting last. That is not cosmetic — `rankSources`
 * uses it, and when two sources disagree the one that measured wins over the
 * one that heard.
 */
export const CATALOG: CatalogSource[] = [
  ...HAZARD_SOURCES,
  ...SCIENCE_SOURCES,
  ...NATIONAL_SOURCES,
  ...INFRASTRUCTURE_SOURCES,
  ...MARKET_SOURCES,
  ...OFFICIAL_SOURCES,
  ...CYBER_SOURCES,
  ...RESEARCH_SOURCES,
  ...NEWS_SOURCES,
  ...REGIONAL_SOURCES,
  ...REGIONAL_EXTRA_SOURCES,
]

/** Sources this deployment may lawfully use, and the ones it may not. */
export function usableCatalog(usage: UsageContext = LAMBDA_USAGE) {
  return partitionByLicence(CATALOG, usage)
}

/**
 * Sources that will actually run.
 *
 * Three filters, each for a different reason, and the order matters:
 *
 *  1. **Licence** — using a source we may not use is a legal problem, so it is
 *     checked first and is not overridable by configuration.
 *  2. **Explicitly disabled** — a source in trial, or one driven by a gateway
 *     rather than the sweep.
 *  3. **Missing credential** — a keyed source with no key would fail every
 *     request. Skipping it keeps the health report meaningful: `failed` should
 *     mean the provider let us down, not that we never configured it.
 */
export function activeSources(usage: UsageContext = LAMBDA_USAGE): CatalogSource[] {
  return usableCatalog(usage).usable.filter(
    (s) => s.enabled !== false && (s.keyless || (s.keyEnv ? Boolean(process.env[s.keyEnv]) : false)),
  )
}

/** Every host the catalogue reads from — what the passive guardrail allow-lists. */
export function catalogHosts(sources: CatalogSource[] = CATALOG): string[] {
  return [...new Set(sources.map(sourceHost).filter(Boolean))].sort()
}

export function byDiscipline(discipline: Discipline, sources = CATALOG): CatalogSource[] {
  return sources.filter((s) => s.discipline === discipline)
}

export function byTopic(topic: Topic, sources = CATALOG): CatalogSource[] {
  return sources.filter((s) => s.topics.includes(topic))
}

/**
 * How many *independent* sources cover a topic.
 *
 * The number that belongs in a confidence score. Counting entries would let a
 * single wire, republished, look like a consensus — see the note in
 * `feeds/news.ts`, which is the whole reason independence groups exist.
 */
export function independentCoverage(topic: Topic, sources = CATALOG): number {
  return new Set(byTopic(topic, sources).map(independenceGroup)).size
}

/**
 * A coverage report per topic — the input to the blind-spot map.
 *
 * Reports both counts deliberately. `sources` says how much traffic a topic
 * generates; `independent` says how much of it is actually corroboration. When
 * the two diverge sharply, that gap *is* the finding: a topic covered by
 * fifteen entries from three origins is far weaker than it looks.
 */
export function coverageReport(sources = CATALOG): Array<{
  topic: Topic
  sources: number
  independent: number
  bestAdmiralty: string
}> {
  const topics = new Set<Topic>()
  for (const s of sources) for (const t of s.topics) topics.add(t)

  return [...topics]
    .map((topic) => {
      const matching = byTopic(topic, sources)
      return {
        topic,
        sources: matching.length,
        independent: new Set(matching.map(independenceGroup)).size,
        bestAdmiralty: matching.map((s) => s.admiralty).sort()[0] ?? 'F',
      }
    })
    .sort((a, b) => a.independent - b.independent || a.topic.localeCompare(b.topic))
}

/** The attribution lines the interface is obliged to display. */
export function catalogAttributions(usage: UsageContext = LAMBDA_USAGE): string[] {
  return requiredAttributions(usableCatalog(usage).usable)
}

/**
 * Headline numbers, with the three quantities kept apart.
 *
 * Competitors quote "one million sources" and mean publishers reached. Quoting
 * that as integrations would be the exact inflation this platform exists to be
 * the opposite of, so the shape of this object makes the conflation impossible:
 * there is no field called `sources`.
 */
export function catalogSummary(usage: UsageContext = LAMBDA_USAGE) {
  const { usable, excluded } = usableCatalog(usage)
  const active = activeSources(usage)
  return {
    /** Providers we call and parse. The number that reflects engineering. */
    integrations: {
      total: CATALOG.length,
      usable: usable.length,
      active: active.length,
      excludedByLicence: excluded.length,
      keyless: CATALOG.filter((s) => s.keyless).length,
      hosts: catalogHosts().length,
    },
    /** Publishers reachable *through* those integrations. Reach, not effort. */
    reach: {
      live: livePublisherReach(),
      planned: plannedPublisherReach(),
      families: SOURCE_FAMILIES.length,
    },
    /**
     * Origins that are not copies of one another — the only figure that may
     * enter a confidence score, and always the smallest of the three.
     */
    independentOrigins: new Set(CATALOG.map(independenceGroup)).size,
    disciplines: new Set(CATALOG.map((s) => s.discipline)).size,
    topics: new Set(CATALOG.flatMap((s) => s.topics)).size,
  }
}
