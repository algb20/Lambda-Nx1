import type { Evidence } from '../engine/types'

/**
 * Story clustering — turning a list of reports into a list of *events*.
 *
 * ## The problem this solves
 *
 * A signals feed that lists reports lists the same story once per source. Four
 * providers covering one earthquake produce four rows, the reader scrolls past
 * what looks like four events, and the one number that actually matters — how
 * many *independent* origins reported it — is nowhere on screen. Every
 * comparable platform ships this way; it is the single most common failure in
 * the category and it is why an aggregated feed feels like noise.
 *
 * The globe already fuses events by coordinate and time (`fusion.ts`). That
 * cannot work here: a headline has no coordinate. So this module clusters by
 * what a headline does have — its words — and the whole design problem is
 * getting that to be neither too eager nor too shy.
 *
 * ## Why term weighting, and not plain overlap
 *
 * Two headlines sharing "the government said" share nothing. Two sharing
 * "Tōhoku" share almost everything. Plain Jaccard overlap treats those
 * identically, so it merges unrelated political stories and misses the same
 * event described in two registers.
 *
 * So terms are weighted by how rare they are **in this batch** — a local
 * inverse-document-frequency. This needs no dictionary, no language list and no
 * model: it derives the discriminating words from the batch itself, which is
 * what makes it work identically on Arabic, Japanese or Spanish headlines. That
 * property is the reason it is built this way rather than with a stopword list
 * per language, which would have quietly worked for English and failed
 * everywhere else.
 *
 * The measure is *batch-relative*, and that has a real limit worth stating
 * rather than tuning around: in a batch of three, a term shared by two reports
 * is two-thirds common, so the very words identifying the shared event score
 * lowest and the metric inverts. Below `MIN_BATCH_FOR_IDF` we therefore use
 * plain containment over informative tokens instead. One measure is chosen per
 * batch, never per pair — a threshold that means different things on different
 * rows is worse than either measure alone.
 *
 * ## Why single-link, and what stops it running away
 *
 * Single-link clustering chains: A matches B, B matches C, so A, B and C are
 * one story even if A and C share nothing. For news that is usually *right* —
 * a developing story genuinely reads differently at its two ends. But it can
 * run away, so two things bound it: a time window (reports far apart in time
 * are different events even with identical words) and a cluster size ceiling.
 */

/** Reports more than this far apart are different events, however alike. */
export const DEFAULT_WINDOW_HOURS = 36

/**
 * Similarity at or above this merges. Tuned against the failure that matters
 * more: over-merging hides an event, under-merging only repeats one. When in
 * doubt this threshold errs toward leaving stories apart.
 */
export const MERGE_THRESHOLD = 0.42

/** A runaway chain is a bug, not a mega-story. */
export const MAX_CLUSTER = 40

/**
 * Tokens shorter than this are dropped.
 *
 * Two characters is deliberately permissive: it keeps CJK-ish short tokens and
 * two-letter country codes, and the IDF weighting already suppresses whatever
 * common noise gets through. A longer minimum would silently degrade every
 * non-Latin script.
 */
const MIN_TOKEN = 2

/**
 * Split on anything that is not a letter, digit or mark.
 *
 * Unicode property escapes rather than `\w`, which is ASCII-only and would
 * reduce an Arabic or Japanese headline to a single empty token — every such
 * story would then merge with every other, which is the worst possible failure
 * mode and an invisible one.
 */
const SPLIT = /[^\p{L}\p{N}\p{M}]+/u

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .split(SPLIT)
    .filter((t) => t.length >= MIN_TOKEN)
}

/** Unique tokens of a report, in a set for O(1) intersection. */
function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text))
}

/**
 * Below this many reports, batch-relative rarity has nothing to work with.
 *
 * Inverse document frequency measures how rare a term is **in this batch**, and
 * in a batch of three every term shared by two reports is by definition
 * two-thirds common — so the words that identify the shared event get the
 * *lowest* weight and the metric inverts. That is not a tuning problem, it is
 * what the measure means. Under this size we use plain containment instead,
 * which needs no statistics; over it, IDF is the right and standard tool.
 */
export const MIN_BATCH_FOR_IDF = 8

