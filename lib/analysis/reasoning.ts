import type { Evidence } from '../engine/types'
import { haversineKm } from './fusion'
import { DEFAULT_WINDOW_HOURS, MERGE_THRESHOLD, buildScorer, originOf, tokenize } from './stories'

/**
 * The mechanical reading — analysis without a model.
 *
 * ## The failure this exists to fix
 *
 * Until now the only analyst in this product was a model call. That means the
 * product had no analysis at all for anyone without an API key, and the panel
 * said so out loud: a "not configured" notice sitting under a completed
 * investigation. Every competitor has the same shape — a summarise button over
 * a pile of rows — so the whole category degrades to nothing when the key is
 * absent, and to prose of unknown provenance when it is present.
 *
 * But the interesting part of intelligence analysis is not prose. It is
 * *structural*: how many independent origins support each claim, where sources
 * disagree, how old the picture is, what grade of source it rests on, and what
 * a reader would have to check before acting. All of that is a property of the
 * evidence, and all of it is arithmetic. So it is computed here, from the
 * evidence alone, with no network, no key and no model — the same way
 * `confidence.ts` computes a score rather than asking for one.
 *
 * ## The one rule
 *
 * **Nothing here adds a fact.** Every sentence this module produces is a
 * statement about the shape of the evidence it was handed, and every finding
 * carries `refs` — positions in the evidence array — so a reader can go
 * straight from a claim about the picture to the rows it was derived from. A
 * sentence that cannot be traced back is a sentence this module must not emit.
 *
 * That is also why severity is not graded here. Severity is a judgement about
 * what a claim *means* — whether a sanctions hit is grave, whether a C2 is
 * live — and reading meaning is exactly what a mechanical engine cannot do
 * honestly. This module grades the *evidence*, in `strength`, and leaves risk
 * to a reader or to the model provider that runs alongside it.
 *
 * ## Why it reuses the platform's own primitives
 *
 * Claim identity comes from `stories.ts` (the batch-relative term weighting)
 * and geographic disagreement from `fusion.ts` (the haversine and its merge
 * radius). Building a second notion of "these two claims are the same thing"
 * would let the signals board and the analyst disagree about the same pair of
 * reports, which is worse than either measure alone — the same argument
 * `stories.ts` makes for choosing one measure per batch.
 */

/**
 * A position in the evidence array the reading was built from.
 *
 * Indices rather than copies, deliberately: a finding that carried its own copy
 * of a claim could drift from the evidence it describes, and the reader could
 * no longer tell whether the analyst is quoting or paraphrasing. An index can
 * only ever point at the real row.
 */
export type Ref = number

// ── Thresholds, each with a reason ──────────────────────────────────────────

/** Ages the temporal reading bands on. Hours, then days, because that is how a reader thinks about a picture. */
const FRESH_HOURS = 24
const RECENT_HOURS = 7 * 24
const AGEING_HOURS = 30 * 24

/**
 * A publication time this far *ahead* of retrieval is a clock problem, not news.
 *
 * One hour absorbs ordinary skew and timezone sloppiness in a feed. Beyond
 * that, the source is telling us something was published after we read it,
 * which means one of the two timestamps cannot be trusted — and a picture
 * sorted by time is then sorted by a fiction.
 */
const CLOCK_TOLERANCE_HOURS = 1

/**
 * Relative difference at which two stated numbers stop being rounding.
 *
 * 5% keeps M6.10 and M6.14 as one measurement — different agencies solve the
 * same quake to different precisions — while 3 dead and 12 dead is reported as
 * the disagreement it is.
 */
const QUANTITY_TOLERANCE = 0.05

/**
 * Kilometres at which two placements of one claim contradict each other.
 *
 * The same radius `fusion.ts` uses to judge two reports the same event, for the
 * same reason: agencies name the nearest settlement and routinely differ by
 * tens of kilometres. Past it they are not being imprecise about one place,
 * they are naming two.
 */
const LOCATION_DISAGREEMENT_KM = 100

/**
 * Share of a picture that one class of source must carry before it is called a
 * monoculture.
 *
 * Not 1.0. A nineteen-headline picture with one official bulletin in it is a
 * press picture, and calling it mixed because of the one exception would hide
 * precisely the weakness the reader needs. Not lower either, because a picture
 * genuinely built on two classes is a different and better thing.
 */
const MONOCULTURE_SHARE = 0.9

/** Below this many findings, "what is this picture built on" has no answer worth stating. */
const MIN_FOR_MIX = 3

/** An origin supplying more than half of everything is a single point of failure. */
const DOMINANT_SHARE = 0.5

/** What a picture needs before the reading calls it strong. */
const STRONG_CORROBORATED_SHARE = 0.5
const STRONG_MIN_ORIGINS = 3

/** Above this share resting on one origin each, the picture is thin however large it is. */
const THIN_UNCORROBORATED_SHARE = 0.8

/** Lists shown to a human are capped; the counts are always exact. */
const MAX_LISTED = 8

// ── Origins ─────────────────────────────────────────────────────────────────

/**
 * Which independence group a piece of evidence belongs to.
 *
 * Three sources of truth, in order of authority: the group the source declared
 * on the evidence itself (the catalogue puts it there, and the world pipeline
 * carries it through), then a group table supplied by the caller, then the
 * source key — which is correct rather than lossy, because a source declaring
 * no group **is** its own group.
 *
 * This is the number that decides corroboration, so it is worth being exact:
 * fifteen outlets arriving through one index are one origin however many
 * mastheads are involved.
 */
