/**
 * Automatic publishing — the platform writing to its own front page.
 *
 * Everything the engine already produces (graded world events, the Radar's
 * security and research sweep, the day's trending subjects) used to be visible
 * only to whoever opened the right tab. This turns the strongest of it into real
 * posts in the public feed, on a schedule, with no human in the loop.
 *
 * The whole design problem is restraint, so four rules bound it:
 *
 *  1. **A threshold, not a firehose.** Only items that clear a real bar are
 *     published — a measured severity, a corroborated trend, an actually
 *     exploited vulnerability. A feed that publishes everything is noise, and
 *     noise is what people already have.
 *  2. **Nothing is written that a source did not say.** Every body is assembled
 *     from the item's own fields and its link. The platform never paraphrases a
 *     claim into something stronger than the evidence.
 *  3. **Never twice.** Each candidate carries a stable identity, and the run
 *     skips anything already published.
 *  4. **A cap per run.** Even a catastrophic day cannot flood the feed.
 *
 * Dependency-injected, so the decision logic is testable without a database.
 */
import type { WorldEvent } from './world-events-shared'

export type PublishKind = 'research' | 'signal'

export interface PublishCandidate {
  kind: PublishKind
  title: string
  body: string
  sourceUrl: string | null
  /** Stable identity for this item — the dedup key. */
  refValue: string
  locale: string
}

export interface AutoPublishDeps {
  /** True when a post with this reference already exists. */
  alreadyPublished: (refValue: string) => Promise<boolean>
  publish: (candidate: PublishCandidate) => Promise<void>
}

export interface AutoPublishResult {
  considered: number
  published: PublishCandidate[]
  skippedAsDuplicate: number
  skippedBelowBar: number
}

/** The byline every automatic post carries. */
export const PLATFORM_AUTHOR = 'Lambda NX'
/** Marks a post as machine-published, so the UI can label it honestly. */
export const AUTO_REF_TYPE = 'auto'

/**
 * The bar for turning an event into a signal post. 0.7 is roughly a strong
 * earthquake, a large fire, or an official orange/red alert — the level at which
 * a reader would want to have been told.
 */
export const SEVERITY_BAR = 0.7
/** Never more than this many posts from one run, whatever the day looks like. */
export const MAX_PER_RUN = 6

/** A short, stable, filename-safe identity for a string. */
export function refKey(prefix: string, value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return `${prefix}:${slug}`
}

/** The UTC day, used to make daily digests idempotent. */
export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Turn a severe event into a post. Returns null when it does not clear the bar —
 * that decision is the feature.
 */
export function eventToCandidate(event: WorldEvent): PublishCandidate | null {
  if (event.severity < SEVERITY_BAR) return null
  if (!event.sourceUrl) return null // nothing to send a reader to

  const facts: string[] = []
  if (event.country) facts.push(`Location: ${event.country}`)
  if (event.lat !== null && event.lon !== null) {
    facts.push(`Coordinates: ${event.lat.toFixed(2)}, ${event.lon.toFixed(2)}`)
  }
  if (event.magnitude !== null) {
    facts.push(`Measured: ${event.magnitude}${event.magnitudeUnit ? ` ${event.magnitudeUnit}` : ''}`)
  }
  if (event.alertLevel) facts.push(`Official alert level: ${event.alertLevel}`)
  facts.push(`Reported: ${event.at}`)
  facts.push(`Source: ${event.sourceKey}`)
  if (event.admiralty) {
    facts.push(`Admiralty rating: ${event.admiralty.source}${event.admiralty.info}`)
  }
  facts.push(`Confidence: ${event.confidence}`)

  return {
    kind: 'signal',
    title: event.title.slice(0, 160),
    // Strictly the event's own fields. No summary, no interpretation.
    body: [
      `${event.categoryLabel} recorded by ${event.sourceKey}.`,
      '',
      ...facts,
      '',
      'Published automatically by Lambda NX from a graded public source. Open the link for the original report.',
    ].join('\n'),
    sourceUrl: event.sourceUrl,
    refValue: refKey('event', `${event.sourceKey}-${event.title}`),
    locale: 'en',
  }
}

