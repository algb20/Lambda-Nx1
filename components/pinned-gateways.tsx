'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pin, RefreshCw, Settings2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { TimeStamp } from '@/components/time-stamp'
import { usePrefs } from '@/components/prefs-provider'
import { MAX_HOME_GATEWAYS } from '@/lib/prefs/schema'
import { BOARDS, type BoardReport } from '@/lib/modules/board-shared'

/**
 * The gateways a person chose to see the moment they open the app.
 *
 * ## Why pinning, rather than a fixed front page
 *
 * The front page cannot be right for everybody. Someone watching commodity
 * prices and someone watching court filings want different first screens, and a
 * product that picks for them is a product they have to navigate around every
 * time. Up to five, in their own order — five because that is what fits above
 * the fold on a phone, and because a "front page" of twelve boards is not a
 * front page.
 *
 * ## Why only the boards
 *
 * A board answers with no input: it reads one publisher and shows what was
 * published. The investigation gateways need a subject, and a pinned panel that
 * says "type something" is a worse front page than no panel at all.
 *
 * ## What it costs when nothing is pinned
 *
 * Nothing. No pins means no fetch and a single line offering the choice — the
 * default front page is exactly as fast as it was before this existed.
 */
/**
 * Narrowed to the one destination this component offers, rather than the whole
 * tab union: a caller that can navigate anywhere satisfies it, and a caller that
 * only knows about the intelligence tab does too. Widening it would force every
 * caller to carry the shell's full navigation type.
 */
type OpenIntelligence = (tab: 'intelligence') => void

export function PinnedGateways({ onNavigate }: { onNavigate?: OpenIntelligence }) {
  const { prefs, update } = usePrefs()
  const pinned = prefs.homeGateways
  const [editing, setEditing] = useState(false)

  const toggle = (key: string) =>
    update((p) => {
      const has = p.homeGateways.includes(key)
      if (has) return { ...p, homeGateways: p.homeGateways.filter((k) => k !== key) }
      // Silently refuse past the cap rather than dropping the oldest pin: a
      // control that quietly unpins something the user chose is worse than one
      // that does nothing and shows why.
      if (p.homeGateways.length >= MAX_HOME_GATEWAYS) return p
      return { ...p, homeGateways: [...p.homeGateways, key] }
    })

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Pin className="h-4 w-4 text-primary" />
          {pinned.length > 0 ? 'Your gateways' : 'Pin gateways to this page'}
        </h2>
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {editing ? 'Done' : 'Choose'}
        </button>
      </div>

      {editing || pinned.length === 0 ? (
        <Card className="p-3.5">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Pick up to {MAX_HOME_GATEWAYS}. They load here the moment you open the app, in the order
            you pick them.
            {pinned.length >= MAX_HOME_GATEWAYS ? (
              <span className="ml-1 font-medium text-foreground">
                That is {MAX_HOME_GATEWAYS} — remove one to add another.
              </span>
            ) : null}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {BOARDS.map((b) => {
              const on = pinned.includes(b.key)
              const full = !on && pinned.length >= MAX_HOME_GATEWAYS
              return (
                <button
                  key={b.key}
                  onClick={() => toggle(b.key)}
                  aria-pressed={on}
                  disabled={full}
                  title={full ? `Remove one of your ${MAX_HOME_GATEWAYS} first` : b.note}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-40 ${
                    on
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {on ? `${pinned.indexOf(b.key) + 1}. ` : ''}
                  {b.title}
                </button>
              )
            })}
          </div>
        </Card>
      ) : null}

      {pinned.map((key) => {
        const board = BOARDS.find((b) => b.key === key)
        return board ? <PinnedBoard key={key} boardKey={key} title={board.title} onNavigate={onNavigate} /> : null
      })}
    </section>
  )
}

function PinnedBoard({
  boardKey,
  title,
  onNavigate,
}: {
  boardKey: string
  title: string
  onNavigate?: OpenIntelligence
}) {
  const [report, setReport] = useState<BoardReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/intelligence/boards/${boardKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as BoardReport & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? `Request failed (${res.status})`)
      setReport(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [boardKey])

  useEffect(() => {
    void load()
  }, [load])

  // The three biggest groups, two rows each. A pinned panel is a glance, not the
  // board — the board is one tap away and this is what fits above the fold.
  const preview = (report?.groups ?? []).slice(0, 3)

  return (
    <Card className="p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {report ? (
            <span className="tabular-nums">
              {report.summary.rows} records
              {report.summary.newestAt ? ' · ' : ''}
              {report.summary.newestAt ? <TimeStamp iso={report.summary.newestAt} /> : null}
            </span>
          ) : null}
          <button onClick={() => void load()} aria-label={`Refresh ${title}`} className="rounded p-1 hover:bg-muted">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !report ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Reading {title.toLowerCase()}…
        </p>
      ) : error ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{error}</p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((g) => (
            <div key={g.name} className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {g.name} <span className="tabular-nums opacity-70">{g.rows.length}</span>
              </p>
              <ul className="mt-1 space-y-1">
                {g.rows.slice(0, 2).map((row, i) => (
                  <li key={`${row.headline}-${i}`} className="min-w-0">
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 text-[12px] leading-snug hover:underline"
                      >
                        {row.headline}
                      </a>
                    ) : (
                      <span className="line-clamp-2 text-[12px] leading-snug">{row.headline}</span>
                    )}
                    <TimeStamp iso={row.at} className="text-[10px] text-muted-foreground" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {onNavigate ? (
        <button
          onClick={() => onNavigate('intelligence')}
          className="mt-2 text-[11px] text-primary hover:underline"
        >
          Open {title.toLowerCase()} in full
        </button>
      ) : null}
    </Card>
  )
}