export function resolveOrigin(e: Evidence, groups: Record<string, string> = {}): string {
  const declared = (e.data as { independence?: unknown } | undefined)?.independence
  if (typeof declared === 'string' && declared.trim()) return declared.trim()
  return originOf(e, groups)
}

// ── Claim identity ──────────────────────────────────────────────────────────

/**
 * How well a claim is supported, in three states rather than two.
 *
 * The middle one is the whole point. A claim carried by nine reports that all
 * came through one wire looks corroborated on every feed in this field and is
 * not corroborated at all; separating `repeated` from `corroborated` is the
 * difference between counting reports and counting confirmations.
 */
export type ClaimSupport = 'corroborated' | 'repeated' | 'single'

export interface ClaimGroup {
  /** The claim as its best-supported source stated it. Never rewritten by us. */
  statement: string
  refs: Ref[]
  /** Independent origins behind it — not reports. */
  origins: string[]
  support: ClaimSupport
  /** Why it got that support level, in words a reader can check against `refs`. */
  reading: string
}

/**
 * Group evidence into distinct claims.
 *
 * The measure is `stories.ts`'s, unchanged, because "are these two the same
 * assertion" must mean one thing across the product. What is different here is
 * that the grouping carries **indices**: the analyst has to be able to point at
 * the exact rows behind every sentence, and a cluster of copied claim strings
 * cannot do that.
 *
 * The time window applies only where both sides state a time. Two undated
 * records cannot be separated by a window, and refusing to group them would
 * strand exactly the evidence that most needs a home.
 */
export function groupClaims(
  evidence: Evidence[],
  options: { groups?: Record<string, string>; windowHours?: number; threshold?: number } = {},
): ClaimGroup[] {
  const groups = options.groups ?? {}
  const windowMs = (options.windowHours ?? DEFAULT_WINDOW_HOURS) * 3_600_000
  const threshold = options.threshold ?? MERGE_THRESHOLD

  const usable = evidence
    .map((e, index) => ({ e, index }))
    .filter(({ e }) => typeof e.claim === 'string' && e.claim.trim().length > 0)
  if (usable.length === 0) return []

  const docs = usable.map(({ e }) => new Set(tokenize(e.claim)))
  const score = buildScorer(docs)

  // Union-find over positions in `usable`, the same single-link shape the
  // signals board uses. Single-link is right for the same reason: a claim
  // restated at two removes is still the claim.
  const parent = usable.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const ti = usable[i].e.publishedAt ? Date.parse(usable[i].e.publishedAt as string) : NaN
      const tj = usable[j].e.publishedAt ? Date.parse(usable[j].e.publishedAt as string) : NaN
      // Both dated and far apart: the same words about two different moments
      // are two claims. An A record in 2019 does not corroborate one from 2026.
      if (Number.isFinite(ti) && Number.isFinite(tj) && Math.abs(ti - tj) > windowMs) continue
      if (score(docs[i], docs[j]) >= threshold) union(i, j)
    }
  }

  const buckets = new Map<number, number[]>()
  for (let i = 0; i < usable.length; i++) {
    const root = find(i)
    const list = buckets.get(root) ?? []
    list.push(i)
    buckets.set(root, list)
  }

  return [...buckets.values()].map((members) => {
    const refs = members.map((i) => usable[i].index)
    const origins = [...new Set(refs.map((r) => resolveOrigin(evidence[r], groups)))].sort()
    // The statement shown is the longest claim in the group, because a fuller
    // sentence carries more of what the group is about than a stub does — and
    // because it is always a sentence a source actually published.
    const statement = refs
      .map((r) => evidence[r].claim.trim())
      .sort((a, b) => b.length - a.length)[0]

    const support: ClaimSupport =
      origins.length >= 2 ? 'corroborated' : refs.length >= 2 ? 'repeated' : 'single'

    return {
      statement,
      refs: refs.sort((a, b) => a - b),
      origins,
      support,
      reading:
        support === 'corroborated'
          ? `${origins.length} independent origins state this: ${origins.join(', ')}.`
          : support === 'repeated'
            ? `${refs.length} reports, all from ${origins[0]}. That is repetition, not corroboration.`
            : `Only ${origins[0]} states this. Often true, never confirmed.`,
    }
  })
}

export interface CorroborationReading {
  groups: ClaimGroup[]
  /** Distinct claims after grouping — not rows. */
  distinctClaims: number
  corroborated: number
  repeated: number
  single: number
  /** 0–1: the share of the picture nothing independent supports. */
  uncorroboratedShare: number
  reading: string
}

/** Corroboration, ordered so the reader meets the weakest support last and the strongest first. */
export function readCorroboration(groups: ClaimGroup[]): CorroborationReading {
  const rank: Record<ClaimSupport, number> = { corroborated: 0, repeated: 1, single: 2 }
  const ordered = [...groups].sort(
    (a, b) => rank[a.support] - rank[b.support] || b.origins.length - a.origins.length,
  )

  const corroborated = groups.filter((g) => g.support === 'corroborated').length
  const repeated = groups.filter((g) => g.support === 'repeated').length
  const single = groups.filter((g) => g.support === 'single').length
  const uncorroborated = repeated + single
  const share = groups.length === 0 ? 0 : uncorroborated / groups.length

  const parts: string[] = []
  if (groups.length === 0) {
    parts.push('No claims to weigh.')
  } else {
    parts.push(
      `${groups.length} distinct ${groups.length === 1 ? 'claim' : 'claims'}, ${corroborated} supported by two or more independent origins.`,
    )
    if (repeated > 0) {
      // The sentence the rest of the field never prints.
      parts.push(
        `${repeated} ${repeated === 1 ? 'is' : 'are'} carried by several reports that all trace to one origin — repetition, which reads as corroboration and is not.`,
      )
    }
    if (single > 0) {
      parts.push(`${single} rest${single === 1 ? 's' : ''} on a single report.`)
    }
  }

  return {
    groups: ordered,
    distinctClaims: groups.length,
    corroborated,
    repeated,
    single,
    uncorroboratedShare: share,
    reading: parts.join(' '),
  }
}