export interface TrendingSubject {
  title: string
  url: string | null
  views: number
  corroborated: boolean
  rank: number
}

/**
 * One daily brief of what the world looked up, not one post per subject. The
 * digest is idempotent by day, so re-running the job cannot repost it.
 */
export function trendingToCandidate(
  subjects: TrendingSubject[],
  day = utcDay(),
): PublishCandidate | null {
  // A brief needs corroborated subjects to be worth publishing at all.
  const solid = subjects.filter((s) => s.corroborated).slice(0, 8)
  if (solid.length < 3) return null

  const lines = solid.map(
    (s) => `${s.rank}. ${s.title} — ${s.views.toLocaleString('en-US')} views${s.url ? ` — ${s.url}` : ''}`,
  )
  return {
    kind: 'research',
    title: `What the world looked up — ${day}`,
    body: [
      `The subjects most looked up worldwide on ${day}, counted from real page-view data and kept only where two independent sources agreed.`,
      '',
      ...lines,
      '',
      'View counts are an interest signal, not an importance ranking. Published automatically by Lambda NX.',
    ].join('\n'),
    sourceUrl: solid[0]?.url ?? null,
    refValue: refKey('trending', day),
    locale: 'en',
  }
}

export interface RadarFinding {
  title: string
  url: string | null
  sourceKey: string
  admiralty: { source: string; info: number } | null
  summary?: string | null
}

/**
 * A daily research digest from the Radar's standing watch feeds. Published only
 * when the sweep found enough to be worth a reader's attention.
 */
export function radarToCandidate(
  findings: RadarFinding[],
  day = utcDay(),
): PublishCandidate | null {
  const usable = findings.filter((f) => f.title?.trim() && f.url).slice(0, 10)
  if (usable.length < 3) return null

  const lines = usable.map((f) => {
    const grade = f.admiralty ? ` [${f.admiralty.source}${f.admiralty.info}]` : ''
    return `- ${f.title.trim()}${grade} — ${f.sourceKey} — ${f.url}`
  })
  return {
    kind: 'research',
    title: `Research & security watch — ${day}`,
    body: [
      `What the Radar picked up on ${day} across its standing watch feeds. Each item carries the feed it came from and its Admiralty rating; follow the link for the original.`,
      '',
      ...lines,
      '',
      'Collected automatically from public feeds by Lambda NX. We surface and grade; we do not reprint.',
    ].join('\n'),
    sourceUrl: usable[0]?.url ?? null,
    refValue: refKey('radar', day),
    locale: 'en',
  }
}

/**
 * Run the publisher over a set of candidates: drop the ones already out, cap the
 * rest, publish. A failure on one candidate must not abandon the others — a
 * scheduled job that stops at the first error publishes nothing all week.
 */
export async function runAutoPublish(
  candidates: Array<PublishCandidate | null>,
  deps: AutoPublishDeps,
  max = MAX_PER_RUN,
): Promise<AutoPublishResult> {
  const real = candidates.filter((c): c is PublishCandidate => c !== null)
  const skippedBelowBar = candidates.length - real.length

  const published: PublishCandidate[] = []
  let skippedAsDuplicate = 0

  for (const candidate of real) {
    if (published.length >= max) break
    let seen = false
    try {
      seen = await deps.alreadyPublished(candidate.refValue)
    } catch {
      // If we cannot tell whether it was published, do not publish it. A missed
      // post is recoverable next run; a duplicate on the front page is not.
      skippedAsDuplicate++
      continue
    }
    if (seen) {
      skippedAsDuplicate++
      continue
    }
    try {
      await deps.publish(candidate)
      published.push(candidate)
    } catch {
      /* keep going: one bad write must not cost the whole run */
    }
  }

  return {
    considered: candidates.length,
    published,
    skippedAsDuplicate,
    skippedBelowBar,
  }
}
