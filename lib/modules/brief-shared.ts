/**
 * The standing brief — the parts the browser needs.
 *
 * Split from `brief.ts` for the same reason `world-events-shared.ts` is split
 * from `world-events.ts`: the module that *fetches* the world picture reaches
 * the engine orchestrator, which reaches `node:crypto` through the guardrail,
 * and a client component importing so much as a type from it drags that whole
 * chain into the browser bundle and fails the build. Everything here is pure —
 * types and the assembly of a report we were already handed.
 *
 * ## What a standing brief is
 *
 * The analyst panel in this product only ever appeared *after* an
 * investigation, which means the analysis was something you had to go and ask
 * for. A brief is the opposite: it is standing, it is the first thing on the
 * screen, and it reads the picture the platform already holds.
 *
 * It answers four questions in the order an analyst asks them:
 *
 *  1. **What is the picture made of** — how many events, from how many
 *     independent origins, and which feeds contributed nothing.
 *  2. **What is being reported** — distinct stories, not distinct reports, so
 *     one earthquake carried by nine outlets is one line and not nine.
 *  3. **How much of it can be trusted** — the mechanical reading:
 *     corroboration, disagreement, age, source mix, and the gaps those imply.
 *  4. **Where we cannot see** — because a region with no events may be quiet
 *     or may be dark, and those are completely different things.
 *
 * Nothing in it is generated prose. Every headline is a sentence a source
 * published and every number is counted from the report it was built from.
 */
import type { Evidence } from '../engine/types'
import type { AnalystVerdict } from '../ai/types'
import type { Story, StoryAnalysis } from '../analysis/stories'
import type {
  RegionCoverageSummary,
  SourceHealth,
  WorldEvent,
  WorldEventsReport,
} from './world-events-shared'

/**
 * How many stories the brief carries.
 *
 * A brief that lists everything is a feed, and the reader is back to doing the
 * triage themselves. The counts underneath stay exact, so nothing is hidden —
 * only the list is bounded.
 */
export const MAX_BRIEF_STORIES = 12

export interface BriefPicture {
  /** Distinct events after deduplication — placed and unplaceable together. */
  events: number
  placed: number
  unplaceable: number
  /** Independent origins behind the whole picture. Never the source count. */
  origins: number
  sourcesOk: number
  sourcesEmpty: number
  sourcesFailed: number
  /** The most recent thing we hold — the honest answer to "is this live?". */
  newestAt: string | null
}

export interface StandingBrief {
  generatedAt: string
  picture: BriefPicture
  /**
   * The analyst's verdict over the same evidence.
   *
   * Always carries `reading` — the mechanical analysis, computed with no model.
   * `model` is non-null only where a model also ran.
   */
  verdict: AnalystVerdict
  /** Distinct stories, best-corroborated first. Bounded; the counts are not. */
  stories: Story[]
  storyAnalysis: StoryAnalysis
  /** Regions where silence tells the reader nothing, because nothing covers them. */
  blindSpots: RegionCoverageSummary[]
  /** Feeds that did not answer, or answered with nothing. Named, not hidden. */
  quietSources: SourceHealth[]
  /**
   * The evidence the reading was computed from, in the order its `refs` index.
   *
   * Shipped with the brief so every sentence in the reading resolves to the row
   * behind it. An analysis a reader cannot trace is an analysis they have to
   * take on faith, which is the thing this product exists not to ask of them.
   */
  findings: Evidence[]
}

/**
 * A world event as evidence.
 *
 * Deliberately lossless about the four things the reading depends on:
 * `publishedAt` stays null when the source stated no time (never defaulted to
 * the retrieval time), the Admiralty rating travels, the independence group
 * travels in `data`, and the coordinate travels so a location disagreement can
 * still be found.
 */
export function toEvidence(event: WorldEvent): Evidence {
  return {
    claim: event.title,
    sourceKey: event.sourceKey,
    ...(event.sourceUrl ? { sourceUrl: event.sourceUrl } : {}),
    retrievedAt: event.at,
    publishedAt: event.observedAt,
    ...(event.admiralty ? { admiralty: event.admiralty } : {}),
    confidence: event.confidence,
    data: {
      lat: event.lat,
      lon: event.lon,
      country: event.country,
      independence: event.independence,
      magnitude: event.magnitude,
      category: event.category,
    },
  }
}

/**
 * The whole picture as evidence, most operationally significant first.
 *
 * Placed events lead because they are the ones an operator can act on, and the
 * unplaceable ones follow rather than being dropped — a real event whose source
 * gave no location is still a real event, and excluding it here would quietly
 * bias every count in the reading that follows.
 */
export function worldEvidence(report: WorldEventsReport): Evidence[] {
  return [...report.events, ...report.unplaceable].map(toEvidence)
}

/**
 * The independence groups this report used, keyed by source key.
 *
 * The catalogue puts a group on each event; story clustering needs the same
 * table to count origins rather than mastheads. Building it from the report
 * itself means the brief and the globe can never disagree about who is
 * independent of whom.
 */
export function independenceTable(report: WorldEventsReport): Record<string, string> {
  const table: Record<string, string> = {}
  for (const event of [...report.events, ...report.unplaceable]) {
    if (event.independence) table[event.sourceKey] = event.independence
  }
  return table
}

/** Regions where an absence of events means nothing at all. Worst first. */
export function blindSpots(report: WorldEventsReport): RegionCoverageSummary[] {
  return report.coverage.filter((r) => r.status === 'dark' || r.status === 'thin')
}

/** Feeds that contributed nothing, so a thin picture is never read as a quiet world. */
export function quietSources(report: WorldEventsReport): SourceHealth[] {
  return report.sourceHealth.filter((s) => s.status !== 'ok')
}

/**
 * Assemble the brief.
 *
 * Pure: everything it needs has already been fetched and analysed. That is what
 * lets the whole shape be asserted in a test without a network, and what keeps
 * the engine out of the browser bundle.
 */
export function assembleBrief(
  report: WorldEventsReport,
  verdict: AnalystVerdict,
  stories: Story[],
  storyAnalysis: StoryAnalysis,
  findings: Evidence[],
): StandingBrief {
  return {
    generatedAt: report.generatedAt,
    picture: {
      events: report.summary.total,
      placed: report.summary.placed,
      unplaceable: report.unplaceable.length,
      // Counted from the evidence itself rather than from the source list: the
      // number that matters is how many independent origins are behind the
      // picture, which is always smaller than how many feeds answered.
      origins: storyAnalysis.origins,
      sourcesOk: report.summary.sourcesOk,
      sourcesEmpty: report.summary.sourcesEmpty,
      sourcesFailed: report.summary.sourcesFailed,
      newestAt: report.summary.newestAt,
    },
    verdict,
    stories: stories.slice(0, MAX_BRIEF_STORIES),
    storyAnalysis,
    blindSpots: blindSpots(report),
    quietSources: quietSources(report),
    findings,
  }
}