// ── Contradiction ───────────────────────────────────────────────────────────

/**
 * The three disagreements this engine can find without reading meaning.
 *
 *  - `quantity` — the sources state different numbers for the same thing.
 *  - `location` — they place the same claim in two places.
 *  - `polarity` — one asserts what another denies.
 *
 * Nothing here resolves a disagreement. Where sources disagree, the finding is
 * *that they disagree*; silently taking a majority would be an editorial
 * decision presented as an observation, which `fusion.ts` refuses for the same
 * reason.
 */
export type ContradictionKind = 'quantity' | 'location' | 'polarity'

export interface ContradictionFinding {
  kind: ContradictionKind
  /** What is disagreed about — the quantity's name, or the claim itself. */
  subject: string
  detail: string
  refs: Ref[]
  /** The origins on either side, so a reader can weigh them. */
  origins: string[]
}

/**
 * A number a claim states, with the words on either side of it.
 *
 * ## Why both neighbours, and not one
 *
 * A number means nothing without the word attached to it, and English attaches
 * that word on either side depending on the sentence: "magnitude 6.1" puts it
 * in front, "12 dead" puts it behind. Choosing one side would silently fail on
 * half of all claims — "earthquake of magnitude 5.4" and "magnitude 6.1
 * earthquake" would key on `recorded` and `earthquake` and never be compared,
 * which is the failure that matters most because it is invisible.
 *
 * So both neighbours are kept and two numbers are comparable when their
 * contexts **overlap**. That needs no units table, no grammar and no language
 * list, and it is enough to stop a death toll being weighed against a wind
 * speed.
 *
 * ## Two deliberate refusals
 *
 *  - a number whose only neighbours are function words is dropped, because
 *    "in 3" says nothing about what the 3 counts;
 *  - a bare four-digit number in the calendar band is dropped, because a year
 *    read as a quantity turns a disagreement about *when* into a fabricated
 *    disagreement about *how much*. Dates are the temporal reading's job.
 *
 * Both lose the occasional real quantity. The asymmetry is chosen: a missed
 * contradiction leaves the picture as it was, an invented one sends a reader
 * to check something nobody disputed.
 */
const QUANTITY_KEY_STOP = new Set([
  'in', 'on', 'at', 'of', 'to', 'by', 'the', 'a', 'an', 'and', 'or', 'for',
  'from', 'with', 'is', 'was', 'are', 'were', 'as', 'it', 'no', 'about',
])

export interface Quantity {
  value: number
  /** The word immediately before the number, where it carries meaning. */
  before: string | null
  /** The word immediately after it — the unit position in "12 dead". */
  after: string | null
}

export function quantities(text: string): Quantity[] {
  // Thousands separators first, so "1,200 dead" is 1200 and not 1 and 200.
  const flattened = text.replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
  const parts = flattened.toLowerCase().normalize('NFKC').match(/\p{L}+|\d+(?:\.\d+)?/gu) ?? []
  const word = (raw: string | undefined): string | null =>
    raw && /^\p{L}/u.test(raw) && !QUANTITY_KEY_STOP.has(raw) ? raw : null

  const out: Quantity[] = []
  for (let i = 0; i < parts.length; i++) {
    if (!/^\d/.test(parts[i])) continue
    const value = Number(parts[i])
    if (!Number.isFinite(value)) continue
    // A bare year is a date wearing a number's clothes.
    if (Number.isInteger(value) && value >= 1500 && value <= 2200 && !parts[i].includes('.')) continue

    const before = word(parts[i - 1])
    const after = word(parts[i + 1])
    if (before === null && after === null) continue
    out.push({ value, before, after })
  }
  return out
}

/**
 * What two numbers are both about, if anything.
 *
 * The unit position wins when both sides agree on it, because in "12 dead" and
 * "40 dead" the word after the number is the thing being counted and it is the
 * label a reader needs to see. Otherwise any shared context word will do, taken
 * alphabetically so the same evidence always names the same subject.
 */
function sharedSubject(a: Quantity, b: Quantity): string | null {
  const contextA = [a.before, a.after].filter((w): w is string => w !== null)
  const contextB = new Set([b.before, b.after].filter((w): w is string => w !== null))
  const shared = contextA.filter((w) => contextB.has(w))
  if (shared.length === 0) return null
  return shared.find((w) => w === a.after || w === b.after) ?? [...shared].sort()[0]
}

/**
 * Words that flip a claim.
 *
 * English only, and that is a real limit stated rather than tuned around: a
 * negation list cannot be derived from a batch the way term weighting can, so
 * unlike claim identity this detector genuinely does not work in every
 * language. It fires conservatively — only between two different origins whose
 * claims already matched as one assertion — so where it is blind the reading
 * simply loses a finding rather than gaining a false one.
 */
