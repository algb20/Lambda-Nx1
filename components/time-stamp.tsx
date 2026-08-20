'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { displayTime, RELATIVE_LIMIT_MS, type TimeOptions } from '@/lib/ui/time'

/**
 * One timestamp component for the whole product.
 *
 * Every surface used to carry its own `timeAgo`, and they disagreed with each
 * other and with reality — the globe stopped at "6d ago", history went on to
 * "3mo ago", and news that happened last week said "1h ago" because it was aged
 * from when we fetched it. The rule now lives in `lib/ui/time.ts` and this is
 * the only thing that renders it.
 *
 * ## Why it ticks, and why only sometimes
 *
 * A label reading "3m ago" is wrong within the minute, so while it is relative
 * the component re-renders on a timer. Once it has become a date it stops — a
 * date does not change, and a page holding two hundred dead timers for two
 * hundred old events is a page that drains a phone battery for nothing.
 *
 * ## Why the tooltip always exists
 *
 * The label is short by necessity; the `title` carries the full stamp in the
 * event's own zone, named. Anyone who needs to know exactly when — which, on an
 * intelligence product, is most readers most of the time — hovers or long-presses
 * and gets an answer that names its own time zone.
 */
export function TimeStamp({
  iso,
  className,
  prefix,
  offsetMinutes,
  place,
  fallback = null,
}: {
  iso: string | null | undefined
  className?: string
  /** Rendered before the label, e.g. "reported". */
  prefix?: string
  /** The source's own UTC offset, in minutes, when it stated one. */
  offsetMinutes?: number | null
  /** Where it happened, named beside its local time in the tooltip. */
  place?: string | null
  /**
   * What to show when there is no time. Defaults to nothing at all: a surface
   * that says "unknown" for every undated item is noisier than one that simply
   * does not claim a time it does not have.
   */
  fallback?: string | null
}) {
  const { locale } = useI18n()
  const [, tick] = useState(0)

  const options: TimeOptions = { locale, offsetMinutes, place }
  const shown = displayTime(iso, options)

  useEffect(() => {
    if (!shown?.relative) return
    // Under an hour the label changes every minute; above it, hourly. Polling
    // every second to re-render "4h ago" is work nobody sees.
    const age = iso ? Date.now() - Date.parse(iso) : 0
    const period = age < 3_600_000 ? 30_000 : 300_000
    const timer = setInterval(() => tick((n) => n + 1), Math.min(period, RELATIVE_LIMIT_MS))
    return () => clearInterval(timer)
  }, [iso, shown?.relative])

  if (!shown) return fallback ? <span className={className}>{fallback}</span> : null

  return (
    <time dateTime={iso ?? undefined} title={shown.title} className={className}>
      {prefix ? `${prefix} ` : ''}
      {shown.label}
    </time>
  )
}
