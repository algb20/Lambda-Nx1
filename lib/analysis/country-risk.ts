/**
 * Country instability — and the thing every other index leaves out.
 *
 * ## What the field ships
 *
 * Every comparable platform publishes a country instability index: one number
 * per country, 0–100, with a trend arrow. World Monitor fuses "12 signals per
 * country" and ranks nations against each other on the result. The numbers look
 * authoritative and they are computed the obvious way — count what the sources
 * reported, weight it, decay it, rank it.
 *
 * ## The flaw in all of them
 *
 * **An index built from reported events measures reporting, not instability.**
 *
 * A country with three resident news bureaus, a national seismic network and a
 * meteorological agency that publishes in English generates an order of
 * magnitude more events than a country with none of those — at identical real
 * instability. Ukraine scores high on every such index partly because Ukraine
 * is the most densely covered conflict on earth. Chad scores low partly because
 * almost nothing that happens in Chad reaches a machine-readable feed in
 * English within the hour.
 *
 * So the ranking these products publish is, in substantial part, a ranking of
 * **press and sensor density**. Not one of them says so. The number is
 * presented bare, and a reader has no way to tell "quiet" from "unobserved" —
 * which are opposite conclusions drawn from identical data.
 *
 * ## What this does instead
 *
 * Two numbers, never one, and they are never combined:
 *
 *  - **`signal`** — what the sources actually reported, severity-weighted,
 *    lifted where independent origins agree, decayed by age. This is the number
 *    the others publish alone.
 *  - **`observability`** — how well we can see this country at all: how many
 *    *independent* origins reported anything, how many distinct sources, and
 *    whether any of them is resident rather than a wire desk abroad.
 *
 * And one rule that follows from them, enforced in `comparable()`: **two
 * countries whose observability differs by more than `COMPARABLE_MARGIN` are
 * not ranked against each other.** The interface shows them in separate bands
 * rather than as neighbours on a list, because placing them adjacent asserts a
 * comparison the evidence cannot support.
 *
 * This is charter §2a applied to scoring rather than to source counts: a figure
 * we cannot honestly compare is a figure we refuse to present as comparable.
 *
 * ## What it deliberately is not
 *
 * Not a forecast. Not a prediction of coups, wars or collapse — charter §1
 * rules that out, and every "predictive stability index" is a curve fitted to
 * a past that will not repeat. This describes what was observed and how well it
 * was observed. Nothing else.
 */

import type { Admiralty } from '../engine/types'

/** The shape this needs from a world event. Structural, so any caller fits. */
export interface CountrySignal {
  category: string
  categoryLabel: string
  countryIso: string | null
  country: string | null
  title: string
  /** 0–1, from a real measurement or an agency's alert level. 0 = neither. */
  severity: number
  alertLevel: string | null
  /** When the world event happened, if the source said so. */
  observedAt: string | null
  /** When we received it. Always known. */
  at: string
  sourceKey: string
  sourceUrl: string | null
  /** Independence group. Fusion counts groups, never sources. */
  independence: string | null
  admiralty: Admiralty | null
}

/**
 * How much each category speaks to a country's *stability*, as opposed to
 * simply being an event that occurred there.
 *
 * An earthquake is a major event and says nothing about governance; a conflict
 * event says a great deal. Weighting them equally is how a seismically active,
 * politically calm country climbs an instability ranking — the single most
 * common failure in the published indices.
 *
 * Zero is a real value here, not a missing one: a research publication or a
 * space-weather notice is an event with no bearing on instability at all.
 */
export const CATEGORY_BEARING: Record<string, number> = {
  conflict: 1.0,
  humanitarian: 0.85,
  cyber: 0.6,
  infrastructure: 0.55,
  energy: 0.5,
  economy: 0.45,
  health: 0.45,
  water: 0.4,
  transport: 0.3,
  manmade: 0.3,
  drought: 0.3,
  world: 0.25,
  flood: 0.2,
  storm: 0.15,
  wildfire: 0.15,
  seismic: 0.1,
  volcano: 0.1,
  tsunami: 0.1,
  landslide: 0.1,
  temperature: 0.1,
  ice: 0.05,
  dust: 0.05,
  natural: 0.05,
  space: 0,
  research: 0,
}

/** Half-life of a signal's contribution, in hours. */
const HALF_LIFE_HOURS = 72

/**
 * Below this many independent origins, a country's signal is not a picture.
 * Stated rather than hidden — it is the difference between "calm" and "unseen".
 */
export const THIN_COVERAGE_ORIGINS = 3

/**
 * The observability gap beyond which two countries stop being comparable.
 *
 * Set at a third of the scale. Two countries within it are seen similarly well
 * enough that the difference in their signal is more likely about the world
 * than about us; beyond it, the ranking is measuring our own reach.
 */
