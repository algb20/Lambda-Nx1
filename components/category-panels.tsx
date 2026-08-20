'use client'

import { useMemo } from 'react'
import { ArrowDown, ArrowUp, LayoutGrid, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { TimeStamp } from '@/components/time-stamp'
import { usePrefs } from '@/components/prefs-provider'
import { PANEL_SIZES, type PanelSize } from '@/lib/prefs/schema'
import {
  CATEGORY_META,
  type EventCategory,
  type WorldEvent,
  type WorldEventsReport,
} from '@/lib/modules/world-events-shared'

/**
 * A panel per category, under the globe.
 *
 * ## What was asked for, and what each part answers
 *
 * *"Every category gets its own box with the most important and newest news,
 * the exact date, the source, the analysis. The box has flow and sequence.
 * Two or three size options. Turning a category on turns its box on with it.
 * Ordered. Below the globe."*
 *
 * - **A box per category** — one panel per `EventCategory`, built from the same
 *   world picture the globe draws. No second fetch: the events are already here,
 *   and a panel that re-queried would show a different world from the dots above
 *   it, which is worse than showing nothing.
 * - **Most important *and* newest** — these are two different orders and both
 *   matter, so a panel is sorted by severity first and time second, and says so.
 *   Sorting only by time buries a red alert under nine routine bulletins;
 *   sorting only by severity shows yesterday's storm above this minute's.
 * - **The exact date** — `<TimeStamp>`: relative for the first day, then a real
 *   date, in the publisher's own time zone where the source stated one.
 * - **The source** — named on every row, and linked where the publisher gave a
 *   link. A finding without its source is not evidence.
 * - **Flow and sequence** — the panel body scrolls on its own, newest at the
 *   top, with the count in the header so a reader knows what they are inside of.
 * - **Three sizes** — compact, regular, wide. Not decoration: compact fits nine
 *   panels on a screen for watching, wide gives one panel the room to be read.
 * - **Turning a category on opens its panel** — the same chip does both, because
 *   two controls for one intention is how a person ends up with a category
 *   showing on the map and no panel, wondering which switch they missed.
 * - **Ordered** — by the user, with arrows, and the order is remembered.
 *
 * Everything here is a preference, so it survives a tab switch, a reload and a
 * new device. That is the whole reason this component holds no state of its own.
 */

/** Newest first, but never above something that is genuinely more serious. */
function rankEvents(a: WorldEvent, b: WorldEvent): number {
  const severity = (b.severity ?? 0) - (a.severity ?? 0)
  if (Math.abs(severity) > 0.15) return severity
  return (b.observedAt ?? b.at).localeCompare(a.observedAt ?? a.at)
}

const ROWS_PER_SIZE: Record<PanelSize, number> = { compact: 6, regular: 10, wide: 16 }

export function CategoryPanels({ report }: { report: WorldEventsReport | null }) {
  const { prefs, update } = usePrefs()
  const open = prefs.globe.panels
  const size = prefs.globe.panelSize

  /** Every category present in the current picture, with its events. */
  const byCategory = useMemo(() => {
    const map = new Map<EventCategory, WorldEvent[]>()
    for (const e of [...(report?.events ?? []), ...(report?.unplaceable ?? [])]) {
      const list = map.get(e.category)
      if (list) list.push(e)
      else map.set(e.category, [e])
    }
    for (const list of map.values()) list.sort(rankEvents)
    return map
  }, [report])

  const available = useMemo(
    () =>
      [...byCategory.entries()]
        .map(([category, events]) => ({ category, count: events.length }))
        .sort((a, b) => b.count - a.count),
    [byCategory],
  )

  const setSize = (next: PanelSize) =>
    update((p) => ({ ...p, globe: { ...p.globe, panelSize: next } }))

  /**
   * One press, both effects.
   *
   * *"Activating a category activates its box with it."* — so opening a panel
   * also un-mutes that category on the map above, and closing one leaves the
   * map alone. The two must never disagree: a panel showing twelve earthquakes
   * while the map hides them is the kind of contradiction that makes a reader
   * stop trusting both.
   *
   * The reverse direction lives in the legend: muting a category there closes
   * its panel, because a hidden category with an open box is the same
   * contradiction wearing the other face.
   */
  const toggle = (category: string) =>
    update((p) => {
      const open = p.globe.panels.includes(category)
      return {
        ...p,
        globe: {
          ...p.globe,
          panels: open ? p.globe.panels.filter((c) => c !== category) : [...p.globe.panels, category],
          // Opening reveals it on the map. Closing does not hide it — the user
          // asked to stop watching the detail, not to remove it from the world.
          muted: open ? p.globe.muted : p.globe.muted.filter((c) => c !== category),
        },
      }
    })

  /** Move a panel one place in the user's own order. */
  const move = (category: string, direction: -1 | 1) =>
    update((p) => {
      const panels = [...p.globe.panels]
      const from = panels.indexOf(category)
      const to = from + direction
      if (from === -1 || to < 0 || to >= panels.length) return p
      ;[panels[from], panels[to]] = [panels[to], panels[from]]
      return { ...p, globe: { ...p.globe, panels } }
    })

  if (!report || available.length === 0) return null

  // Only panels whose category is still in the picture. A category the user
  // opened yesterday that no source is reporting today would otherwise render an
  // empty box and read as a fault.
  const shown = open.filter((c) => byCategory.has(c as EventCategory))

  return (
    <div className="space-y-3">
      <Card className="p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <LayoutGrid className="h-4 w-4" />
              Category panels
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Open a category to watch it below the map. Most serious first, then newest — with the
              source and the publisher&rsquo;s own time on every line.
            </p>
          </div>

          <div className="flex items-center gap-1" role="group" aria-label="Panel size">
            {PANEL_SIZES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSize(s.id)}
                aria-pressed={size === s.id}
                title={s.note}
                className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                  size === s.id
                    ? 'bg-primary/10 font-medium text-primary ring-1 ring-primary/40'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {available.map(({ category, count }) => {
            const on = open.includes(category)
            const hidden = prefs.globe.muted.includes(category)
            const meta = CATEGORY_META[category]
            return (
              <button
                key={category}
                onClick={() => toggle(category)}
                aria-pressed={on}
                /* The map legend above carries these same words for a different
                   action. Each control names its own, so the two are never one
                   guess apart — see the note in globe-view.tsx. */
                aria-label={`${on ? 'Close' : 'Open'} the ${meta?.label ?? category} panel`}
                title={`${on ? 'Close' : 'Open'} the ${meta?.label ?? category} panel`}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  on ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: meta?.color ?? '#94a3b8' }}
                  aria-hidden
                />
                {meta?.label ?? category}
                <span className="tabular-nums opacity-60">{count}</span>
                {/* Named rather than implied: a chip that is off *and* hidden
                    from the map is in a different state from one that is
                    merely closed, and the user needs to see which. */}
                {hidden ? <span className="opacity-50">hidden</span> : null}
              </button>
            )
          })}
          {shown.length > 0 ? (
            <button
              onClick={() => update((p) => ({ ...p, globe: { ...p.globe, panels: [] } }))}
              className="rounded-full px-2.5 py-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              close all
            </button>
          ) : null}
        </div>
      </Card>

      {shown.length === 0 ? null : (
        <div
          className={
            size === 'wide'
              ? 'grid gap-3'
              : size === 'compact'
                ? 'grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
                : 'grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3'
          }
        >
          {shown.map((category, index) => (
            <CategoryPanel
              key={category}
              category={category as EventCategory}
              events={byCategory.get(category as EventCategory) ?? []}
              size={size}
              first={index === 0}
              last={index === shown.length - 1}
              onMove={(d) => move(category, d)}
              onClose={() => toggle(category)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryPanel({
  category,
  events,
  size,
  first,
  last,
  onMove,
  onClose,
}: {
  category: EventCategory
  events: WorldEvent[]
  size: PanelSize
  first: boolean
  last: boolean
  onMove: (direction: -1 | 1) => void
  onClose: () => void
}) {
  const meta = CATEGORY_META[category]
  const rows = events.slice(0, ROWS_PER_SIZE[size])
  // Independent origins, not reports: twenty outlets carrying one wire is one
  // confirmation, and this is the number that says whether a panel is watching
  // a story or an echo.
  const origins = new Set(events.map((e) => e.independence ?? e.sourceKey)).size

  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <header
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderTopColor: meta?.color, borderTopWidth: 2 }}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta?.color }} aria-hidden />
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">{meta?.label ?? category}</h4>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {events.length} · {origins} origin{origins === 1 ? '' : 's'}
        </span>
        <div className="flex shrink-0 items-center">
          <button
            onClick={() => onMove(-1)}
            disabled={first}
            aria-label={`Move ${meta?.label ?? category} earlier`}
            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={last}
            aria-label={`Move ${meta?.label ?? category} later`}
            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            aria-label={`Close ${meta?.label ?? category}`}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/*
        The flow. Scrolls inside itself rather than growing the page, so nine
        open panels stay nine readable boxes instead of nine screens of stack.
      */}
      <ul
        className="divide-y divide-border/40 overflow-y-auto px-3"
        style={{ maxHeight: size === 'compact' ? 200 : size === 'regular' ? 300 : 460 }}
      >
        {rows.map((e) => (
          <li key={e.id} className="py-2">
            <div className="flex items-start justify-between gap-2">
              {e.sourceUrl ? (
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 text-[13px] font-medium leading-snug hover:underline"
                >
                  {e.title}
                </a>
              ) : (
                <span className="min-w-0 text-[13px] font-medium leading-snug">{e.title}</span>
              )}
              {/*
                The event's own time — `observedAt` when the source stated one,
                and only then the sweep time. This is the seam that made
                days-old news read as an hour old.
              */}
              <TimeStamp
                iso={e.observedAt ?? e.at}
                offsetMinutes={e.observedOffsetMinutes ?? null}
                place={e.country}
                className="shrink-0 text-[10px] text-muted-foreground"
              />
            </div>

            {size !== 'compact' ? (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                <span className="font-mono">{e.sourceKey}</span>
                {e.country ? <span>{e.country}</span> : null}
                {e.magnitude !== null ? (
                  <span className="tabular-nums">
                    {e.magnitude}
                    {e.magnitudeUnit ? ` ${e.magnitudeUnit}` : ''}
                  </span>
                ) : null}
                {e.alertLevel ? <span className="font-medium">{e.alertLevel}</span> : null}
                {/* Admiralty and confidence are the analysis. A row without them
                    is a headline; with them it is graded evidence. */}
                {e.admiralty ? (
                  <span title="Admiralty: source reliability letter, information credibility number">
                    {e.admiralty.source}
                    {e.admiralty.info}
                  </span>
                ) : null}
                <span className="capitalize">{e.confidence}</span>
              </p>
            ) : null}

            {size === 'wide' && e.severity > 0 ? (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(e.severity * 100)}%`, background: meta?.color }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  severity {(e.severity * 100).toFixed(0)}%
                </span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {events.length > rows.length ? (
        <p className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
          {events.length - rows.length} more in this category — a larger panel size shows more.
        </p>
      ) : null}
    </Card>
  )
}