const NEGATIONS = new Set([
  'no', 'not', 'never', 'none', 'without', 'denies', 'denied', 'denial',
  'refutes', 'refuted', 'rejects', 'rejected', 'false', 'absent', 'nothing',
  'cannot', 'unaffected', 'unharmed',
])

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function point(e: Evidence): { lat: number; lon: number } | null {
  const d = e.data as { lat?: unknown; lon?: unknown } | undefined
  const lat = num(d?.lat)
  const lon = num(d?.lon)
  if (lat === null || lon === null) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

/**
 * Find where the sources disagree.
 *
 * Only **within a claim group**, and only **between different origins**. Both
 * restrictions are load-bearing. Comparing numbers across unrelated claims
 * would report an earthquake's magnitude against a share price; comparing one
 * origin against itself reports a feed correcting its own bulletin, which is a
 * source doing its job and not a contradiction between sources.
 */
export function findDisagreements(
  evidence: Evidence[],
  groups: ClaimGroup[],
  options: { groupTable?: Record<string, string> } = {},
): ContradictionFinding[] {
  const table = options.groupTable ?? {}
  const out: ContradictionFinding[] = []

  for (const group of groups) {
    if (group.refs.length < 2) continue

    const rows = group.refs.map((ref) => ({
      ref,
      e: evidence[ref],
      origin: resolveOrigin(evidence[ref], table),
    }))

    // ── quantity ──
    //
    // The **worst** disagreement in the group, and only that one. A group of
    // twelve reports about one flood would otherwise yield a page of pairings
    // of the same dispute, burying the location and polarity findings under it
    // — the same reason `fusion.ts` reports its widest location gap and stops.
    const stated = rows.map((row) => {
      const list = quantities(row.e.claim)
      const magnitude = num((row.e.data as { magnitude?: unknown } | undefined)?.magnitude)
      // A magnitude the source put in a structured field is a stated number
      // like any other, and it is the one an agency is most careful about.
      if (magnitude !== null) list.push({ value: magnitude, before: 'magnitude', after: null })
      return { ...row, list }
    })

    let worstQuantity: {
      subject: string
      relative: number
      low: { ref: Ref; origin: string; value: number }
      high: { ref: Ref; origin: string; value: number }
    } | null = null

    for (let i = 0; i < stated.length; i++) {
      for (let j = i + 1; j < stated.length; j++) {
        // Between origins only: a feed correcting its own bulletin is a source
        // doing its job, not two sources disagreeing.
        if (stated[i].origin === stated[j].origin) continue
        for (const qa of stated[i].list) {
          for (const qb of stated[j].list) {
            const subject = sharedSubject(qa, qb)
            if (!subject) continue
            const scale = Math.max(Math.abs(qa.value), Math.abs(qb.value))
            if (scale === 0) continue
            const relative = Math.abs(qa.value - qb.value) / scale
            if (relative <= QUANTITY_TOLERANCE) continue
            if (worstQuantity && relative <= worstQuantity.relative) continue
            const a = { ref: stated[i].ref, origin: stated[i].origin, value: qa.value }
            const b = { ref: stated[j].ref, origin: stated[j].origin, value: qb.value }
            worstQuantity = {
              subject,
              relative,
              low: a.value <= b.value ? a : b,
              high: a.value <= b.value ? b : a,
            }
          }
        }
      }
    }

    if (worstQuantity) {
      const { subject, low, high } = worstQuantity
      out.push({
        kind: 'quantity',
        subject,
        detail: `Sources state ${low.value} and ${high.value} for "${subject}".`,
        refs: [low.ref, high.ref].sort((a, b) => a - b),
        origins: [low.origin, high.origin],
      })
    }

    // ── location ──
    const placed = rows
      .map((row) => ({ ...row, at: point(row.e) }))
      .filter((row): row is typeof row & { at: { lat: number; lon: number } } => row.at !== null)
    let worst = 0
    let pair: [(typeof placed)[number], (typeof placed)[number]] | null = null
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        if (placed[i].origin === placed[j].origin) continue
        const d = haversineKm(placed[i].at.lat, placed[i].at.lon, placed[j].at.lat, placed[j].at.lon)
        if (d > worst) {
          worst = d
          pair = [placed[i], placed[j]]
        }
      }
    }
    if (pair && worst > LOCATION_DISAGREEMENT_KM) {
      out.push({
        kind: 'location',
        subject: 'location',
        detail: `The same claim is placed ${Math.round(worst)} km apart by two origins.`,
        refs: [pair[0].ref, pair[1].ref].sort((a, b) => a - b),
        origins: [pair[0].origin, pair[1].origin],
      })
    }

    // ── polarity ──
    // One side carries a negation the other does not, and they are not the same
    // origin. Anything looser reports every hedged sentence as a dispute.
    const polarity = rows.map((row) => ({
      ...row,
      negative: tokenize(row.e.claim).some((t) => NEGATIONS.has(t)),
    }))
    const negated = polarity.filter((row) => row.negative)
    const asserted = polarity.filter((row) => !row.negative)
    for (const denial of negated) {
      const other = asserted.find((a) => a.origin !== denial.origin)
      if (!other) continue
      out.push({
        kind: 'polarity',
        subject: group.statement,
        detail: `${denial.origin} states this in the negative while ${other.origin} states it in the affirmative.`,
        refs: [denial.ref, other.ref].sort((a, b) => a - b),
        origins: [denial.origin, other.origin],
      })
      // One polarity finding per claim. Listing every pairing of the same
      // disagreement would bury the other findings under one dispute.
      break
    }
  }

  return out
}