export const COMPARABLE_MARGIN = 33

export interface RiskComponent {
  category: string
  label: string
  /** Events in this category. */
  count: number
  /** Its contribution to `signal`, after bearing, severity and decay. */
  contribution: number
  /** The strongest single thing reported, so the number has a face. */
  strongest: { title: string; sourceKey: string; sourceUrl: string | null; at: string } | null
  /** How many of these carried a real measurement or an agency alert level. */
  measured: number
}

export interface CountryRisk {
  iso: string
  country: string
  /** 0–100. What was reported. Never shown without `observability`. */
  signal: number
  /** 0–100. How well we can see this country at all. */
  observability: number
  /** Distinct independence groups that reported anything here. */
  origins: number
  /** Distinct feeds. Always ≥ origins, and the gap is itself informative. */
  sources: number
  events: number
  components: RiskComponent[]
  /** Plain sentences about what this score does not cover. Never empty. */
  blindSpots: string[]
  /** The one-line reading. */
  summary: string
}

function decay(hours: number): number {
  return Math.pow(0.5, Math.max(0, hours) / HALF_LIFE_HOURS)
}

/**
 * Age in hours from the time the source stated, falling back to receipt.
 *
 * `observedAt` first, because an event that happened three days ago and reached
 * us this morning is three days old — dating it from our receipt is how late
 * detection in a thin region comes to look like a fast-moving situation, which
 * is precisely the bias this module exists to expose rather than commit.
 */
function ageHours(signal: CountrySignal, now: number): number {
  const stamp = Date.parse(signal.observedAt ?? signal.at)
  if (!Number.isFinite(stamp)) return HALF_LIFE_HOURS // unknown age, halve it
  return (now - stamp) / 3_600_000
}

/**
 * Score one country from the signals attributed to it.
 *
 * `all` may be the whole world feed; only the rows matching `iso` are read.
 */
export function scoreCountry(all: CountrySignal[], iso: string, now = Date.now()): CountryRisk {
  const mine = all.filter((s) => s.countryIso === iso)
  const country = mine.find((s) => s.country)?.country ?? iso

  const byCategory = new Map<string, CountrySignal[]>()
  for (const s of mine) {
    const list = byCategory.get(s.category) ?? []
    list.push(s)
    byCategory.set(s.category, list)
  }

  const components: RiskComponent[] = []
  let raw = 0
  for (const [category, list] of byCategory) {
    const bearing = CATEGORY_BEARING[category] ?? 0.2
    let contribution = 0
    for (const s of list) {
      // An event with no measured severity still counts — it happened — but at
      // a floor rather than at an invented level. We never promote an ungraded
      // report to "severe" because the category sounds serious.
      const strength = s.severity > 0 ? s.severity : 0.25
      contribution += bearing * strength * decay(ageHours(s, now))
    }
    raw += contribution
    const strongest = [...list].sort((a, b) => b.severity - a.severity)[0] ?? null
    components.push({
      category,
      label: list[0]?.categoryLabel ?? category,
      count: list.length,
      contribution: Math.round(contribution * 10) / 10,
      measured: list.filter((s) => s.severity > 0 || s.alertLevel).length,
      strongest: strongest
        ? {
            title: strongest.title,
            sourceKey: strongest.sourceKey,
            sourceUrl: strongest.sourceUrl,
            at: strongest.observedAt ?? strongest.at,
          }
        : null,
    })
  }
  components.sort((a, b) => b.contribution - a.contribution)

  const originSet = new Set(mine.map((s) => s.independence ?? `ungrouped:${s.sourceKey}`))
  const sourceSet = new Set(mine.map((s) => s.sourceKey))

  // Compressed, not linear: the difference between 1 and 4 signals is far more
  // informative than between 40 and 43, and a linear scale would let one busy
  // week in a well-covered country dominate the entire ranking.
  const signal = Math.round(Math.min(100, 100 * (1 - Math.exp(-raw / 12))))
  const observability = observabilityOf(originSet.size, sourceSet.size, mine.length)

  return {
    iso,
    country,
    signal,
    observability,
    origins: originSet.size,
    sources: sourceSet.size,
    events: mine.length,
    components,
    blindSpots: blindSpotsFor(mine, originSet.size, components),
    summary: summarise(signal, observability, originSet.size),
  }
}

/**
 * How well we can see a country.
 *
 * Independent origins carry the most weight: twenty reports from one wire are
 * one origin, and a country covered by a single origin is a country we are
 * looking at through one keyhole regardless of the volume coming through it.
 */
