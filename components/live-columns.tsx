'use client'

import { useMemo } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { TimeStamp } from '@/components/time-stamp'
import { useWorldReport } from '@/hooks/use-world-report'
import {
  CATEGORY_META,
  REGION_LABEL,
  rankEvents,
  regionOf,
  type WorldEvent,
  type WorldEventsReport,
} from '@/lib/modules/world-events-shared'
import { diversify } from '@/lib/analysis/significance'

/**
 * The world as a set of running columns, beside the map rather than beneath it.
 *
 * ## What this is for
 *
 * A globe answers "where". It cannot answer "what is happening", because a dot
 * has no headline — and on a wide screen there is room for both, so putting the
 * reading below the map wastes half the display and forces a scroll to learn
 * anything. Every serious operations board in this field runs columns beside the
 * map for exactly this reason.
 *
 * ## Why by region, and why the regions are the report's own
 *
 * A single global column is dominated by whichever region publishes most, which
 * is reliably North America and Europe — the same failure the ranking already
 * had to fix once. Splitting by region gives the quiet parts of the world a
 * column of their own, and a reader can see at a glance that a region is quiet
 * *because it has few sources* rather than because nothing is happening there.
 *
 * The regions come from the report rather than a list written here, so a new
 * region appears the moment coverage does.
 *
 * ## What each row must carry
 *
 * The publisher and the time, always. A headline with neither is a rumour, and
 * this product's entire claim is that anything it shows can be checked. The time
 * is the publisher's own where they stated one — `TimeStamp` says "not stated"
 * rather than substituting the moment we fetched it.
 */

/** Rows per column. Enough to read a region, few enough to scan several. */
const ROWS = 14

/** How many columns to draw before the rest are folded into "elsewhere". */
const MAX_COLUMNS = 4

interface Column {
  key: string
  label: string
  events: WorldEvent[]
  /** Total available before the cap, so the header can be honest about it. */
  total: number
}

function buildColumns(report: WorldEventsReport | null): Column[] {
  if (!report) return []
  const all = [...report.events, ...report.unplaceable]

  const byRegion = new Map<string, { label: string; events: WorldEvent[] }>()
  for (const event of all) {
    /**
     * Grouped by the same `regionOf` the map's own region filter uses, so a
     * column and the region chip above the globe can never disagree about
     * where something is. Anything with no coordinates gets a column that says
     * so — dropping it would hide real reports, and guessing a region for it
     * would be inventing a fact.
     */
    const region =
      event.lat !== null && event.lon !== null ? regionOf(event.lat, event.lon) : null
    const key = region ?? 'unplaced'
    const label = region ? REGION_LABEL[region] : 'No location stated'
    const bucket = byRegion.get(key)
    if (bucket) bucket.events.push(event)
    else byRegion.set(key, { label, events: [event] })
  }

  return [...byRegion.entries()]
    .map(([key, { label, events }]) => {
      const ranked = rankEvents(events)
      /**
       * The same publisher cap the board uses. Without it a column is whichever
       * agency issues the most bulletins — measured once already, when 17 of the
       * top 20 rows on the whole board were one weather service.
       */
      const board = diversify(
        ranked.map((r) => ({
          ...r,
          sourceKey: r.event.sourceKey,
          category: r.event.category as string,
          severity: r.event.severity,
        })),
        ROWS,
      )
      return { key, label, events: board.taken.map((r) => r.event), total: events.length }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_COLUMNS)
}

export function LiveColumns() {
  const { report, loading, error } = useWorldReport()
  const columns = useMemo(() => buildColumns(report), [report])

  if (loading && !report) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading the world…
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* A stale picture is still shown, and still labelled. Blanking it would
          throw away something substantially true over one failed poll. */}
      {error ? (
        <p className="flex items-start gap-1.5 border-b border-border bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-500">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" />
          Showing the last good sweep — {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-hidden bg-border md:grid-cols-2 2xl:grid-cols-4">
        {columns.map((column) => (
          <section key={column.key} className="flex min-h-0 flex-col bg-background">
            <header className="flex items-baseline justify-between gap-2 border-b border-border px-2 py-1.5">
              <h3 className="truncate text-[11px] font-semibold">{column.label}</h3>
              {/* Both numbers: what is shown, and what exists. A column capped
                  to fourteen rows out of four hundred must not read as a
                  region with fourteen events in it. */}
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {column.events.length}/{column.total}
              </span>
            </header>

            <ul className="min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto">
              {column.events.map((event) => {
                const meta = CATEGORY_META[event.category]
                return (
                  <li key={event.id} className="px-2 py-1.5">
                    <p className="flex items-start gap-1.5 text-[11px] leading-snug">
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: meta?.color ?? '#94a3b8' }}
                        aria-hidden
                      />
                      <span className="min-w-0">{event.title}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-3 text-[10px] text-muted-foreground">
                      {/* The publisher, named. A headline with no source is a
                          rumour, whatever else is true about it. */}
                      {event.sourceUrl ? (
                        <a
                          href={event.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:text-foreground hover:underline"
                        >
                          {event.sourceKey}
                        </a>
                      ) : (
                        <span className="truncate">{event.sourceKey}</span>
                      )}
                      <span aria-hidden>·</span>
                      <TimeStamp iso={event.observedAt ?? event.at} fallback="time not stated" />
                      {event.country ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{event.country}</span>
                        </>
                      ) : null}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