// ── Time ────────────────────────────────────────────────────────────────────

export interface TemporalReading {
  /** The clock the reading was taken against, so it can be reproduced. */
  now: string
  newestPublishedAt: string | null
  oldestPublishedAt: string | null
  /** Age of the newest stated publication, in hours. Null when nothing is dated. */
  newestAgeHours: number | null
  /** How far back the dated evidence reaches, in hours. */
  spanHours: number | null
  fresh: Ref[]
  recent: Ref[]
  ageing: Ref[]
  stale: Ref[]
  /** Evidence no source dated. Not old — un-ageable, which is a different thing. */
  undated: Ref[]
  /** Evidence claiming to have been published after we read it. A clock fault. */
  impossible: Ref[]
  reading: string
}

function hoursSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? (now - t) / 3_600_000 : null
}

/**
 * What is new, what is old, and what cannot be aged at all.
 *
 * The third category is the one that matters and the one every feed erases by
 * defaulting a missing publication date to the retrieval time. That single
 * default turns a five-year-old report into breaking news, so here an undated
 * finding is counted as undated and never as fresh — `Evidence.publishedAt`
 * exists precisely so this distinction survives.
 */
export function readTime(evidence: Evidence[], now: number): TemporalReading {
  const fresh: Ref[] = []
  const recent: Ref[] = []
  const ageing: Ref[] = []
  const stale: Ref[] = []
  const undated: Ref[] = []
  const impossible: Ref[] = []
  const dated: number[] = []

  evidence.forEach((e, ref) => {
    const age = hoursSince(e.publishedAt, now)
    if (age === null) {
      undated.push(ref)
      return
    }
    const published = Date.parse(e.publishedAt as string)
    const retrieved = Date.parse(e.retrievedAt)
    if (
      Number.isFinite(retrieved) &&
      (published - retrieved) / 3_600_000 > CLOCK_TOLERANCE_HOURS
    ) {
      impossible.push(ref)
    }
    dated.push(published)
    if (age <= FRESH_HOURS) fresh.push(ref)
    else if (age <= RECENT_HOURS) recent.push(ref)
    else if (age <= AGEING_HOURS) ageing.push(ref)
    else stale.push(ref)
  })

  const newest = dated.length ? Math.max(...dated) : null
  const oldest = dated.length ? Math.min(...dated) : null

  const parts: string[] = []
  if (newest !== null) {
    const age = (now - newest) / 3_600_000
    parts.push(`Newest evidence ${describeAge(age)}.`)
    if (oldest !== null && oldest !== newest) {
      parts.push(`The picture reaches back ${describeAge((now - oldest) / 3_600_000)}.`)
    }
    if (stale.length > 0) {
      parts.push(`${stale.length} of ${evidence.length} findings are over a month old.`)
    }
  }
  if (undated.length > 0) {
    parts.push(
      `${undated.length} of ${evidence.length} ${undated.length === 1 ? 'finding carries' : 'findings carry'} no publication date and cannot be aged — that is unknown age, not recent.`,
    )
  }
  if (impossible.length > 0) {
    parts.push(
      `${impossible.length} ${impossible.length === 1 ? 'source dates its report' : 'sources date their reports'} after we retrieved them; one of the two timestamps is wrong.`,
    )
  }
  if (parts.length === 0) parts.push('Nothing here carries a time.')

  return {
    now: new Date(now).toISOString(),
    newestPublishedAt: newest === null ? null : new Date(newest).toISOString(),
    oldestPublishedAt: oldest === null ? null : new Date(oldest).toISOString(),
    newestAgeHours: newest === null ? null : (now - newest) / 3_600_000,
    spanHours: newest === null || oldest === null ? null : (newest - oldest) / 3_600_000,
    fresh,
    recent,
    ageing,
    stale,
    undated,
    impossible,
    reading: parts.join(' '),
  }
}

/** Ages in the words a reader uses, not in decimal hours. */
function describeAge(hours: number): string {
  if (hours < 0) return 'is dated in the future'
  if (hours < 1) return 'is under an hour old'
  if (hours < 48) return `is ${Math.round(hours)} hours old`
  const days = Math.round(hours / 24)
  if (days < 60) return `is ${days} days old`
  return `is ${Math.round(days / 30)} months old`
}

// ── Source mix ──────────────────────────────────────────────────────────────

/**
 * What kind of source a finding came from, read off the Admiralty letter.
 *
 *  - `instrument` (A) — an agency publishing its own measurement. A seismograph
 *    is not a report about an earthquake.
 *  - `official`   (B) — an established institution inside its remit.
 *  - `reporting`  (C) — a reputable outlet relaying somebody else's work.
 *  - `unrated`    (D–F, or no rating) — a source we cannot vouch for.
 */
export type SourceClass = 'instrument' | 'official' | 'reporting' | 'unrated'

export const SOURCE_CLASS_LABEL: Record<SourceClass, string> = {
  instrument: 'measured by an agency',
  official: 'official institutions',
  reporting: 'press reporting',
  unrated: 'ungraded sources',
}

export function sourceClassOf(e: Evidence): SourceClass {
  switch (e.admiralty?.source) {
    case 'A':
      return 'instrument'
    case 'B':
      return 'official'
    case 'C':
      return 'reporting'
    default:
      return 'unrated'
  }
}

