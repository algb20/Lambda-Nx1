'use client'

import { useMemo } from 'react'
import { GlyphMark } from '@/components/glyph-mark'
import { hiddenCount } from '@/lib/world/layers'
import {
  CATEGORY_META,
  type EventCategory,
  type WorldEventsReport,
} from '@/lib/modules/world-events-shared'

/**
 * The layer rail — what is drawn on the map, chosen from beside it.
 *
 * ## What the field does, and where it stops
 *
 * WorldMonitor's dashboard carries its layers in a persistent left rail —
 * `layers=conflicts,hotspots,sanctions,weather,outages,natural` in the URL, six
 * checkboxes on the screen. The rail is the right idea and we did not have it:
 * our category toggles were a wrap-flow of chips in a card *below* the canvas,
 * so changing what the map draws meant scrolling past the map, losing sight of
 * the thing being changed, and scrolling back to see what happened.
 *
 * Their rail also stops at a checkbox and a word, and three things are missing
 * from that which an operator actually needs:
 *
 * - **How much of the picture a layer is.** Six ticked boxes say nothing about
 *   whether the map is 90% one category. The bar on each row is that category's
 *   share of the events currently held, so a reader can see at once that what
 *   looks like a busy world is one busy feed.
 * - **What the mark looks like.** Each row carries the exact glyph the canvas
 *   draws, in the same colour, moving the same way. The rail is therefore the
 *   legend, learned where a reader is already working rather than in a panel
 *   they have to go and find.
 * - **What is silent.** A fixed list of six can only ever show six. Ours is the
 *   whole catalogue, and the kinds reporting nothing right now are *stated* —
 *   because a category being silent is a finding, and a rail that lists only
 *   what arrived quietly redefines "no earthquakes reported" as "earthquakes
 *   are not a thing this board tracks".
 *
 * ## Isolating, which is the move the checkbox model makes tedious
 *
 * The common operator gesture is "show me only this one". With checkboxes that
 * is *n − 1* clicks to clear the others, then *n − 1* again to restore them.
 * Every row here carries a one-click **Only**, and the rail header restores all.
 *
 * ## Four screens (charter S10)
 *
 * A vertical rail beside the map from `2xl`, where there is width to spare —
 * measured, not chosen: at 1440 this tab already spends 26rem on a context rail,
 * and a second vertical rail took the canvas from 752px to 530px. Below that the
 * same rows become a horizontal scroll row above the canvas — still
 * adjacent to the map, still never behind it. The counts, glyphs and Only
 * control survive both; only the share bar drops, because a 3px bar inside a
 * chip communicates nothing.
 */

export interface LayerRailProps {
  report: WorldEventsReport | null
  /** Categories currently hidden from the map. */
  muted: Set<EventCategory>
  onToggle: (category: EventCategory) => void
  /** Hide everything except this one. */
  onOnly: (category: EventCategory) => void
  /** Unhide everything. */
  onAll: () => void
}

const CATALOGUE = Object.keys(CATEGORY_META) as EventCategory[]

