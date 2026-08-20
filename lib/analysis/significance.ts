/**
 * Significance is not severity, and conflating them ruins the front page.
 *
 * ## The measured failure
 *
 * On a live run, **17 of the top 20** events in "Most significant now" came from
 * one publisher: the US National Weather Service. Not because American weather
 * was the most important thing happening on earth, but because NWS issues
 * county-level warnings continuously, each carrying an agency alert level that
 * grades to a uniform 0.75 severity. Thirty-four flood warnings for adjacent
 * counties are thirty-four rows at identical severity, and they push everything
 * else off the list.
 *
 * The user's report was "the news is all weather, old and repeated". They were
 * describing this exactly. The raw feed is only 17% natural hazards; the
 * *ranking* made it 85%.
 *
 * ## Why severity alone can never fix it
 *
 * Severity answers "how bad is this event". It is a real, sourced number and we
 * should keep it. But it cannot answer "how much does this matter relative to
 * everything else right now", because:
 *
 *  - **A routine alert and a rare one grade the same.** NWS issues thousands of
 *    flood warnings a year at "Severe". USGS reports a handful of M7+ quakes.
 *    Both arrive as high severity; only one is unusual.
 *  - **Agencies that grade nothing vanish.** A Security Council resolution, a
 *    coup, a currency collapse carry no severity at all, because no agency
 *    assigns one. Severity-ranked, they rank below a county thunderstorm.
 *
 * ## The two corrections
 *
 * **1. Rarity.** How unusual is this report *for the publisher that sent it*, in
 * this run. A source contributing one event is telling us something it does not
 * say often; a source contributing forty is doing its routine job. This is
 * computed from the run itself — no historical baseline to drift, nothing to
 * configure, and it adapts automatically when a quiet source suddenly speaks.
 *
 * **2. Diversity.** However the scores land, a list where one publisher holds
 * most of the rows is not a picture of the world. Caps per source and per
 * category, applied after ranking, so the list is a *survey* rather than a
 * leaderboard for whoever publishes most.
 *
 * Neither invents importance. Rarity is counted, diversity is a stated rule,
 * and both are reported on the row so a reader can see why something is where
 * it is.
 */

export interface Rankable {
  sourceKey: string
  category: string
  severity: number
}

/**
 * How unusual this publisher's contribution is in this run.
 *
 * 1.0 for a source that sent one event; falling as it sends more. Logarithmic
 * rather than linear: the difference between 1 and 4 reports is meaningful, the
 * difference between 40 and 44 is not, and a linear penalty would erase a busy
 * source entirely rather than merely stopping it from dominating.
 *
 * Floored at `MIN_RARITY` on purpose. A prolific source is still reporting real
 * events — a genuine M7.7 must not be buried because USGS also sent forty
 * routine tremors. The floor is what keeps this a correction rather than a
 * suppression.
 *
 * The floor must sit *below* the real range or it silently destroys the
 * correction. Set at 0.35 first, and a test caught that `1/(1+log₂4)` is
 * already 0.333 — so every source sending four or more events scored
 * identically, and NWS at 34 tied with a source at 4. The curve has to stay
 * discriminating across 1–40 reports, which is the range publishers actually
 * occupy; the floor is for the pathological case beyond it.
 */
export const MIN_RARITY = 0.15

export function rarityOf(countFromSource: number): number {
  if (countFromSource <= 1) return 1
  return Math.max(MIN_RARITY, 1 / (1 + Math.log2(countFromSource)))
}

/** How many events each source contributed, for `rarityOf`. */
export function countBySource(items: ReadonlyArray<Rankable>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.sourceKey, (counts.get(item.sourceKey) ?? 0) + 1)
  return counts
}

/**
 * A one-line reason, so the row explains its own position.
 *
 * Never a bare number: "0.42" tells a reader nothing, "one of 34 from this
 * publisher in this run" tells them precisely why it sits where it does.
 */
export function rarityReason(sourceKey: string, count: number): string {
  if (count <= 1) return `the only report from ${sourceKey} in this run`
  if (count <= 3) return `one of ${count} from ${sourceKey} in this run`
  return `one of ${count} from ${sourceKey} in this run — routine volume for this publisher`
}