function observabilityOf(origins: number, sources: number, events: number): number {
  const originScore = Math.min(60, origins * 15)
  const sourceScore = Math.min(25, sources * 5)
  const volumeScore = Math.min(15, Math.round(Math.log2(events + 1) * 4))
  return Math.min(100, originScore + sourceScore + volumeScore)
}

/**
 * What this score does not cover — always at least one sentence.
 *
 * An empty blind-spot list would itself be a false claim: there is no country
 * for which a public-source feed sees everything.
 */
function blindSpotsFor(
  mine: CountrySignal[],
  origins: number,
  components: RiskComponent[],
): string[] {
  const out: string[] = []

  if (mine.length === 0) {
    return [
      'No public source in our catalogue reported anything here in this window. That is a statement about our coverage, not about the country — read it as "unobserved", never as "calm".',
    ]
  }
  if (origins < THIN_COVERAGE_ORIGINS) {
    out.push(
      `Only ${origins} independent origin${origins === 1 ? '' : 's'} reported here. Below ${THIN_COVERAGE_ORIGINS}, a quiet score means we cannot see the country, not that the country is quiet.`,
    )
  }
  const unmeasured = components.reduce((n, c) => n + (c.count - c.measured), 0)
  if (unmeasured > 0) {
    out.push(
      `${unmeasured} of ${mine.length} reports carried no measurement and no agency alert level. They are counted at a floor rather than promoted to a severity nobody stated.`,
    )
  }
  const untimed = mine.filter((s) => !s.observedAt).length
  if (untimed > 0) {
    out.push(
      `${untimed} report${untimed === 1 ? '' : 's'} published no time of occurrence, so ${untimed === 1 ? 'it is' : 'they are'} aged from when we received ${untimed === 1 ? 'it' : 'them'} — which understates the age of anything that reached us late.`,
    )
  }
  // The standing caveat, present for every country without exception.
  out.push(
    'Public sources only, passively read. Anything not published — internal security incidents, unreported displacement, undisclosed economic distress — is absent by construction and its absence is not evidence.',
  )
  return out
}

function summarise(signal: number, observability: number, origins: number): string {
  if (observability < 30) {
    return `Too thinly observed to score meaningfully — ${origins} independent origin${origins === 1 ? '' : 's'}. The signal figure is shown for completeness and should not be compared with a well-covered country.`
  }
  if (signal >= 60) {
    return 'Substantial reported activity bearing on stability, from sources that corroborate each other.'
  }
  if (signal >= 30) {
    return 'Moderate reported activity. Present in the record, without the density or severity that marks an escalating situation.'
  }
  return 'Little reported activity bearing on stability in this window, from coverage dense enough that the quiet is informative.'
}

/**
 * Whether two countries may honestly be placed next to each other in a ranking.
 *
 * The check the field does not make. Two countries seen through very different
 * amounts of coverage produce signal numbers that are not on the same scale,
 * and listing them as neighbours asserts a comparison the evidence cannot bear.
 */
export function comparable(a: CountryRisk, b: CountryRisk): boolean {
  return Math.abs(a.observability - b.observability) <= COMPARABLE_MARGIN
}

/**
 * Rank countries, split into bands within which comparison is honest.
 *
 * Returns groups rather than one list, because one list *is* the claim that
 * every row is comparable to every other. Each band is labelled by the
 * observability it holds, so a reader can see that the top band is "countries
 * we can see well" before reading a single score.
 */
export function rankByBand(risks: CountryRisk[]): Array<{
  label: string
  note: string
  minObservability: number
  countries: CountryRisk[]
}> {
  const bands = [
    {
      label: 'Densely observed',
      minObservability: 67,
      note: 'Several independent origins reporting. Scores here are comparable with one another.',
    },
    {
      label: 'Moderately observed',
      minObservability: 34,
      note: 'Enough coverage for a reading, not enough to compare against the band above.',
    },
    {
      label: 'Thinly observed',
      minObservability: 0,
      note: 'One or two origins. A low score here means we cannot see the country — never that it is calm.',
    },
  ]
  return bands.map((band, i) => {
    const upper = i === 0 ? 101 : bands[i - 1].minObservability
    return {
      ...band,
      countries: risks
        .filter((r) => r.observability >= band.minObservability && r.observability < upper)
        .sort((a, b) => b.signal - a.signal),
    }
  })
}

/**
 * Score every country present in the feed.
 *
 * Countries with no signals are absent rather than scored zero: a zero would
 * enter a ranking and be read as "calm", which is the exact confusion this
 * module exists to prevent.
 */
export function scoreAllCountries(all: CountrySignal[], now = Date.now()): CountryRisk[] {
  const isos = new Set(all.map((s) => s.countryIso).filter((v): v is string => Boolean(v)))
  return [...isos].map((iso) => scoreCountry(all, iso, now))
}