export interface SourceMix {
  total: number
  origins: string[]
  byClass: Record<SourceClass, { count: number; share: number; refs: Ref[] }>
  /** The origin supplying most of this picture, when one does. */
  dominant: { origin: string; count: number; share: number } | null
  /** Set when one class carries essentially the whole picture. */
  monoculture: SourceClass | null
  reading: string
}

/**
 * What the picture is built on.
 *
 * A conclusion resting entirely on one grade of source is a finding in itself,
 * and it is invisible on a screen that lists rows: nineteen headlines look like
 * nineteen pieces of evidence, and they are nineteen retellings of somebody
 * else's work. Naming the mix is what lets a reader ask the right question —
 * "has anyone actually measured this?" — before acting on any of it.
 */
export function readSourceMix(
  evidence: Evidence[],
  options: { groups?: Record<string, string> } = {},
): SourceMix {
  const table = options.groups ?? {}
  const byClass: Record<SourceClass, { count: number; share: number; refs: Ref[] }> = {
    instrument: { count: 0, share: 0, refs: [] },
    official: { count: 0, share: 0, refs: [] },
    reporting: { count: 0, share: 0, refs: [] },
    unrated: { count: 0, share: 0, refs: [] },
  }
  const perOrigin = new Map<string, number>()

  evidence.forEach((e, ref) => {
    const cls = sourceClassOf(e)
    byClass[cls].count += 1
    byClass[cls].refs.push(ref)
    const origin = resolveOrigin(e, table)
    perOrigin.set(origin, (perOrigin.get(origin) ?? 0) + 1)
  })

  const total = evidence.length
  for (const cls of Object.keys(byClass) as SourceClass[]) {
    byClass[cls].share = total === 0 ? 0 : byClass[cls].count / total
  }

  const origins = [...perOrigin.keys()].sort()
  const top = [...perOrigin.entries()].sort((a, b) => b[1] - a[1])[0]
  const dominant =
    top && total > 0 && top[1] / total > DOMINANT_SHARE && origins.length > 1
      ? { origin: top[0], count: top[1], share: top[1] / total }
      : null

  const monoculture =
    total >= MIN_FOR_MIX
      ? ((Object.keys(byClass) as SourceClass[]).find(
          (cls) => byClass[cls].share >= MONOCULTURE_SHARE,
        ) ?? null)
      : null

  const parts: string[] = []
  if (total === 0) {
    parts.push('No sources to weigh.')
  } else {
    const present = (Object.keys(byClass) as SourceClass[])
      .filter((cls) => byClass[cls].count > 0)
      .sort((a, b) => byClass[b].count - byClass[a].count)
      .map((cls) => `${byClass[cls].count} ${SOURCE_CLASS_LABEL[cls]}`)
    parts.push(
      `${total} ${total === 1 ? 'finding' : 'findings'} from ${origins.length} independent ${origins.length === 1 ? 'origin' : 'origins'}: ${present.join(', ')}.`,
    )
    if (monoculture === 'reporting') {
      parts.push('Nothing here was measured — this picture is entirely press reporting.')
    } else if (monoculture === 'unrated') {
      parts.push('Every source here is ungraded; nothing in this picture can be weighted by reliability.')
    } else if (monoculture === 'instrument') {
      parts.push('This picture is entirely agency measurement, with no independent reporting against it.')
    } else if (monoculture === 'official') {
      parts.push('This picture is entirely official statements, with nothing independent against them.')
    }
    if (dominant) {
      parts.push(
        `${dominant.origin} alone supplies ${Math.round(dominant.share * 100)}% of it — if that one origin is wrong, most of this is wrong with it.`,
      )
    }
    if (origins.length === 1 && total > 1) {
      parts.push('Everything here traces to one origin.')
    }
  }

  return { total, origins, byClass, dominant, monoculture, reading: parts.join(' ') }
}

// ── Gaps ────────────────────────────────────────────────────────────────────

/**
 * The honest gaps.
 *
 * Every one is derived from a weakness the evidence itself exhibits, and every
 * one names a **passive** check — read another public record — because a
 * suggestion to probe a target would breach the guarantee this whole platform
 * is built on (charter §3). Nothing here is a generic caution: if the evidence
 * has no such weakness, the gap does not appear.
 */
export type GapKind =
  | 'nothing-collected'
  | 'contested'
  | 'single-origin'
  | 'uncorroborated'
  | 'monoculture'
  | 'stale'
  | 'undated'
  | 'unlinked'
  | 'ungraded'
  | 'weak-confidence'
  | 'clock'

export interface Gap {
  kind: GapKind
  /** The weakness, stated as a fact about the evidence. */
  detail: string
  /** The passive check that would close it. */
  check: string
  refs: Ref[]
}

/** Worst first: a reader who stops after two gaps must have read the two that matter. */
const GAP_ORDER: Record<GapKind, number> = {
  'nothing-collected': 0,
  contested: 1,
  'single-origin': 2,
  uncorroborated: 3,
  monoculture: 4,
  clock: 5,
  stale: 6,
  undated: 7,
  unlinked: 8,
  ungraded: 9,
  'weak-confidence': 10,
}

