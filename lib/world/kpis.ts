import {
  CATEGORY_META,
  type EventCategory,
  type WorldEventsReport,
} from '@/lib/modules/world-events-shared'

/**
 * The headline figures above the map.
 *
 * ## Why this is a module and not markup
 *
 * A KPI strip is the part of a dashboard a reader trusts without checking,
 * which makes it the part most worth getting wrong quietly. Every comparable
 * board computes its headline numbers inline in the component that draws them,
 * where they cannot be tested and where "0" and "unknown" render identically.
 * These are computed here, from fields the engine actually measured, and the
 * ones that cannot be known say so.
 *
 * ## What the field shows, and what we show instead
 *
 * WorldMonitor's dashboard leads with an event count and a "live" dot. Both are
 * satisfying and neither is falsifiable: a count is large whether or not the
 * feeds behind it answered, and a green dot is green whether or not anything
 * arrived this hour. Measured on our own deployment, that exact failure mode
 * printed **13 sources OK · 0 failed · 0 movers** — a healthy header over an
 * empty board.
 *
 * So four of the six figures here are ones a dishonest board would never
 * volunteer:
 *
 * - **feeds** counts refusals separately from empties, because "answered with
 *   nothing" and "would not answer" are different facts and only one of them is
 *   our problem.
 * - **corroboration** is counted in independent origins, so a story carried by
 *   forty outlets from one wire is one origin.
 * - **blind** is the share of regions we cannot see into at all. A quiet region
 *   and an unwatched region look identical on every other map, and the
 *   difference matters most where coverage is thinnest.
 * - **live edge** is the age of the newest observation, not the age of the
 *   fetch. A board refreshed a second ago can be showing yesterday.
 */

/** How a figure should read at a glance. Never decoration — each has a rule. */
export type KpiTone = 'neutral' | 'good' | 'warn' | 'bad'

export interface Kpi {
  key: string
  /** Short enough for a strip on a phone. */
  label: string
  /** The figure itself, already formatted. `—` when it cannot be known. */
  value: string
  /** The denominator or unit, shown smaller beside the value. */
  unit?: string
  /** One sentence a reader can hold the number to. */
  detail: string
  tone: KpiTone
}

/** Newest observation older than this and the board is stale, not live. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000
/** Older than this and it is not a lag, it is an outage. */
export const DEAD_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * Age in words, at the coarseness a reader actually uses.
 *
 * Deliberately not "2 hours 14 minutes": nobody acts on the minutes, and the
 * extra precision reads as a claim to accuracy the timestamp does not have —
 * publishers round their own observation times.
 */
