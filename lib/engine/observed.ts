/**
 * The one place a source's stated time is parsed.
 *
 * ## What this fixes
 *
 * Production reported **125 events, 0 of them carrying a source-stated time**.
 * Not one dot on the live board could be aged. The cause was not a missing
 * parser — the catalogue adapter had a good one — it was that the six
 * hand-written world-event sources took the agency's own timestamp and wrote it
 * into `retrievedAt`, the field that means *when we fetched it*. So the moment
 * the ground moved became the moment we asked, the real publication time was
 * discarded, and `publishedAt` was left unset. Detection lag came out as zero
 * for every event, because both halves of the subtraction were the same number.
 *
 * Two different facts had been collapsed into one field. This module exists so
 * that the parsing half of the separation lives once, is tested once, and
 * cannot drift between the adapter and the hand-written sources.
 *
 * ## Why a plausibility bound
 *
 * `Date.parse` is generous. It will accept a year of `0001` from a malformed
 * feed, and a feed republishing an old record with a broken date would sort to
 * the top or the bottom of every board and stay there. A parsed date is only
 * returned when it could describe an observation:
 *
 *  - **Not before 1970.** Nothing in a live hazard, alert or news feed is older
 *    than the epoch. A date that early is a parse artefact, not history.
 *  - **Not more than 30 days ahead.** Observations are not made in the future.
 *    The allowance is not zero because official alert systems legitimately
 *    publish a forward `effective` time, and because a timezone-less string
 *    parsed as local can land hours ahead of UTC.
 *
 * Outside those bounds the answer is `null`, which is the honest one: the source
 * stated a time and we could not defend it. That is a finding about the source,
 * and downstream code already knows how to say "not stated" — it must never be
 * shown a number we do not believe.
 */

/** Lower bound: the Unix epoch. Nothing a live feed publishes precedes it. */
const EARLIEST_MS = 0

/** Upper allowance for forward-dated alerts and timezone-less strings. */
const FUTURE_ALLOWANCE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Milliseconds vs seconds, decided by magnitude.
 *
 * Agencies publish both and label neither. `1e11` ms is 1973 and `1e11` s is
 * the year 5138, so any value above the threshold is milliseconds and any value
 * below it is seconds — unambiguous for every date this side of the epoch.
 */
const MS_THRESHOLD = 1e11

/**
 * A source's stated publication or observation time, or `null`.
 *
 * Accepts what agencies actually publish: epoch milliseconds, epoch seconds,
 * ISO-8601, RFC-822 (RSS `pubDate`), and GDELT's compact `20260814T031500Z`,
 * which `Date` cannot parse unaided.
 *
 * Never falls back to the current time. The absence of a date is information.
 */
export function publicationTime(value: unknown): string | null {
  const ms = toMillis(value)
  if (ms === null) return null
  if (ms < EARLIEST_MS) return null
  if (ms > Date.now() + FUTURE_ALLOWANCE_MS) return null
  return new Date(ms).toISOString()
}

function toMillis(value: unknown): number | null {
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isFinite(t) ? t : null
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return value > MS_THRESHOLD || value < -MS_THRESHOLD ? value : value * 1000
  }

  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null

  // A bare number arriving as a string is still an epoch stamp; several JSON
  // feeds quote their integers.
  if (/^-?\d+$/.test(text)) return toMillis(Number(text))

  // GDELT: `20260814T031500Z`, with no separators at all.
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  if (compact) {
    const [, y, mo, d, h, mi, s] = compact
    const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`)
    return Number.isFinite(t) ? t : null
  }

  /**
   * Drupal's default RSS date: `Friday, August 14, 2026 - 09:46`.
   *
   * The dash between the date and the time is not RFC-822 and defeats
   * `Date.parse` outright, so every feed built on that CMS — which is most
   * European regulators and a large share of government sites — arrived
   * undated. The UK FCA's feed alone lost 20 items a sweep to it.
   *
   * The zone is appended explicitly rather than left off, because a bare
   * `August 14, 2026 09:46` is parsed as *local* time by V8. That would make
   * the same feed yield different timestamps on a developer's machine and on
   * the deployed host — a class of bug that is invisible until the two are
   * compared. The feed states no zone, so UTC is the assumption, made once and
   * in the open.
   */
  const cms = text.match(/^(.+\d{4})\s+-\s+(\d{1,2}:\d{2}(?::\d{2})?)$/)
  if (cms) {
    const t = Date.parse(`${cms[1]} ${cms[2]} UTC`)
    if (Number.isFinite(t)) return t
  }

  // A date with no time and no zone (`2026-08-14`) is read as UTC midnight by
  // `Date.parse`, which is what we want; a date *with* a time and no zone is
  // read as local, which is why the future allowance above is not zero.
  const parsed = Date.parse(text)
  return Number.isFinite(parsed) ? parsed : null
}