/**
 * Categories grouped into the families a reader actually distinguishes.
 *
 * ## Why a family layer at all
 *
 * Capping per *category* is not enough, and a live run proved it. After the
 * per-source cap, the board read: three earthquakes, three floods, three
 * wildfires, a volcano. Every one of those is a different category, so every
 * one got its own allowance — and the board was still almost entirely natural
 * hazards. The reader's complaint was never "too much NWS"; it was **"the news
 * is all weather"**, and to a reader an earthquake, a flood and a wildfire are
 * one kind of thing.
 *
 * So the cap applies per family as well. Eight hazard categories share one
 * allowance, and the board becomes a survey of the world rather than of the
 * weather.
 *
 * This is also the grouping the interface uses to present hazards as a single
 * gateway rather than eight near-identical rows in a category list.
 */
export const CATEGORY_FAMILY: Record<string, string> = {
  // Natural hazards — one thing, to a reader.
  seismic: 'hazard',
  volcano: 'hazard',
  tsunami: 'hazard',
  storm: 'hazard',
  flood: 'hazard',
  wildfire: 'hazard',
  drought: 'hazard',
  landslide: 'hazard',
  ice: 'hazard',
  dust: 'hazard',
  temperature: 'hazard',
  natural: 'hazard',
  water: 'hazard',

  conflict: 'security',
  cyber: 'security',
  humanitarian: 'security',
  health: 'security',

  economy: 'economy',
  energy: 'economy',

  infrastructure: 'systems',
  transport: 'systems',
  space: 'systems',
  manmade: 'systems',

  research: 'knowledge',
  world: 'knowledge',
}

/** The family a category belongs to; its own name when it belongs to none. */
export function familyOf(category: string): string {
  return CATEGORY_FAMILY[category] ?? category
}

/** Caps applied to a ranked list. Defaults chosen for a 20-row board. */
export interface DiversityLimits {
  maxPerSource: number
  maxPerCategory: number
  /** The cap that stops eight hazard categories from filling a board. */
  maxPerFamily: number
}

export const DEFAULT_LIMITS: DiversityLimits = {
  maxPerSource: 3,
  maxPerCategory: 3,
  maxPerFamily: 7,
}

/**
 * Take the best of a ranked list without letting one publisher own it.
 *
 * Greedy, in score order: an item is taken unless its source or category is
 * already at its cap. Held-back items are **not discarded** — they are returned
 * in `overflow`, so a caller can offer "34 more flood warnings from NWS" as one
 * expandable line instead of thirty-four rows. Dropping them silently would be
 * hiding real events, which is a different failure from the one being fixed.
 *
 * ## When the caps cannot fill the list
 *
 * A quiet hour with three sources, or an hour where almost everything really is
 * one family, leaves fewer than `limit` items passing the caps. Two bad options
 * and one good one:
 *
 *  - Return a short list. Four rows where twenty were asked for reads as a
 *    broken board.
 *  - Backfill silently. This is what the first version did, and it **undid the
 *    caps it had just applied** — tests measured 8 hazard rows under a cap of 7
 *    and the failure was invisible in the output.
 *  - Backfill, and **say so**. `diversified` reports how many passed the caps
 *    on their own merits, so the interface can tell the reader that the tail of
 *    the list is there to fill space rather than because it earned a place.
 *
 * The third. Silently violating a stated rule is the thing this codebase exists
 * to avoid.
 */
export function diversify<T extends Rankable>(
  ranked: ReadonlyArray<T>,
  limit: number,
  limits: DiversityLimits = DEFAULT_LIMITS,
): { taken: T[]; overflow: T[]; diversified: number } {
  const taken: T[] = []
  const overflow: T[] = []
  const bySource = new Map<string, number>()
  const byCategory = new Map<string, number>()
  const byFamily = new Map<string, number>()

  for (const item of ranked) {
    if (taken.length >= limit) {
      overflow.push(item)
      continue
    }
    const family = familyOf(item.category)
    const sourceCount = bySource.get(item.sourceKey) ?? 0
    const categoryCount = byCategory.get(item.category) ?? 0
    const familyCount = byFamily.get(family) ?? 0
    if (
      sourceCount >= limits.maxPerSource ||
      categoryCount >= limits.maxPerCategory ||
      familyCount >= limits.maxPerFamily
    ) {
      overflow.push(item)
      continue
    }
    taken.push(item)
    bySource.set(item.sourceKey, sourceCount + 1)
    byCategory.set(item.category, categoryCount + 1)
    byFamily.set(family, familyCount + 1)
  }

  // Everything up to here earned its place under the caps.
  const diversified = taken.length

  // Backfill only beyond that, and the count above records where it started.
  while (taken.length < limit && overflow.length > 0) {
    taken.push(overflow.shift() as T)
  }

  return { taken, overflow, diversified }
}