export function ageWords(ms: number): string {
  if (ms < 60_000) return 'just now'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** A percentage with no decimal point, since none of these deserve one. */
const pct = (part: number, whole: number): number =>
  whole <= 0 ? 0 : Math.round((part / whole) * 100)

/** Every category the catalogue can express — the denominator for "live". */
export const CATALOGUE_SIZE = (Object.keys(CATEGORY_META) as EventCategory[]).length

/**
 * Build the strip.
 *
 * `now` is injected rather than read, because two of these figures are ages and
 * a test that cannot choose the time can only assert that a number exists.
 */
export function buildKpis(report: WorldEventsReport, now: number = Date.now()): Kpi[] {
  const { summary, fusion, coverageSummary } = report

  /* ---- On the map ---------------------------------------------------- */
  // `total` includes events with no coordinate. They are real and they are
  // listed; they are simply not drawable, and a map that quietly dropped them
  // would under-report the world by whatever share of feeds omit coordinates.
  const unplaceable = summary.total - summary.placed
  const placedTone: KpiTone =
    summary.total === 0 ? 'neutral' : summary.placed === 0 ? 'bad' : 'neutral'

  /* ---- Live edge ----------------------------------------------------- */
  const newestMs = summary.newestAt ? Date.parse(summary.newestAt) : NaN
  const hasEdge = Number.isFinite(newestMs)
  const edgeAge = hasEdge ? Math.max(0, now - newestMs) : NaN
  const edgeTone: KpiTone = !hasEdge
    ? 'warn'
    : edgeAge > DEAD_AFTER_MS
      ? 'bad'
      : edgeAge > STALE_AFTER_MS
        ? 'warn'
        : 'good'

  /* ---- Feeds --------------------------------------------------------- */
  // Three states, never two. A feed that answered with nothing is a coverage
  // gap in the world; a feed that refused is a gap in *us*, and collapsing them
  // is precisely how a board reports itself healthy while blind.
  const answering = summary.sourcesOk + summary.sourcesEmpty
  const feedTotal = answering + summary.sourcesFailed
  const feedTone: KpiTone =
    feedTotal === 0
      ? 'warn'
      : summary.sourcesFailed === 0
        ? 'good'
        : summary.sourcesOk === 0
          ? 'bad'
          : 'warn'

  /* ---- Corroboration ------------------------------------------------- */
  const corroborated = fusion.corroborated
  const corrTone: KpiTone =
    fusion.events === 0
      ? 'neutral'
      : fusion.contested > 0
        ? 'warn'
        : pct(corroborated, fusion.events) >= 50
          ? 'good'
          : 'neutral'

  /* ---- Blind regions ------------------------------------------------- */
  const blind = coverageSummary.dark + coverageSummary.thin
  const blindTone: KpiTone =
    coverageSummary.totalRegions === 0
      ? 'neutral'
      : coverageSummary.dark > 0
        ? 'warn'
        : 'good'

  /* ---- Categories reporting ------------------------------------------ */
  const live = report.categories.filter((c) => c.count > 0).length

  return [
    {
      key: 'placed',
      label: 'On the map',
      value: summary.placed.toLocaleString(),
      unit: `of ${summary.total.toLocaleString()}`,
      detail:
        unplaceable > 0
          ? `${unplaceable.toLocaleString()} event${unplaceable === 1 ? '' : 's'} arrived without a coordinate. They are listed under “Not placeable”, never plotted at a guess.`
          : 'Every event held in this run carries a coordinate its source published.',
      tone: placedTone,
    },
    {
      key: 'edge',
      label: 'Live edge',
      value: hasEdge ? ageWords(edgeAge) : '—',
      detail: hasEdge
        ? summary.untimed > 0
          ? `Age of the newest observation, timed by the publisher — not the age of our last fetch. ${summary.untimed} event${summary.untimed === 1 ? '' : 's'} in this run carry no publisher time and are not counted here.`
          : 'Age of the newest observation, timed by the publisher — not the age of our last fetch. A board refreshed a second ago can still be showing yesterday.'
        : `No source in this run published an observation time — all ${summary.untimed} events arrived undated — so the age of this picture cannot be established.`,
      tone: edgeTone,
    },
    {
      key: 'feeds',
      label: 'Feeds',
      value: `${summary.sourcesOk}`,
      unit: `of ${feedTotal}`,
      detail:
        summary.sourcesFailed > 0
          ? `${summary.sourcesFailed} refused outright and ${summary.sourcesEmpty} answered with nothing. A refusal is our blind spot; an empty answer is the world being quiet.`
          : `${summary.sourcesEmpty} answered with nothing — a quiet beat, not a fault. None refused.`,
      tone: feedTone,
    },
    {
      key: 'corroboration',
      label: 'Corroborated',
      value: corroborated.toLocaleString(),
      unit: `of ${fusion.events.toLocaleString()}`,
      detail:
        fusion.contested > 0
          ? `Counted in independent origins, never in reports. ${fusion.contested} event${fusion.contested === 1 ? ' is' : 's are'} contested — sources that disagree.`
          : 'Counted in independent origins, never in reports: forty outlets carrying one wire is one origin.',
      tone: corrTone,
    },
    {
      key: 'blind',
      label: 'Blind regions',
      value: `${blind}`,
      unit: `of ${coverageSummary.totalRegions}`,
      detail:
        coverageSummary.dark > 0
          ? `${coverageSummary.dark} region${coverageSummary.dark === 1 ? '' : 's'} nothing covers at all, ${coverageSummary.thin} covered too thinly to trust. Silence there is not calm.`
          : `${coverageSummary.thin} region${coverageSummary.thin === 1 ? ' is' : 's are'} thinly covered. None is fully dark.`,
      tone: blindTone,
    },
    {
      key: 'categories',
      label: 'Reporting',
      value: `${live}`,
      unit: `of ${CATALOGUE_SIZE} kinds`,
      detail:
        'Categories with at least one event right now, against every kind this engine can express. A silent category is a finding, not an absence.',
      tone: 'neutral',
    },
  ]
}
