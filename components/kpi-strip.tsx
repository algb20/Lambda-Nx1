'use client'

import { useMemo } from 'react'
import { buildKpis, type Kpi, type KpiTone } from '@/lib/world/kpis'
import type { WorldEventsReport } from '@/lib/modules/world-events-shared'

/**
 * The headline band above the map.
 *
 * ## The shape, and why it is this one
 *
 * Every operations dashboard worth studying opens with a strip of figures, and
 * ours had none — the globe page began with a title, a chip row and a canvas,
 * so the first quantity a reader met was `0 of 10 on the map` in a badge. The
 * numbers that decide whether the rest of the page can be believed were spread
 * across five cards further down, and three of them were not on the page at all.
 *
 * The figures themselves are computed in `lib/world/kpis` and tested there.
 * This file is only their presentation, and it has two jobs the module cannot
 * do: make a bad figure look bad, and make every figure explain itself without
 * a click.
 *
 * ## Tone is a rule, not decoration
 *
 * A red figure here means a specific measured condition — a feed refused, the
 * newest observation is a day old, events exist and none could be drawn. It is
 * never "high number bad". That matters because the whole point of the strip is
 * to be trusted at a glance, and a colour that sometimes means nothing teaches
 * a reader to ignore it.
 *
 * ## Fitting four screens (charter S10)
 *
 * Two columns on a phone, three on a tablet, six from `xl`. Never a horizontal
 * scroller: a figure a reader has to swipe to find is a figure they will not
 * look at, and unlike a chip row there is no way to know something is off-screen.
 */

const TONE_CLASS: Record<KpiTone, { value: string; dot: string }> = {
  neutral: { value: 'text-foreground', dot: 'bg-muted-foreground/40' },
  good: { value: 'text-foreground', dot: 'bg-emerald-500' },
  warn: { value: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  bad: { value: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
}

function KpiCell({ kpi }: { kpi: Kpi }) {
  const tone = TONE_CLASS[kpi.tone]
  return (
    <div
      className="min-w-0 border-border/60 px-3 py-2 [&:not(:last-child)]:border-e"
      /*
        The sentence is the tooltip rather than a caption. Six captions would
        double the height of the band and turn a glanceable strip into a
        paragraph; six omitted sentences would leave a reader holding a number
        with no idea what it counts. `title` is also what a screen reader
        announces, so this is not a mouse-only affordance.
      */
      title={`${kpi.label} — ${kpi.detail}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
        <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
          {kpi.label}
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`font-mono text-lg font-semibold tabular-nums leading-none ${tone.value}`}>
          {kpi.value}
        </span>
        {kpi.unit ? (
          <span className="truncate text-[10px] text-muted-foreground">{kpi.unit}</span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The strip before the first report arrives.
 *
 * Six skeletons rather than nothing, because the band appearing after the first
 * sweep would shift the map down by its own height at the moment a reader is
 * looking at it. The height is reserved from the first paint.
 */
function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 rounded-lg border border-border bg-card sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="border-border/60 px-3 py-2 [&:not(:last-child)]:border-e">
          <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
          <div className="mt-1.5 h-4 w-10 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function KpiStrip({ report }: { report: WorldEventsReport | null }) {
  /*
    Recomputed when the report changes, and only then. `Date.now()` is read
    inside the memo rather than on every render: the ages here are quoted in
    minutes and hours, so re-deriving them sixty times a second would burn work
    to produce the same six strings.
  */
  const kpis = useMemo(() => (report ? buildKpis(report, Date.now()) : null), [report])

  if (!kpis) return <KpiSkeleton />

  return (
    <div
      className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3 xl:grid-cols-6"
      role="group"
      aria-label="Picture quality for this run"
    >
      {kpis.map((k) => (
        <KpiCell key={k.key} kpi={k} />
      ))}
    </div>
  )
}