/**
 * How much each term is worth, derived from this batch.
 *
 * `log(N / df)` — the standard inverse document frequency, floored at zero so a
 * term appearing in *every* report contributes nothing rather than a negative
 * weight. No corpus, no model, no language assumption: the discriminating words
 * are derived from the batch itself, which is why this behaves identically on
 * Arabic, Japanese and Spanish headlines.
 */
export function termWeights(docs: Array<Set<string>>): Map<string, number> {
  const df = new Map<string, number>()
  for (const doc of docs) for (const t of doc) df.set(t, (df.get(t) ?? 0) + 1)

  const n = Math.max(1, docs.length)
  const weights = new Map<string, number>()
  for (const [term, count] of df) weights.set(term, Math.max(0, Math.log(n / count)))
  return weights
}

/**
 * Weighted overlap of two reports: shared weight over the smaller side's weight.
 *
 * The **smaller** side, deliberately, not the union. A one-line wire flash and a
 * detailed situation report about the same event have very different lengths,
 * and dividing by the union would score that pair low precisely when merging
 * matters most — the short report is the one whose story we most need to place.
 */
export function similarity(
  a: Set<string>,
  b: Set<string>,
  weights: Map<string, number>,
): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]

  let shared = 0
  let smallTotal = 0
  for (const t of small) {
    const w = weights.get(t) ?? 0
    smallTotal += w
    if (large.has(t)) shared += w
  }
  // Every term in the smaller report is batch-universal, so it carries no
  // discriminating information at all. Merging on that is merging on nothing.
  if (smallTotal <= 0) return 0
  return shared / smallTotal
}

/**
 * Containment — the small-batch measure.
 *
 * How much of the shorter report the longer one contains, for the same reason
 * the weighted measure divides by the smaller side: a terse wire flash and a
 * long situation report about one event have very different lengths, and
 * dividing by the union would score that pair lowest exactly when merging
 * matters most.
 *
 * The one statistical guard is at the end rather than the start: a merge must
 * rest on at least one term the *whole batch* does not share. Stripping those
 * terms up front — the obvious implementation — destroys the signal on a small
 * homogeneous board, because when every report really is about one event the
 * words naming that event are precisely the ones present in all of them. So
 * they are counted, and only a match resting on nothing *but* them is refused.
 */
export function containment(
  a: Set<string>,
  b: Set<string>,
  universal: Set<string>,
): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  if (small.size === 0) return 0

  let shared = 0
  let distinctive = 0
  for (const t of small) {
    if (!large.has(t)) continue
    shared++
    if (!universal.has(t)) distinctive++
  }
  // Everything these two have in common, every other report has too. That is
  // not a shared story, it is a shared vocabulary.
  if (distinctive === 0) return 0
  return shared / small.size
}

export interface Scorer {
  (a: Set<string>, b: Set<string>): number
  /** Which measure was chosen, so a test and an operator can both see it. */
  readonly strategy: 'idf' | 'containment'
}

/**
 * Choose the measure once, for the whole batch.
 *
 * Deciding per pair would let one board mix two scales, and a threshold that
 * means different things on different rows is worse than either measure alone.
 */
export function buildScorer(docs: Array<Set<string>>): Scorer {
  if (docs.length >= MIN_BATCH_FOR_IDF) {
    const weights = termWeights(docs)
    const fn = ((a: Set<string>, b: Set<string>) => similarity(a, b, weights)) as {
      (a: Set<string>, b: Set<string>): number
      strategy: 'idf' | 'containment'
    }
    fn.strategy = 'idf'
    return fn
  }

  const df = new Map<string, number>()
  for (const doc of docs) for (const t of doc) df.set(t, (df.get(t) ?? 0) + 1)
  // "Present in every report" needs at least three reports to mean anything.
  // With two, the terms in both are by definition the terms in all — every pair
  // would then rest on nothing distinctive and clustering would be silently off.
  const universal =
    docs.length >= 3
      ? new Set([...df.entries()].filter(([, count]) => count === docs.length).map(([t]) => t))
      : new Set<string>()
  const fn = ((a: Set<string>, b: Set<string>) => containment(a, b, universal)) as {
    (a: Set<string>, b: Set<string>): number
    strategy: 'idf' | 'containment'
  }
  fn.strategy = 'containment'
  return fn
}