/**
 * What was held back, said in one line a reader can act on.
 *
 * Returns null when nothing was held back, so a caller renders nothing rather
 * than "0 more".
 */
export function overflowSummary(overflow: ReadonlyArray<Rankable>): string | null {
  if (overflow.length === 0) return null
  const bySource = countBySource(overflow)
  const top = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0]
  if (bySource.size === 1) {
    return `${overflow.length} more from ${top[0]}, held back so one publisher does not fill the board.`
  }
  return `${overflow.length} more held back so one publisher does not fill the board — ${top[1]} of them from ${top[0]}.`
}

// ─── Breaking ───────────────────────────────────────────────────────────────

/**
 * Whether an event deserves to interrupt the reader.
 *
 * The bar is deliberately high and the reasons are explicit, because a
 * "breaking" banner that fires often is a banner nobody reads — which then
 * fails at the one moment it matters. Three ways in, and an event needs one:
 *
 *  - **Rare and severe.** A high-severity report from a publisher that has said
 *    almost nothing else this run.
 *  - **Corroborated.** Independent origins agreeing is the signal this platform
 *    treats as decisive everywhere else, and it earns a lower severity bar.
 *  - **Extreme measurement.** A number so far above the ordinary that the
 *    grading is beside the point.
 *
 * Routine high-severity volume — the county flood warning — cannot qualify on
 * any of the three, which is the entire point.
 */
export interface BreakingCandidate extends Rankable {
  title: string
  magnitude: number | null
  /** The scale the magnitude is on, as the publisher stated it ("Mww", "km"). */
  magnitudeUnit?: string | null
  /** Independent origins reporting it. */
  origins: number
  /** Age in hours, or null when no usable time was published. */
  ageHours: number | null
}

/**
 * Where a bare number means something on its own, and what counts as extreme.
 *
 * `magnitude` is whatever the publisher measured, and across 119 sources that is
 * not one quantity: a moment magnitude, an altitude in kilometres, a water level
 * in metres, a wind speed. Treating them as comparable produced exactly the
 * error you would expect — **the International Space Station was reported as
 * breaking news because it was 429 km up**, sailing past a threshold written for
 * earthquakes.
 *
 * So the rule is opt-in per category, and a category earns an entry only when a
 * single number on a known scale really does settle the question without any
 * other context. Seismic magnitude is the clear case: past 6.5 nothing else
 * about the report changes what it is. Everything else must qualify through
 * severity, rarity or corroboration like any other report.
 */
export const MAGNITUDE_ALARM: Record<string, number> = { seismic: 6.5 }

export interface BreakingVerdict {
  breaking: boolean
  /** Why, in the reader's language. Empty when not breaking. */
  reasons: string[]
}

/** Beyond this, an event is stale and cannot be breaking however severe. */
export const BREAKING_MAX_AGE_HOURS = 12

export function assessBreaking(
  candidate: BreakingCandidate,
  countFromSource: number,
): BreakingVerdict {
  const reasons: string[] = []

  // Age gates everything. "Breaking" about yesterday is not breaking.
  if (candidate.ageHours === null || candidate.ageHours > BREAKING_MAX_AGE_HOURS) {
    return { breaking: false, reasons: [] }
  }

  if (candidate.severity >= 0.7 && countFromSource <= 3) {
    reasons.push(
      `severe, and ${rarityReason(candidate.sourceKey, countFromSource)}`,
    )
  }
  if (candidate.origins >= 3 && candidate.severity >= 0.4) {
    reasons.push(`${candidate.origins} independent origins reporting it`)
  }
  const alarm = MAGNITUDE_ALARM[candidate.category]
  if (alarm !== undefined && candidate.magnitude !== null && candidate.magnitude >= alarm) {
    // The unit is part of the claim. "Measured at 7.1" is a number; "measured at
    // 7.1 Mww" is a statement a reader can check against the agency.
    const unit = candidate.magnitudeUnit ? ` ${candidate.magnitudeUnit}` : ''
    reasons.push(`measured at ${candidate.magnitude}${unit}`)
  }

  return { breaking: reasons.length > 0, reasons }
}
