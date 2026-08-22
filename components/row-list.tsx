'use client'

import { useState } from 'react'

import { TimeStamp } from '@/components/time-stamp'

/**
 * One list of rows, collapsed past the first few.
 *
 * ## Why this is shared rather than written per view
 *
 * Because it was written per view, and the second copy was needed within a day
 * of the first. Every gateway that groups things renders the same shape — a
 * headline that may be a link, the publisher's own time, and a line of detail —
 * and every one of them has the same failure mode: a group with 116 members
 * renders 116 rows, and on a phone that is one column of everything. Walked in
 * a real browser before this existed, the crypto gateway came out 12,902 pixels
 * tall and fact-checks 12,233, both longer than the globe page this project had
 * already been told nobody could use, and neither had anything wrong with its
 * data.
 *
 * Capping inside each source is the wrong place: it costs the reader rows they
 * might have wanted, and it has to be remembered again for every gateway anyone
 * adds later. Collapsing at the render is one change that shortens every list
 * there will ever be, removes nothing, and leaves the choice with the reader.
 */
export interface Row {
  /** Stable identity for React. Never the array index. */
  key: string
  headline: string
  url?: string | null
  detail?: string | null
  /** The publisher's own time, never ours. */
  at?: string | null
}

/**
 * Rows shown before a list collapses.
 *
 * Six is enough to see what a group *is* — its shape, its newest entries, the
 * kind of thing in it — without being enough to bury the group after it.
 */
export const ROWS_BEFORE_COLLAPSE = 6

export function RowList({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false)
  const visible = open ? rows : rows.slice(0, ROWS_BEFORE_COLLAPSE)
  const hidden = rows.length - visible.length

  return (
    <>
      <ul className="divide-y divide-border/40">
        {visible.map((row) => (
          <li key={row.key} className="py-2">
            <div className="flex items-baseline justify-between gap-3">
              {row.url ? (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 text-sm font-medium hover:underline"
                >
                  {row.headline}
                </a>
              ) : (
                <span className="min-w-0 text-sm font-medium">{row.headline}</span>
              )}
              {row.at !== undefined ? (
                <TimeStamp iso={row.at} className="shrink-0 text-[11px] text-muted-foreground" />
              ) : null}
            </div>
            {row.detail ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {row.detail}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {rows.length > ROWS_BEFORE_COLLAPSE ? (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="touch-target mt-1 w-full rounded-md border border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
        >
          {/* The real count lives on the control rather than in a footnote,
              because "show all 7" and "show all 385" are different offers and a
              reader deciding whether to press deserves to know which one this
              is. */}
          {open ? 'Show fewer' : `Show all ${rows.length}`}
          {open ? null : <span className="ml-1 opacity-60">({hidden} more)</span>}
        </button>
      ) : null}
    </>
  )
}