/** One report inside a story, with everything the reader needs to check it. */
export interface StoryReport {
  claim: string
  sourceKey: string
  sourceUrl: string | null
  /** The independence group — twenty outlets from one wire is one of these. */
  origin: string
  /** The outlet, where the source named one (GDELT gives the domain). */
  outlet: string | null
  publishedAt: string | null
  retrievedAt: string
  admiralty: { source: string; info: number } | null
  country: string | null
}

export interface Story {
  /** Stable across runs for the same set of reports — see `storyId`. */
  id: string
  /** The headline of the best-rated report. Never a synthesised sentence. */
  headline: string
  reports: StoryReport[]
  /** Distinct independence groups. The only number that is corroboration. */
  independentOrigins: number
  /** Distinct outlets. Bigger than origins, and not the same thing. */
  outlets: number
  /** Earliest stated publication time, or null if no report stated one. */
  firstReportedAt: string | null
  /** Latest stated publication time, or null. */
  lastReportedAt: string | null
  /** When we last saw any report of it. Always known. */
  lastSeenAt: string
  countries: string[]
  /** Best Admiralty source letter across the reports, e.g. 'A'. */
  bestSourceRating: string | null
  grade: StoryGrade
  /** Why it got that grade, in words. */
  gradeReason: string
}

export type StoryGrade = 'confirmed' | 'corroborated' | 'single-source' | 'unverified'

/**
 * An identifier that survives a refresh.
 *
 * Built from the sorted report URLs (or claims where there is no URL), so the
 * same story keeps its id across runs and the interface does not remount every
 * row every thirty seconds. A hash would need `node:crypto`, which cannot enter
 * the browser bundle — this is a plain, deterministic string fold.
 */
export function storyId(reports: StoryReport[]): string {
  const material = reports
    .map((r) => r.sourceUrl ?? r.claim)
    .sort()
    .join(' ')
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < material.length; i++) {
    const c = material.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0
  }
  return `s_${h1.toString(36)}${h2.toString(36)}`
}

const RATING_ORDER = 'FEDCBA'

function ratingRank(letter: string | null | undefined): number {
  return letter ? RATING_ORDER.indexOf(letter) : -1
}

/**
 * The grade, and why.
 *
 * Four levels, and the distinction between the middle two is the point:
 *
 *  - `confirmed`    — an instrument or the responsible authority measured it.
 *                     A seismograph is not a report about an earthquake.
 *  - `corroborated` — two or more *independent origins*. Not two outlets: two
 *                     origins. This is the level most feeds claim at one.
 *  - `single-source`— one origin said it. Often true, never confirmed.
 *  - `unverified`   — one origin, and a weak one.
 */
function gradeStory(reports: StoryReport[], origins: Set<string>): {
  grade: StoryGrade
  reason: string
} {
  const best = reports.reduce<string | null>(
    (acc, r) => (ratingRank(r.admiralty?.source) > ratingRank(acc) ? r.admiralty?.source ?? acc : acc),
    null,
  )

  if (best === 'A' && reports.some((r) => r.admiralty?.info === 1)) {
    return {
      grade: 'confirmed',
      reason: 'Measured by the responsible authority — this is the record, not a report of it.',
    }
  }
  if (origins.size >= 2) {
    return {
      grade: 'corroborated',
      reason: `${origins.size} independent origins reported it: ${[...origins].join(', ')}.`,
    }
  }
  const only = [...origins][0] ?? 'one source'
  if (ratingRank(best) >= ratingRank('B')) {
    return {
      grade: 'single-source',
      reason: `Only ${only} reported it. Well-regarded, but nothing independent has corroborated it.`,
    }
  }
  return {
    grade: 'unverified',
    reason: `Only ${only} reported it, and it is a secondary source. Treat as a lead, not a fact.`,
  }
}

