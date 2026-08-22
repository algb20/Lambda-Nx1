'use client'

import { useMemo, useState } from 'react'

import { Card } from '@/components/ui/card'
import { TimeStamp } from '@/components/time-stamp'
import { RowList } from '@/components/row-list'
import type { BoardReport } from '@/lib/modules/board-shared'

/**
 * One view for every single-authority board.
 *
 * ## Grouping, and choosing what to watch
 *
 * The instruction this was built for: *"gather everything of the same kind
 * together — and at the same moment let me pick two of the ten to watch."*
 *
 * Both halves matter, and most products only build the first. Grouping alone
 * gives you ten headings and a scroll; a filter alone gives you a search box and
 * no sense of the whole. Here the group chips are the summary **and** the
 * control: every group with its count is visible at once, so you can see the
 * shape of the board without reading it, and pressing any of them narrows to
 * exactly those — press two, watch two. Pressing them again lets go.
 *
 * The chips carry counts because a group's size is information: "Notice ×12,
 * Proposed Rule ×5, Presidential Document ×1" is already an answer about what
 * the government did today, before a single row is read.
 *
 * ## Why the same component for all seven
 *
 * Courts, regulation, central-bank speeches, commodity prices, grid output,
 * space weather and orbital objects are not the same subject and are exactly the
 * same shape. Seven views would drift; one cannot.
 *
 * ## Why a group shows only its first rows
 *
 * Because every group used to render every row, always, and on a phone that is
 * one column of everything. Walked in a real browser: **crypto came out
 * 12,902 pixels tall and fact-checks 12,233** — both *longer* than the globe
 * page this project was already told nobody could use, and neither had
 * anything wrong with its data.
 *
 * Capping in each source is the wrong place for this. It costs the reader rows
 * they might have wanted and it has to be remembered again for every new
 * gateway. Collapsing at the *render* is one change that shortens every board
 * there will ever be, removes nothing, and puts the choice with the reader:
 * the first few rows are the shape of the group, and "show all" is one press
 * away with the real count on it.
 */
/**
 * One group's rows, collapsed past the first few.
 *
 * The collapsing itself lives in `RowList`, shared with every other gateway
 * that groups things — the rule about how long a list may get before it needs
 * a reader's permission is one rule, and keeping a second copy of it here is
 * how the two drift.
 *
 * The publisher's own time is always passed, never ours, and `at` is present
 * even when null so the row still says "not stated" rather than silently
 * omitting the column.
 */
function GroupRows({ rows }: { rows: BoardReport['groups'][number]['rows'] }) {
  return (
    <RowList
      rows={rows.map((row, i) => ({
        key: `${row.headline}-${i}`,
        headline: row.headline,
        url: row.url,
        detail: row.detail,
        at: row.at ?? null,
      }))}
    />
  )
}

export function BoardView({
  r,
  title,
  note,
}: {
  r: BoardReport
  title: string
  note: string
}) {
  const [watching, setWatching] = useState<string[]>([])

  const shown = useMemo(
    () => (watching.length === 0 ? r.groups : r.groups.filter((g) => watching.includes(g.name))),
    [r.groups, watching],
  )
  const shownRows = useMemo(() => shown.reduce((n, g) => n + g.rows.length, 0), [shown])

  const toggle = (name: string) =>
    setWatching((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    )

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {watching.length > 0 ? `${shownRows} of ${r.summary.rows}` : `${r.summary.rows}`} records ·{' '}
            {r.summary.groups} groups
            {r.summary.sourcesFailed > 0 ? ` · ${r.summary.sourcesFailed} source failed` : ''}
            {r.summary.newestAt ? ' · newest ' : ''}
            {r.summary.newestAt ? <TimeStamp iso={r.summary.newestAt} /> : null}
          </p>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{note}</p>

        {r.groups.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.groups.map((g) => {
              const on = watching.includes(g.name)
              return (
                <button
                  key={g.name}
                  onClick={() => toggle(g.name)}
                  aria-pressed={on}
                  className={`touch-target rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    on
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {g.name}
                  <span className="ml-1 tabular-nums opacity-60">{g.rows.length}</span>
                </button>
              )
            })}
            {watching.length > 0 ? (
              <button
                onClick={() => setWatching([])}
                className="rounded-full px-2.5 py-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                watch all again
              </button>
            ) : null}
          </div>
        ) : null}
      </Card>

      {shown.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          Nothing came back{r.subject ? ` for “${r.subject}”` : ''}. The publisher may be rate-limiting
          us — try again in a moment.
        </Card>
      ) : (
        // Columns on a wide screen. A board of nine groups is nine screens of
        // scrolling in one column and one screen in three — and the whole
        // reason for grouping is to see the shape of the thing at once.
        // `items-start` so a short group does not stretch to match a tall one.
        <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {shown.map((g) => (
          <Card key={g.name} className="p-4">
            <h4 className="mb-2 flex items-baseline justify-between gap-2 text-sm font-semibold">
              <span className="min-w-0 truncate">{g.name}</span>
              <span className="shrink-0 text-[11px] font-normal tabular-nums text-muted-foreground">
                {g.rows.length}
              </span>
            </h4>
            <GroupRows rows={g.rows} />
          </Card>
        ))}
        </div>
      )}
    </div>
  )
}