function readGaps(
  evidence: Evidence[],
  corroboration: CorroborationReading,
  contradictions: ContradictionFinding[],
  temporal: TemporalReading,
  mix: SourceMix,
): Gap[] {
  const gaps: Gap[] = []

  if (evidence.length === 0) {
    // The most important single sentence in this module. An empty result is a
    // statement about our coverage, never about the subject.
    gaps.push({
      kind: 'nothing-collected',
      detail: 'No evidence was collected.',
      check:
        'Treat this as a gap in our coverage, not as a finding about the subject. Check which sources were reachable before drawing anything from the silence.',
      refs: [],
    })
    return gaps
  }

  for (const c of contradictions) {
    gaps.push({
      kind: 'contested',
      detail: c.detail,
      check: `Read both origins' own publications (${c.origins.join(' and ')}) and decide which to carry — do not average them.`,
      refs: c.refs,
    })
  }

  if (mix.origins.length === 1 && evidence.length > 1) {
    gaps.push({
      kind: 'single-origin',
      detail: `All ${evidence.length} findings come from one origin (${mix.origins[0]}).`,
      check: 'Find a second, genuinely unrelated public source before treating any of this as established.',
      refs: evidence.map((_, i) => i),
    })
  }

  const unsupported = corroboration.groups.filter((g) => g.support !== 'corroborated')
  if (unsupported.length > 0 && mix.origins.length > 1) {
    gaps.push({
      kind: 'uncorroborated',
      detail: `${unsupported.length} of ${corroboration.distinctClaims} claims have no independent support${
        corroboration.repeated > 0
          ? `, and ${corroboration.repeated} of those only look supported because one origin was republished`
          : ''
      }.`,
      check: 'Take the claims a decision rests on and look for each in a source with a different owner and a different collection method.',
      refs: unsupported.flatMap((g) => g.refs).slice(0, MAX_LISTED * 4),
    })
  }

  if (mix.monoculture) {
    gaps.push({
      kind: 'monoculture',
      detail: `${Math.round(mix.byClass[mix.monoculture].share * 100)}% of this picture is ${SOURCE_CLASS_LABEL[mix.monoculture]}.`,
      check:
        mix.monoculture === 'reporting' || mix.monoculture === 'unrated'
          ? 'Look for a primary record — a register, a filing, or an agency bulletin — that states the same thing.'
          : 'Look for independent reporting or a second authority covering the same ground.',
      refs: mix.byClass[mix.monoculture].refs.slice(0, MAX_LISTED * 4),
    })
  }

  if (temporal.impossible.length > 0) {
    gaps.push({
      kind: 'clock',
      detail: `${temporal.impossible.length} ${temporal.impossible.length === 1 ? 'finding is' : 'findings are'} dated after we retrieved them.`,
      check: 'Check the publication times against the source page before ordering anything by time.',
      refs: temporal.impossible,
    })
  }

  if (temporal.stale.length > 0 && temporal.newestAgeHours !== null && temporal.newestAgeHours > AGEING_HOURS) {
    gaps.push({
      kind: 'stale',
      detail: `Nothing here was published in the last month; the newest finding ${describeAge(temporal.newestAgeHours)}.`,
      check: 'Re-run the collection, or check whether the sources that would carry an update are reachable.',
      refs: temporal.stale.slice(0, MAX_LISTED * 4),
    })
  }

  if (temporal.undated.length > 0) {
    gaps.push({
      kind: 'undated',
      detail: `${temporal.undated.length} of ${evidence.length} findings carry no publication date.`,
      check: 'Open each source and read its own date before treating the finding as current.',
      refs: temporal.undated,
    })
  }

  const unlinked = evidence.map((e, i) => (e.sourceUrl ? -1 : i)).filter((i) => i >= 0)
  if (unlinked.length > 0) {
    gaps.push({
      kind: 'unlinked',
      detail: `${unlinked.length} of ${evidence.length} findings carry no link back to the source.`,
      check: 'These cannot be audited from the report alone — go to the named source directly to confirm them.',
      refs: unlinked,
    })
  }

  const ungraded = mix.byClass.unrated.refs
  if (ungraded.length > 0 && mix.monoculture !== 'unrated') {
    gaps.push({
      kind: 'ungraded',
      detail: `${ungraded.length} of ${evidence.length} findings come from sources with no Admiralty rating.`,
      check: 'Weigh these lowest until the source has a track record you can point at.',
      refs: ungraded,
    })
  }

  const weak = evidence
    .map((e, i) => (e.confidence === 'possible' || e.confidence === 'unconfirmed' ? i : -1))
    .filter((i) => i >= 0)
  if (weak.length > evidence.length / 2) {
    gaps.push({
      kind: 'weak-confidence',
      detail: `${weak.length} of ${evidence.length} findings are graded only possible or unconfirmed.`,
      check: 'Any decision resting on this picture is resting mostly on leads. Confirm the specific claims it turns on.',
      refs: weak,
    })
  }

  return gaps.sort((a, b) => GAP_ORDER[a.kind] - GAP_ORDER[b.kind])
}

// ── The reading ─────────────────────────────────────────────────────────────

/**
 * How much weight this picture can bear.
 *
 * About our *support* for the claims, never about whether they are true —
 * the same vocabulary discipline `confidence.ts` keeps. `contested` outranks
 * everything because sources disagreeing means the picture is not established,
 * however much of it there is.
 */
export type ReadingStrength = 'contested' | 'thin' | 'mixed' | 'strong'