/**
 * Where a report sits in the independence graph.
 *
 * Falls back to the source key, which is correct for our coded sources — each
 * is its own origin. The important case it encodes is GDELT: fifteen articles
 * from fifteen outlets arrive through **one** index, so they are one origin
 * however many mastheads are involved. Counting them as fifteen would be the
 * exact inflation this platform exists to be the opposite of.
 */
export function originOf(e: Evidence, groups: Record<string, string> = {}): string {
  return groups[e.sourceKey] ?? e.sourceKey
}

function outletOf(e: Evidence): string | null {
  const d = e.data as { domain?: string; outlet?: string } | undefined
  const raw = d?.outlet ?? d?.domain
  return raw && raw.trim() ? raw.trim().toLowerCase() : null
}

function countryOf(e: Evidence): string | null {
  const c = (e.data as { country?: string } | undefined)?.country
  return c && c.trim() ? c.trim() : null
}

function toReport(e: Evidence, groups: Record<string, string>): StoryReport {
  return {
    claim: e.claim,
    sourceKey: e.sourceKey,
    sourceUrl: e.sourceUrl ?? null,
    origin: originOf(e, groups),
    outlet: outletOf(e),
    publishedAt: e.publishedAt ?? null,
    retrievedAt: e.retrievedAt,
    admiralty: e.admiralty ? { source: e.admiralty.source, info: e.admiralty.info } : null,
    country: countryOf(e),
  }
}

/** Milliseconds between two reports' best-known times, or Infinity if unknown. */
function timeGapMs(a: StoryReport, b: StoryReport): number {
  const ta = a.publishedAt ? Date.parse(a.publishedAt) : NaN
  const tb = b.publishedAt ? Date.parse(b.publishedAt) : NaN
  // A report with no stated time cannot be *excluded* by the window — we do not
  // know when it happened, and refusing to merge it would strand exactly the
  // reports that most need a story to belong to.
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0
  return Math.abs(ta - tb)
}

export interface ClusterOptions {
  /** Independence groups keyed by source key. */
  groups?: Record<string, string>
  windowHours?: number
  threshold?: number
}

export function clusterStories(evidence: Evidence[], options: ClusterOptions = {}): Story[] {
  const groups = options.groups ?? {}
  const windowMs = (options.windowHours ?? DEFAULT_WINDOW_HOURS) * 3_600_000
  const threshold = options.threshold ?? MERGE_THRESHOLD

  const reports = evidence.filter((e) => e.claim.trim().length > 0).map((e) => toReport(e, groups))
  if (reports.length === 0) return []

  const docs = reports.map((r) => tokenSet(r.claim))
  const score = buildScorer(docs)

  // Union-find: the clean way to express single-link without a nested rebuild.
  const parent = reports.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const size = new Array(reports.length).fill(1)
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    // The ceiling is checked before the merge, so a runaway chain stops growing
    // rather than being discovered afterwards.
    if (size[ra] + size[rb] > MAX_CLUSTER) return
    parent[rb] = ra
    size[ra] += size[rb]
  }

  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      if (timeGapMs(reports[i], reports[j]) > windowMs) continue
      if (score(docs[i], docs[j]) >= threshold) union(i, j)
    }
  }

  const buckets = new Map<number, StoryReport[]>()
  for (let i = 0; i < reports.length; i++) {
    const root = find(i)
    const list = buckets.get(root) ?? []
    list.push(reports[i])
    buckets.set(root, list)
  }

  return [...buckets.values()].map((group) => {
    // The headline comes from the best-rated report, and where two tie, the
    // longest — a fuller sentence carries more of the story than a stub. It is
    // always a real headline somebody published; we never write one.
    const lead = [...group].sort((a, b) => {
      const r = ratingRank(b.admiralty?.source) - ratingRank(a.admiralty?.source)
      return r !== 0 ? r : b.claim.length - a.claim.length
    })[0]

    const origins = new Set(group.map((r) => r.origin))
    const published = group
      .map((r) => r.publishedAt)
      .filter((t): t is string => Boolean(t) && Number.isFinite(Date.parse(t as string)))
      .sort()
    const { grade, reason } = gradeStory(group, origins)

    return {
      id: storyId(group),
      headline: lead.claim,
      reports: [...group].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')),
      independentOrigins: origins.size,
      outlets: new Set(group.map((r) => r.outlet).filter(Boolean)).size,
      firstReportedAt: published[0] ?? null,
      lastReportedAt: published[published.length - 1] ?? null,
      lastSeenAt: group.map((r) => r.retrievedAt).sort().slice(-1)[0],
      countries: [...new Set(group.map((r) => r.country).filter((c): c is string => Boolean(c)))],
      bestSourceRating: lead.admiralty?.source ?? null,
      grade,
      gradeReason: reason,
    }
  })
}

