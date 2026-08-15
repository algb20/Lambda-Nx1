import {
  eventTimeMs,
  timedByReceipt,
  type WorldEvent,
} from '../modules/world-events-shared'

/**
 * The board's own history — what arrived, when, and how serious it was.
 *
 * ## Why this exists
 *
 * A live board answers "what is happening". It cannot answer "is this week
 * worse than last", which is the first question anyone with responsibility
 * asks. Every comparable platform surveyed carries some form of this; the
 * strongest open one shows a daily severity histogram with a
 * *Worsening / N active days / N critical-high* header, and it is the single
 * most-referenced panel on their screen.
 *
 * ## What makes ours different, and it is not decoration
 *
 * Theirs shows five severity bands. Ours shows **six**, because the sixth is a
 * fact their model has no way to express: `unscored` — an event for which no
 * real measurement existed.
 *
 * That distinction is load-bearing here. Severity in this engine is derived only
 * where something measurable exists: an earthquake magnitude, a burned area, an
 * agency's own alert level. A cyber advisory, a central-bank statement and a
 * displacement report carry **no severity at all**, and the honest value for
 * them is zero-meaning-unknown, not zero-meaning-harmless. Folding those into
 * "low" would draw a calm week out of a week nobody measured — the exact
 * inversion a severity chart exists to prevent.
 *
 * Each day also carries how many **independent origins** contributed to it.
 * A day built from thirty reports and two origins is a day of echo, and a chart
 * that plots only volume makes it look like a busy day.
 *
 * ## What this deliberately does not do
 *
 * It does not forecast. The trend below compares the recent half of the window
 * with the earlier half and reports which is heavier — that is arithmetic over
 * what already happened, and it is described in exactly those words. The
 * charter forbids future-prediction, and a "threat timeline" that quietly
 * extrapolates is precisely the kind of thing it forbids.
 */

/** How serious, where a real measure exists to say so. */
export type SeverityBand = 'critical' | 'high' | 'medium' | 'low' | 'unscored'

interface BandSpec {
  key: SeverityBand
  label: string
  /** Inclusive lower bound on the 0–1 severity. */
  min: number
  color: string
}

/**
 * The bands, and where the cuts fall.
 *
 * The thresholds are anchored to the severity scale the engine already
 * publishes rather than chosen for a pleasing distribution: `severityOf` maps a
 * magnitude-7 earthquake and a GDACS **red** alert to ~0.9, an orange alert to
 * 0.66, and a green one to 0.33. So `critical` begins where an agency would say
 * red, `high` where it would say orange, and `medium` where it would say green.
 * A reader who knows GDACS reads this chart without a legend.
 */
export const SEVERITY_BANDS: BandSpec[] = [
  { key: 'critical', label: 'Critical', min: 0.85, color: '#dc2626' },
  { key: 'high', label: 'High', min: 0.6, color: '#f97316' },
  { key: 'medium', label: 'Medium', min: 0.3, color: '#eab308' },
  { key: 'low', label: 'Low', min: 0.001, color: '#84cc16' },
  { key: 'unscored', label: 'No severity measure', min: -1, color: '#64748b' },
]

export function severityBand(severity: number): SeverityBand {
  if (!Number.isFinite(severity) || severity <= 0) return 'unscored'
  return (SEVERITY_BANDS.find((b) => severity >= b.min) ?? SEVERITY_BANDS[3]).key
}

export interface TimelineDay {
  /** UTC calendar day, `YYYY-MM-DD`. */
  day: string
  counts: Record<SeverityBand, number>
  total: number
  /** Events that carry a real severity measure. `total - unscored`. */
  scored: number
  /** Distinct independence groups that contributed. Echo shows as a low number. */
  origins: number
  /**
   * Events dated only by our own receipt, because no source stated a time.
   *
   * Reported per day because it is what limits the chart: a day whose events
   * are all receipt-dated may be describing when *we* looked, not when things
   * happened.
   */
  receiptDated: number
}

export type Trend = 'worsening' | 'steady' | 'easing' | 'insufficient'

export interface Timeline {
  days: TimelineDay[]
  /** Days in the window that carried at least one event. */
  activeDays: number
  criticalHigh: number
  trend: Trend
  /** The chart in one sentence, including what it cannot say. */
  verdict: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function emptyCounts(): Record<SeverityBand, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, unscored: 0 }
}

