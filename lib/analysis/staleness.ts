import type { Evidence } from '../engine/types'

/**
 * Feeds that are still answering but have stopped publishing.
 *
 * ## The failure this catches
 *
 * A source that returns `503` is obvious: it fails, the sweep records it, the
 * health panel turns red. A source that returns `200` and a perfectly valid
 * document whose newest item is from **July 2022** is invisible. It counts as
 * healthy, it contributes items, and those items sit on a live news board
 * looking exactly like today's reporting apart from a date nobody reads.
 *
 * We found one: `thedailystar_bd` contributing ten items dated 2022, four years
 * stale, alongside 1,105 current reports. Nothing in the platform noticed,
 * because nothing was looking at *when* a working feed last published — only at
 * whether it answered.
 *
 * ## Why this reports rather than drops
 *
 * Dropping stale items would make the board look right and leave the cause
 * untouched: the feed would keep being fetched every sweep, keep counting as an
 * active source, and keep inflating the catalogue's headline number with a
 * publisher that stopped four years ago. The charter's whole position on
 * quarantine applies here — an observation with a date is evidence, and
 * silently discarding it destroys the difference between *we chose not to use
 * this* and *we tried and it was dead*.
 *
 * So this measures, names the source, and hands the finding to the self-audit
 * loop. A human releases or retires the record.
 *
 * ## Why a threshold rather than a judgement
 *
 * Publication rhythm varies enormously — a wire publishes hourly, a magazine
 * monthly, a national statistics office quarterly. A single "is it stale"
 * verdict across all of them would be wrong for most. The threshold is set
 * where no legitimate news publisher of any rhythm falls: a newsroom silent for
 * **90 days** has stopped, whatever its rhythm was.
 *
 * The threshold is only survivable because the measurement is taken on the
 * **newest** item a feed offered, never on the age of the items it carries.
 * Der Spiegel's feed contains long-form pieces four months old *and* today's
 * reporting; a rule looking at item age would condemn it, and a rule looking at
 * the newest item correctly leaves it alone. Carrying old material is what an
 * archive-bearing feed does. Publishing nothing new is what a dead one does.
 */

/** Beyond this, a *news* feed has stopped publishing rather than gone quiet. */
export const STALE_AFTER_DAYS = 90

export interface StaleFeed {
  sourceKey: string
  /** The newest publication time the feed offered, ISO. */
  newestAt: string
  /** Whole days since that item, at the time of measurement. */
  daysSilent: number
  /** How many items it contributed to this sweep, all of them stale. */
  items: number
}

/**
 * Which feeds in a sweep have stopped publishing.
 *
 * A feed is judged only on the items it actually contributed. One that returned
 * nothing is a different finding — an empty answer, already recorded by the
 * sweep — and calling it stale here would report the same fault twice under two
 * names.
 *
 * Items with no stated publication time cannot date a feed and are ignored: a
 * feed publishing only undated items is a *dating* problem, reported elsewhere,
 * and guessing at its freshness would invent the very timestamp whose absence
 * is the finding.
 */
export function staleFeeds(evidence: Evidence[], now = Date.now()): StaleFeed[] {
  const newest = new Map<string, { at: number; iso: string; items: number }>()

  for (const e of evidence) {
    if (!e.publishedAt) continue
    const at = Date.parse(e.publishedAt)
    if (!Number.isFinite(at)) continue
    const current = newest.get(e.sourceKey)
    if (!current) {
      newest.set(e.sourceKey, { at, iso: e.publishedAt, items: 1 })
      continue
    }
    current.items++
    if (at > current.at) {
      current.at = at
      current.iso = e.publishedAt
    }
  }

  const cutoff = now - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
  const stale: StaleFeed[] = []
  for (const [sourceKey, record] of newest) {
    if (record.at >= cutoff) continue
    stale.push({
      sourceKey,
      newestAt: record.iso,
      daysSilent: Math.floor((now - record.at) / (24 * 60 * 60 * 1000)),
      items: record.items,
    })
  }
  // Longest-dead first: that is the order someone fixing them would work in.
  return stale.sort((a, b) => b.daysSilent - a.daysSilent)
}

/** One sentence for the board, or null when every feed is publishing. */
export function stalenessNote(stale: StaleFeed[]): string | null {
  if (stale.length === 0) return null
  const worst = stale[0]
  const others = stale.length - 1
  const tail = others > 0 ? ` and ${others} other ${others === 1 ? 'feed' : 'feeds'}` : ''
  return (
    `${stale.length} ${stale.length === 1 ? 'feed answers but has' : 'feeds answer but have'} ` +
    `stopped publishing — ${worst.sourceKey} last published ${worst.daysSilent} days ago${tail}.`
  )
}