export interface EvidenceReading {
  generatedAt: string
  findings: number
  corroboration: CorroborationReading
  contradictions: ContradictionFinding[]
  temporal: TemporalReading
  sourceMix: SourceMix
  gaps: Gap[]
  strength: ReadingStrength
  strengthReason: string
  /** The bottom line, sentence by sentence, each drawn from a section above. */
  bottomLine: string[]
}

export interface ReadingOptions {
  /** Independence groups keyed by source key, where the evidence does not carry one. */
  groups?: Record<string, string>
  /**
   * The clock, injected. A reading that depends on the wall clock cannot be
   * asserted in a test, and an analysis nobody can assert is one nobody should
   * act on — the same argument `scoreConfidence` makes.
   */
  now?: number
}

/**
 * Read a body of evidence.
 *
 * Deterministic: the same evidence and the same clock always give the same
 * reading, which is what makes it arguable. A reader who disagrees with a
 * sentence can follow its `refs` to the rows behind it and check the arithmetic
 * — and an analysis that cannot be checked is one nobody should act on.
 */
export function readEvidence(evidence: Evidence[], options: ReadingOptions = {}): EvidenceReading {
  const now = options.now ?? Date.now()
  const groups = options.groups ?? {}
  // A row with no claim asserts nothing, so it is dropped here rather than
  // counted in one section and skipped in another — a reading whose "17
  // findings" and "14 claims" come from different populations is a reading
  // whose arithmetic cannot be followed.
  const rows = Array.isArray(evidence)
    ? evidence.filter((e) => e && typeof e.claim === 'string' && e.claim.trim().length > 0)
    : []

  const claims = groupClaims(rows, { groups })
  const corroboration = readCorroboration(claims)
  const contradictions = findDisagreements(rows, claims, { groupTable: groups })
  const temporal = readTime(rows, now)
  const sourceMix = readSourceMix(rows, { groups })
  const gaps = readGaps(rows, corroboration, contradictions, temporal, sourceMix)

  const { strength, reason } = gradeStrength(rows.length, corroboration, contradictions, sourceMix, temporal)

  const bottomLine: string[] = []
  if (rows.length === 0) {
    bottomLine.push(
      'Nothing was collected. That is a statement about our coverage of this subject, not about the subject — absence of evidence is not evidence of absence.',
    )
  } else {
    bottomLine.push(reason)
    bottomLine.push(corroboration.reading)
    bottomLine.push(sourceMix.reading)
    bottomLine.push(temporal.reading)
    if (contradictions.length > 0) {
      bottomLine.push(
        `${contradictions.length} ${contradictions.length === 1 ? 'disagreement' : 'disagreements'} between sources: ${contradictions
          .slice(0, MAX_LISTED)
          .map((c) => c.detail)
          .join(' ')}`,
      )
    }
  }

  return {
    generatedAt: new Date(now).toISOString(),
    findings: rows.length,
    corroboration,
    contradictions,
    temporal,
    sourceMix,
    gaps,
    strength,
    strengthReason: reason,
    bottomLine: bottomLine.filter((s) => s.trim().length > 0),
  }
}

function gradeStrength(
  total: number,
  corroboration: CorroborationReading,
  contradictions: ContradictionFinding[],
  mix: SourceMix,
  temporal: TemporalReading,
): { strength: ReadingStrength; reason: string } {
  if (total === 0) {
    return { strength: 'thin', reason: 'Nothing was collected, so there is nothing to weigh.' }
  }
  if (contradictions.length > 0) {
    return {
      strength: 'contested',
      reason: 'Sources disagree with each other here, so the picture is not settled however much of it there is.',
    }
  }
  if (mix.origins.length <= 1) {
    return {
      strength: 'thin',
      reason: 'Everything here comes from one origin, so nothing in it has been independently confirmed.',
    }
  }
  if (corroboration.uncorroboratedShare >= THIN_UNCORROBORATED_SHARE) {
    return {
      strength: 'thin',
      reason: `${Math.round(corroboration.uncorroboratedShare * 100)}% of the claims rest on a single origin each — this is a set of leads rather than an established picture.`,
    }
  }
  const corroboratedShare =
    corroboration.distinctClaims === 0 ? 0 : corroboration.corroborated / corroboration.distinctClaims
  const dated = temporal.undated.length < total
  if (
    corroboratedShare >= STRONG_CORROBORATED_SHARE &&
    mix.origins.length >= STRONG_MIN_ORIGINS &&
    mix.monoculture !== 'unrated' &&
    dated
  ) {
    return {
      strength: 'strong',
      reason: `Most claims here are supported by two or more independent origins across ${mix.origins.length} in total, and the sources agree with each other.`,
    }
  }
  return {
    strength: 'mixed',
    reason: 'Parts of this picture are independently supported and parts rest on a single origin; the difference is set out below claim by claim.',
  }
}

/**
 * The reading as plain text.
 *
 * The counterpart of `confidence.ts`'s `explain()`: a user must be able to read
 * the whole analysis, including its gaps, without an interface — for an export,
 * a dossier, or an operator reading a log.
 */
export function explainReading(reading: EvidenceReading): string {
  const lines: string[] = [
    `Reading: ${reading.strength} — ${reading.strengthReason}`,
    ...reading.bottomLine.slice(1).map((s) => `· ${s}`),
  ]
  if (reading.gaps.length > 0) {
    lines.push('What to check:')
    for (const gap of reading.gaps.slice(0, MAX_LISTED)) {
      lines.push(`? ${gap.detail} → ${gap.check}`)
    }
  }
  return lines.join('\n')
}