export function LayerRail({ report, muted, onToggle, onOnly, onAll }: LayerRailProps) {
  const rows = report?.categories ?? []

  /**
   * The denominator for the share bars.
   *
   * Every event held, including the ones a reader has muted — otherwise hiding
   * a large category would inflate every remaining bar, and the bars would
   * measure the filter rather than the world.
   */
  const total = useMemo(() => rows.reduce((sum, r) => sum + r.count, 0), [rows])

  /** Kinds the catalogue can express that reported nothing in this run. */
  const silent = useMemo(() => {
    const present = new Set(rows.map((r) => r.category))
    return CATALOGUE.filter((c) => !present.has(c))
  }, [rows])

  /*
    Counted against what this run carried, not against the muted set — a
    category muted in an earlier run that reports nothing today has nothing
    behind it to restore, and offering to show it is offering nothing.
  */
  const hidden = hiddenCount(
    rows.map((r) => r.category),
    [...muted],
  )

  if (!report) {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-lg border border-border bg-card"
      role="group"
      aria-label="Map layers by category"
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <h3 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide">
          Layers
        </h3>
        {/*
          Stated only when something is hidden. A permanent "0 hidden" is one
          more figure to read on a page that already has plenty, and its whole
          value is telling a reader why the map looks emptier than the counts.
        */}
        {hidden > 0 ? (
          <button
            onClick={onAll}
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:bg-muted"
            title="Show every category on the map again"
          >
            {hidden} hidden · show all
          </button>
        ) : null}
      </div>

      {/*
        `scroll-row` below 2xl, a column from 2xl. One list, two directions —
        rather than two lists that can disagree about what is muted.
      */}
      <div className="scroll-row flex gap-1 p-1.5 2xl:block 2xl:space-y-0.5 2xl:overflow-visible">
        {rows.map((row) => {
          const on = !muted.has(row.category)
          const share = total > 0 ? row.count / total : 0
          return (
            <div
              key={row.category}
              className={`group flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors 2xl:w-full ${
                on ? 'hover:bg-muted/60' : 'opacity-50 hover:bg-muted/40'
              }`}
            >
              <button
                onClick={() => onToggle(row.category)}
                aria-pressed={on}
                title={`${on ? 'Hide' : 'Show'} ${row.label} on the map`}
                className="touch-target flex min-w-0 flex-1 items-center gap-2 text-start"
              >
                {/* The mark the canvas draws, not a colour swatch. */}
                <GlyphMark category={row.category} color={row.color} size={16} dim={!on} />
                <span className="min-w-0 flex-1 truncate text-[11px] leading-tight">
                  {row.label}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {row.count}
                </span>
              </button>
              {/*
                One click to isolate, at every width.

                It was briefly `xl` only, on the reasoning that a chip in the
                sideways row has no space for a second control. That reasoning
                costs a phone reader the whole gesture and leaves them with the
                n − 1 taps this rail exists to remove — and it is the smallest
                screen, where a crowded map is worst, that needs isolating most.
                The row already scrolls, so the cost is width in a direction
                that was never constrained.
              */}
              <button
                onClick={() => onOnly(row.category)}
                title={`Show only ${row.label} on the map`}
                aria-label={`Show only ${row.label} on the map`}
                className="touch-target shrink-0 rounded px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground group-hover:text-primary"
              >
                Only
              </button>
              {/*
                The share bar, on the rail only. Absolute counts answer "how
                many"; this answers "how much of what I am looking at", which is
                the question a busy map actually raises.
              */}
              <span
                className="hidden h-4 w-8 shrink-0 items-end 2xl:flex"
                title={`${Math.round(share * 100)}% of the ${total} events held in this run`}
                aria-hidden
              >
                <span
                  className="w-full rounded-sm"
                  style={{
                    backgroundColor: row.color,
                    // A floor of 1px, so a category with a single event is a
                    // visible sliver rather than an absent bar that reads as
                    // zero. It is proportional above that.
                    height: `${Math.max(1, Math.round(share * 16))}px`,
                    opacity: on ? 0.85 : 0.3,
                  }}
                />
              </span>
            </div>
          )
        })}
      </div>

      {/*
        The silent half of the catalogue.

        Collapsed, because twenty dimmed rows above the ones that matter would
        bury the live picture; present, because dropping them is how a board
        starts implying it only ever tracked what it happens to be showing.
      */}
      {silent.length > 0 ? (
        <details className="border-t border-border/60 px-3 py-1.5">
          <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground">
            {silent.length} more kind{silent.length === 1 ? '' : 's'} reporting nothing
          </summary>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {silent.map((c) => CATEGORY_META[c].label).join(' · ')}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            These are kinds this engine can express and no source reported in this run. Silence is a
            finding — it is not the same as a kind we do not track.
          </p>
        </details>
      ) : null}
    </div>
  )
}
