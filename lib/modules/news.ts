/**
 * News & Signals gateway — a board of **events**, not a list of reports.
 *
 * ## What was wrong, and why it mattered
 *
 * This gateway used to return the raw evidence, newest first. Three defects
 * followed from that, and all three were visible to anyone who opened it:
 *
 *  1. **It repeated itself.** Nothing deduplicated, so one earthquake reported
 *     by four providers was four rows. The reader scrolled past what looked
 *     like four events.
 *  2. **It had no dates.** It sorted by `retrievedAt`, which most sources
 *     stamped with the moment we fetched them — so every item carried
 *     effectively the same timestamp, the sort did nothing, and no publication
 *     time was ever shown.
 *  3. **It did not analyse anything.** A flat list with no statement of how
 *     much of it was corroborated, how old it was, or what rested on a single
 *     source.
 *
 * All three are fixed here. `publishedAt` now carries the source's own time
 * (`lib/engine/types.ts`), `lib/analysis/stories.ts` clusters reports into
 * events, and the report carries a written analysis of its own contents.
 *
 * The gateway still never asserts a headline as fact: a story is graded by how
 * many *independent origins* reported it, and one origin is a lead however many
 * mastheads carried it.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerNewsGateway } from '../engine/sources'
import type { Evidence } from '../engine/types'
import { CATALOG } from '../engine/catalog'
import { independenceGroup } from '../engine/catalog/types'
import {
  analyseStories,
  clusterStories,
  storyOrder,
  type Story,
  type StoryAnalysis,
} from '../analysis/stories'

export interface NewsReport {
  topic: string | null
  generatedAt: string
  /** Distinct events, best-corroborated first. What the board renders. */
  stories: Story[]
  /**
   * The raw reports, kept alongside.
   *
   * The AI-analyst panel, the dossier export and the pivot graph all consume
   * `Evidence`, and a story is a view over reports rather than a replacement
   * for them. Dropping these would have quietly broken three other features.
   */
  items: Evidence[]
  analysis: StoryAnalysis
  summary: {
    count: number
    sources: string[]
    countries: string[]
    sourcesOk: number
    sourcesFailed: number
  }
}

/**
 * Which independence group each source belongs to.
 *
 * Read from the catalogue rather than hard-coded, so a new feed is counted
 * correctly the moment it is added. The coded sources (GDELT, ReliefWeb, USGS,
 * Wikipedia) are not in the catalogue and each is its own origin, which is what
 * the lookup falls back to.
 *
 * The case this exists for: a dozen catalogue feeds that all republish one wire
 * share a group, so a story carried by all twelve is **one** confirmation.
 */
function independenceGroups(): Record<string, string> {
  const groups: Record<string, string> = {}
  for (const source of CATALOG) groups[source.key] = independenceGroup(source)
  return groups
}

function countryOf(e: Evidence): string | null {
  const c = (e.data as { country?: string } | undefined)?.country
  return c && c.trim() ? c : null
}

export async function investigateNews(input = ''): Promise<NewsReport> {
  registerNewsGateway()
  const topic = input.trim() || null
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'news', value: topic ?? '' }, { registry, mode: 'all' })

  const stories = clusterStories(r.evidence, { groups: independenceGroups() }).sort(storyOrder)
  const analysis = analyseStories(stories, r.evidence.length)

  const sources = [...new Set(r.evidence.map((i) => i.sourceKey))]
  const countries = [
    ...new Set(r.evidence.map(countryOf).filter((c): c is string => Boolean(c))),
  ]

  return {
    topic,
    generatedAt,
    stories,
    items: r.evidence,
    analysis,
    summary: {
      count: r.evidence.length,
      sources,
      countries,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}