/**
 * Build the timeline over the last `days` calendar days, ending today.
 *
 * Days with nothing in them are **kept**, not skipped. A gap is information —
 * it means either a quiet day or a day we failed to collect — and a chart that
 * silently closes its gaps turns an outage into a smooth line.
 */
export function buildTimeline(
  events: WorldEvent[],
  options: { days?: number; now?: number } = {},
): Timeline {
  const span = Math.max(2, options.days ?? 7)
  const now = options.now ?? Date.now()

  const buckets = new Map<string, { day: TimelineDay; origins: Set<string> }>()
  for (let i = span - 1; i >= 0; i--) {
    const key = dayKey(now - i * DAY_MS)
    buckets.set(key, {
      day: { day: key, counts: emptyCounts(), total: 0, scored: 0, origins: 0, receiptDated: 0 },
      origins: new Set<string>(),
    })
  }

  for (const event of events) {
    const ms = eventTimeMs(event)
    if (!Number.isFinite(ms)) continue
    const bucket = buckets.get(dayKey(ms))
    // Outside the window. Not an error — the board holds events older than the
    // chart shows, and clamping them onto the edge day would invent a spike.
    if (!bucket) continue

    const band = severityBand(event.severity)
    bucket.day.counts[band]++
    bucket.day.total++
    if (band !== 'unscored') bucket.day.scored++
    if (timedByReceipt(event)) bucket.day.receiptDated++
    bucket.origins.add(event.independence ?? event.sourceKey)
  }

  const days = [...buckets.values()].map(({ day, origins }) => ({
    ...day,
    origins: origins.size,
  }))

  const criticalHigh = days.reduce((n, d) => n + d.counts.critical + d.counts.high, 0)
  const activeDays = days.filter((d) => d.total > 0).length

  return {
    days,
    activeDays,
    criticalHigh,
    trend: trendOf(days),
    verdict: verdictOf(days, criticalHigh, activeDays),
  }
}

/**
 * Which half of the window carried more serious events.
 *
 * Only `critical` and `high` are weighed. Total volume is the wrong measure — a
 * quiet week during which one feed happened to publish its backlog would read
 * as a crisis — and unscored events cannot contribute to a severity trend
 * without asserting a severity nobody measured.
 *
 * The 25% threshold keeps ordinary variation out of the verdict. Below it the
 * honest answer is `steady`, which is a finding, not a hedge.
 */
function trendOf(days: TimelineDay[]): Trend {
  if (days.length < 4) return 'insufficient'
  const half = Math.floor(days.length / 2)
  const weight = (list: TimelineDay[]) =>
    list.reduce((n, d) => n + d.counts.critical * 2 + d.counts.high, 0)

  const earlier = weight(days.slice(0, half))
  const recent = weight(days.slice(days.length - half))

  // Nothing serious in either half is not "steady at zero" — it is a window
  // with no severity signal in it at all, and saying "steady" would imply we
  // measured something and it held.
  if (earlier === 0 && recent === 0) return 'insufficient'
  if (earlier === 0) return 'worsening'

  const change = (recent - earlier) / earlier
  if (change > 0.25) return 'worsening'
  if (change < -0.25) return 'easing'
  return 'steady'
}

function verdictOf(days: TimelineDay[], criticalHigh: number, activeDays: number): string {
  const total = days.reduce((n, d) => n + d.total, 0)
  if (total === 0) {
    return `No events in the last ${days.length} days. That is a collection failure, not a quiet world.`
  }

  const unscored = days.reduce((n, d) => n + d.counts.unscored, 0)
  const receiptDated = days.reduce((n, d) => n + d.receiptDated, 0)
  const parts = [
    `${total} events over ${days.length} days, ${activeDays} of them active, ${criticalHigh} critical or high.`,
  ]

  if (unscored > 0) {
    parts.push(
      `${unscored} carry no severity measure — no magnitude, no burned area, no agency alert level — and are counted apart rather than as low.`,
    )
  }
  if (receiptDated > 0) {
    parts.push(
      `${receiptDated} are placed by when we received them, because no source stated a time.`,
    )
  }
  return parts.join(' ')
}
