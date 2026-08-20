/**
 * How a time is shown to a reader. One implementation, used everywhere.
 *
 * ## The defect this replaces
 *
 * The app said **"1h ago"** next to news that happened days earlier. Two
 * separate causes, and both had to be fixed:
 *
 *  1. Several surfaces aged an item from **when we fetched it** rather than when
 *    it happened, so everything was always about an hour old.
 *  2. Every surface had its own copy of the same twenty-line `timeAgo`, and they
 *    disagreed. `globe-view` stopped at `d ago`, `history-panel` went on to
 *    `mo ago`, and neither ever showed a real date.
 *
 * ## The rule
 *
 * **Relative for the first day. A date after that.** "3h ago" is genuinely more
 * useful than a clock time for something that happened this morning. But "6d
 * ago" is worse than "14 Aug" in every way: it is harder to place, it cannot be
 * compared against anything else the reader knows, and it silently keeps
 * changing. Past twenty-four hours, the date is the answer.
 *
 * ## The event's own time, not only the reader's
 *
 * When a source states its offset — `+09:00` on a Japanese bulletin, `-0400` on
 * an RFC-822 `pubDate` — that offset is a fact about where the thing happened,
 * and the full stamp is rendered in it, labelled. A reader in Riyadh looking at
 * a Tokyo earthquake sees the time Tokyo said it happened, which is the time
 * every other account of that event will use.
 *
 * Where no offset was stated, the reader's own zone is used and named as theirs.
 * A zone guessed from a country would be wrong for every country wide enough to
 * have more than one — which is most of the large ones — and a confidently wrong
 * timestamp is worse than an honestly local one.
 */

/** Past this, the label becomes a date. The user-visible rule, in one place. */
export const RELATIVE_LIMIT_MS = 24 * 60 * 60 * 1000

export interface TimeDisplay {
  /** The inline label: "just now", "42m ago", "3h ago", or "14 Aug 2026". */
  label: string
  /** The full stamp, for a tooltip. Always absolute, always names its zone. */
  title: string
  /** True while the label is still relative — surfaces style the two alike. */
  relative: boolean
}

export interface TimeOptions {
  /** BCP-47 tag. Drives both the wording and the numerals. */
  locale?: string
  /** Injected so the behaviour is tested rather than observed. */
  now?: number
  /**
   * Minutes east of UTC, as the source itself stated it. `0` means the source
   * said UTC; `null`/undefined means it said nothing and the reader's own zone
   * is used instead.
   */
  offsetMinutes?: number | null
  /** Where the event happened, if known — shown beside its local time. */
  place?: string | null
}

/**
 * Format an instant for display.
 *
 * Returns `null` for an unparseable or absent time. That is deliberate: a
 * surface must be able to render "time not stated" rather than be handed a
 * fabricated one, which is the failure this whole module exists to end.
 */
export function displayTime(iso: string | null | undefined, options: TimeOptions = {}): TimeDisplay | null {
  if (!iso) return null
  const when = Date.parse(iso)
  if (!Number.isFinite(when)) return null

  const locale = options.locale || 'en'
  const now = options.now ?? Date.now()
  const diff = now - when

  return {
    label: relativeOrDate(diff, when, locale),
    title: absoluteTitle(when, locale, options.offsetMinutes ?? null, options.place ?? null),
    // A future timestamp is not "relative" in the sense the surfaces mean —
    // they use the flag to decide whether the label goes stale and needs a tick.
    relative: diff >= 0 && diff < RELATIVE_LIMIT_MS,
  }
}

function relativeOrDate(diff: number, when: number, locale: string): string {
  // Clock skew between our server and a publisher's routinely produces a stamp
  // a few seconds ahead. Showing "in 4 seconds" for a live bulletin reads as a
  // bug; treating a small lead as "now" is both kinder and more accurate.
  if (diff < 60_000) return relative(0, 'second', locale)
  if (diff < RELATIVE_LIMIT_MS) {
    const minutes = Math.floor(diff / 60_000)
    return minutes < 60
      ? relative(-minutes, 'minute', locale)
      : relative(-Math.floor(minutes / 60), 'hour', locale)
  }
  return shortDate(when, locale)
}

/**
 * `Intl.RelativeTimeFormat` rather than string concatenation, because "منذ
 * ساعتين" is not "منذ 2 ساعة" — Arabic has a dual, Russian has three plural
 * forms, and hand-built strings get all of them wrong. The runtime already
 * knows this for every locale we ship and every one we add later.
 */
function relative(value: number, unit: Intl.RelativeTimeFormatUnit, locale: string): string {
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: value === 0 ? 'auto' : 'always' }).format(value, unit)
  } catch {
    return value === 0 ? 'just now' : `${Math.abs(value)}${unit[0]} ago`
  }
}

/** A date without the year when it is this year — the year is noise until it is not. */
function shortDate(when: number, locale: string): string {
  const date = new Date(when)
  const sameYear = date.getUTCFullYear() === new Date().getUTCFullYear()
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/**
 * The tooltip: the full stamp, in the event's own zone when the source stated
 * one, and always saying which zone it is.
 *
 * A timestamp whose zone is unstated is the reason people mistrust timestamps.
 */
function absoluteTitle(
  when: number,
  locale: string,
  offsetMinutes: number | null,
  place: string | null,
): string {
  const date = new Date(when)

  if (offsetMinutes === null) {
    try {
      // Explicit components, not `dateStyle`/`timeStyle`: combining either of
      // those with `timeZoneName` is a TypeError, and the catch below would
      // have silently degraded every unzoned stamp to a raw ISO string.
      const local = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(date)
      return `${local} — your time (the source stated no time zone)`
    } catch {
      return `${date.toISOString()} (UTC)`
    }
  }

  // Shift the instant by the stated offset and format it as UTC: this renders
  // the wall-clock reading in the source's own zone without needing an IANA
  // zone name we were never given.
  const shifted = new Date(when + offsetMinutes * 60_000)
  let stamp: string
  try {
    stamp = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(shifted)
  } catch {
    stamp = shifted.toISOString().slice(0, 16).replace('T', ' ')
  }
  return `${stamp} ${utcLabel(offsetMinutes)}${place ? ` — local time in ${place}` : ' — the source’s own local time'}`
}

/** `+09:00` → `UTC+9`, `-0330` → `UTC-3:30`, `0` → `UTC`. */
export function utcLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'UTC'
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`
}