/**
 * Ranking for a signals board.
 *
 * Corroboration first, then recency — in that order, deliberately. A board
 * ordered purely by time leads with whatever a fast wire published a minute ago
 * and buries the event four agencies independently confirmed an hour ago. That
 * is the wrong way round for anyone making a decision from it.
 *
 * Reports with no stated publication time fall to the bottom of their
 * corroboration band rather than being treated as new.
 */
export function storyOrder(a: Story, b: Story): number {
  const gradeWeight: Record<StoryGrade, number> = {
    confirmed: 3,
    corroborated: 2,
    'single-source': 1,
    unverified: 0,
  }
  const g = gradeWeight[b.grade] - gradeWeight[a.grade]
  if (g !== 0) return g

  const oi = b.independentOrigins - a.independentOrigins
  if (oi !== 0) return oi

  const ta = a.lastReportedAt ? Date.parse(a.lastReportedAt) : -Infinity
  const tb = b.lastReportedAt ? Date.parse(b.lastReportedAt) : -Infinity
  if (ta !== tb) return tb - ta
  return b.lastSeenAt.localeCompare(a.lastSeenAt)
}

export interface StoryAnalysis {
  stories: number
  reports: number
  /** Reports that were the same story seen again. The repetition we removed. */
  duplicatesCollapsed: number
  corroborated: number
  singleSource: number
  confirmed: number
  /** Stories where no source stated when it happened. */
  undated: number
  /** Newest stated publication time across all stories. */
  newestAt: string | null
  /** Oldest stated publication time — how far back the board reaches. */
  oldestAt: string | null
  countries: number
  origins: number
  /** The board in one honest sentence. */
  headline: string
}

export function analyseStories(stories: Story[], reportCount: number): StoryAnalysis {
  const confirmed = stories.filter((s) => s.grade === 'confirmed').length
  const corroborated = stories.filter((s) => s.grade === 'corroborated').length
  const singleSource = stories.filter(
    (s) => s.grade === 'single-source' || s.grade === 'unverified',
  ).length
  const undated = stories.filter((s) => s.lastReportedAt === null).length

  const times = stories
    .flatMap((s) => [s.firstReportedAt, s.lastReportedAt])
    .filter((t): t is string => Boolean(t))
    .sort()

  const countries = new Set(stories.flatMap((s) => s.countries)).size
  const origins = new Set(stories.flatMap((s) => s.reports.map((r) => r.origin))).size
  const duplicatesCollapsed = Math.max(0, reportCount - stories.length)

  const parts: string[] = []
  parts.push(
    `${stories.length} distinct ${stories.length === 1 ? 'story' : 'stories'} from ${reportCount} reports across ${origins} independent ${origins === 1 ? 'origin' : 'origins'}.`,
  )
  if (duplicatesCollapsed > 0) {
    parts.push(
      `${duplicatesCollapsed} ${duplicatesCollapsed === 1 ? 'report was' : 'reports were'} the same story seen again.`,
    )
  }
  // The share that nothing independent has confirmed is the number a reader
  // needs and no comparable feed shows.
  if (singleSource > 0) {
    parts.push(
      `${singleSource} of ${stories.length} rest on a single origin — leads, not facts.`,
    )
  }
  if (undated > 0) {
    parts.push(`${undated} carry no publication date from any source.`)
  }

  return {
    stories: stories.length,
    reports: reportCount,
    duplicatesCollapsed,
    corroborated,
    singleSource,
    confirmed,
    undated,
    newestAt: times[times.length - 1] ?? null,
    oldestAt: times[0] ?? null,
    countries,
    origins,
    headline: parts.join(' '),
  }
}
