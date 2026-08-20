'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { TimeStamp } from '@/components/time-stamp'
import { useWorldReport } from '@/hooks/use-world-report'
import {
  CATEGORY_META,
  rankEvents,
  type EventCategory,
  type WorldEvent,
  type WorldEventsReport,
} from '@/lib/modules/world-events-shared'
import { diversify } from '@/lib/analysis/significance'
import { isNaturalHazard, splitHazards } from '@/lib/analysis/hazards'

/**
 * The world as a wall of small boxes, one per subject, each with its own stream.
 *
 * ## What changed and why
 *
 * These were four wide columns split by region. Region is the wrong axis for
 * this surface: the map beside it already answers *where*, so splitting the
 * reading by geography asks the same question twice and answers neither well.
 * What a reader cannot get from a map is *what kind of thing is happening* —
 * and that is what a subject box gives them.
 *
 * ## Natural hazards are one box, not thirteen
 *
 * Thirteen of the twenty-five categories are natural hazards, and they are the
 * highest-volume ones because the agencies publishing them are automated. Given
 * one column each they buried everything else, repeating — thirteen labels for
 * one kind of thing is not thirteen kinds of information.
 *
 * So they share a box, and inside it they are split into the two questions that
 * are actually different: **what happened**, and **what is anyone being warned
 * about**. A warning is re-issued, extended and superseded, which is why they
 * dominate by count; an event happens once. See `lib/analysis/hazards`.
 *
 * ## Every box says what it is not showing
 *
 * A box capped at its first rows out of four hundred must not read as a subject
 * with that many events in it, so each header carries both numbers. The cap
 * itself is the same publisher/category limit the board and the auto-publisher
 * use — without it a box is whichever agency is chattiest.
 */

/** Rows per box before scrolling. Small boxes, many of them. */
const ROWS = 12

/** Boxes to draw. Beyond this the subjects are too thin to be worth a box. */
const MAX_BOXES = 12

interface Box {
  key: string
  label: string
  color: string
  /** Present only for the hazard box, which is split in two. */
  split?: { events: WorldEvent[]; warnings: WorldEvent[] }
  events: WorldEvent[]
  /** Everything available before the cap, so the header can be honest. */
  total: number
}

/** The same ranking and cap every other surface uses. */
function topOf(events: WorldEvent[], limit: number): WorldEvent[] {
  const ranked = rankEvents(events)
  return diversify(
    ranked.map((r) => ({
      ...r,
      sourceKey: r.event.sourceKey,
      category: r.event.category as string,
      severity: r.event.severity,
    })),
    limit,
  ).taken.map((r) => r.event)
}

function buildBoxes(report: WorldEventsReport | null): Box[] {
  if (!report) return []
  const all = [...report.events, ...report.unplaceable]

  const hazards: WorldEvent[] = []
  const bySubject = new Map<string, WorldEvent[]>()

  for (const event of all) {
    if (isNaturalHazard(event.category)) {
      hazards.push(event)
      continue
    }
    const bucket = bySubject.get(event.category)
    if (bucket) bucket.push(event)
    else bySubject.set(event.category, [event])
  }

  const boxes: Box[] = []

  if (hazards.length > 0) {
    /**
     * Ranked and capped *before* the split, so the two halves are drawn from
     * one judgement of significance rather than competing. Splitting first and
     * capping each half would let a quiet warning outrank a major earthquake
     * purely by being in the smaller list.
     */
    const top = topOf(hazards, ROWS * 2)
    const { events, warnings } = splitHazards(
      top.map((e) => ({ ...e, title: e.title, alertLevel: e.alertLevel, magnitude: e.magnitude })),
    )
    boxes.push({
      key: 'natural-hazards',
      label: 'Natural hazards',
      color: '#f97316',
      split: { events: events as WorldEvent[], warnings: warnings as WorldEvent[] },
      events: top,
      total: hazards.length,
    })
  }

  for (const [category, events] of bySubject) {
    const meta = CATEGORY_META[category as EventCategory]
    boxes.push({
      key: category,
      label: meta?.label ?? category,
      color: meta?.color ?? '#94a3b8',
      events: topOf(events, ROWS),
      total: events.length,
    })
  }

  return boxes
    .sort((a, b) => {
      // Hazards lead: it is the largest subject and the one a reader scanning
      // for danger looks for first.
      if (a.key === 'natural-hazards') return -1
      if (b.key === 'natural-hazards') return 1
      return b.total - a.total
    })
    .slice(0, MAX_BOXES)
}

/** One row: the headline, the publisher, the time. Never fewer than three. */
function Row({ event, color }: { event: WorldEvent; color: string }) {
  return (
    <li className="px-2 py-1">
      <p className="flex items-start gap-1.5 text-[11px] leading-snug">
        <span
          className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        <span className="min-w-0">{event.title}</span>
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground ltr:pl-3 rtl:pr-3">
        {/* The publisher, named. A headline with no source is a rumour. */}
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
}

/**
 * The hazard box, which is the only one with two halves.
 *
 * The two are tabs rather than two stacked lists because they answer different
 * questions and a reader has one of them at a time. Both counts are always on
 * screen, so choosing "what happened" never hides how many warnings are live —
 * a hazard surface must not let a reader forget there are warnings out.
 */
function HazardBox({ box }: { box: Box }) {
  const [tab, setTab] = useState<'event' | 'warning'>('event')
  const split = box.split!
  const shown = tab === 'event' ? split.events : split.warnings

  return (
    <>
      <div className="flex items-center gap-px border-b border-border">
        {(
          [
            ['event', 'Happened', split.events.length],
            ['warning', 'Warned', split.warnings.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
              tab === key
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            {label} <span className="tabular-nums opacity-70">{count}</span>
          </button>
        ))}
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-border/40 overflow-y-auto">
        {shown.map((event) => (
          <Row key={event.id} event={event} color={CATEGORY_META[event.category]?.color ?? box.color} />
        ))}
      </ul>
    </>
  )
}

export function LiveColumns() {
  const { report, loading, error } = useWorldReport()
  const boxes = useMemo(() => buildBoxes(report), [report])

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

      {/*
        Small boxes rather than wide columns. A subject needs about 20rem to
        read; anything wider is wasted line length, and `auto-fill` turns the
        leftover width into *more subjects on screen* instead of fewer, wider
        ones. That is the whole difference between a dashboard and an article.
      */}
      <div className="grid min-h-0 flex-1 auto-rows-[minmax(0,1fr)] grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-px overflow-y-auto bg-border">
        {boxes.map((box) => (
          <section key={box.key} className="flex min-h-[16rem] min-w-0 flex-col bg-background">
            <header className="flex items-baseline justify-between gap-2 border-b border-border px-2 py-1.5">
              <h3 className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-semibold">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: box.color }}
                  aria-hidden
                />
                {box.label}
              </h3>
              {/* What is drawn over what exists. Twelve rows out of four hundred
                  must not read as a subject with twelve events in it. */}
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {box.split
                  ? `${box.split.events.length + box.split.warnings.length}/${box.total}`
                  : `${box.events.length}/${box.total}`}
              </span>
            </header>

            {box.split ? (
              <HazardBox box={box} />
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-border/40 overflow-y-auto">
                {box.events.map((event) => (
                  <Row key={event.id} event={event} color={box.color} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
