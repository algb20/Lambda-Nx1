'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, Loader2, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ALL_MODES, type Mode } from '@/lib/gateways'
import { TimeStamp } from '@/components/time-stamp'
import { discardBody } from '@/lib/http/discard'

/**
 * What this account has already investigated.
 *
 * Runs persisted before this and nothing read them back, so every session began
 * from nothing: the same subject looked at three times in a week was three cold
 * starts. History turns that into one press.
 *
 * The panel is deliberately quiet about failure modes, because each means
 * something different and the user deserves the right one:
 *
 *  - **401** — not signed in. The gateways stay open to everyone (charter §1),
 *    so this is an invitation, not an error.
 *  - **503** — the deployment has no database. Nothing the user did wrong.
 *  - **empty** — signed in, database present, nothing investigated yet.
 *
 * Search runs server-side against the subject, debounced, because that is what
 * a person remembers ("that nestle one") and the list can outgrow the client.
 */
export interface HistoryEntry {
  id: string
  gateway: string
  subject: string
  findingCount: number
  createdAt: string
}

const DEBOUNCE_MS = 300


export function HistoryPanel({
  onReopen,
}: {
  /** Puts the run back in the search box and investigates it again. */
  onReopen?: (gateway: Mode, subject: string) => void
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [query, setQuery] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'anonymous' | 'no-db' | 'error'>(
    'loading',
  )
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/investigations?q=${encodeURIComponent(q)}`, {
        cache: 'no-store',
      })
      // These decide from the status and never read the body, so the body has
      // to be let go of explicitly — an abandoned stream holds the connection
      // open for the life of the page. See lib/http/discard.ts.
      if (!res.ok) {
        discardBody(res)
        if (res.status === 401) return setState('anonymous')
        if (res.status === 503) return setState('no-db')
        return setState('error')
      }
      const data = await res.json()
      setEntries(Array.isArray(data?.entries) ? data.entries : [])
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  // Debounced so typing does not fire a query per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => load(query), query ? DEBOUNCE_MS : 0)
    return () => window.clearTimeout(timer)
  }, [query, load])

  const forget = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/investigations?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      // Drop it locally only when the server confirms; otherwise the row would
      // vanish from the screen and stay in the database.
      discardBody(res)
      if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  if (state === 'anonymous') {
    return (
      <Card className="p-3">
        <Heading />
        <p className="text-[11px] leading-snug text-muted-foreground">
          Sign in and your investigations are kept here, so you can search and reopen them. The
          gateways themselves stay open without an account.
        </p>
      </Card>
    )
  }

  if (state === 'no-db') return null // nothing the user can act on
  if (state === 'error') {
    return (
      <Card className="p-3">
        <Heading />
        <p className="text-[11px] text-muted-foreground">History could not be loaded just now.</p>
      </Card>
    )
  }

  return (
    <Card className="p-3">
      <Heading count={state === 'ready' ? entries.length : undefined} />

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute inset-inline-start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what you investigated"
          className="h-8 ps-7 text-xs"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      {state === 'loading' ? (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {query
            ? `Nothing matching “${query}”.`
            : 'Nothing yet. Every investigation you run while signed in appears here.'}
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {entries.map((e) => {
            const reopenable =
              onReopen && (ALL_MODES as readonly string[]).includes(e.gateway) && e.subject.trim()
            return (
              <li key={e.id} className="flex items-center gap-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs leading-tight">{e.subject}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {e.gateway} · {e.findingCount} finding{e.findingCount === 1 ? '' : 's'} ·{' '}
                    <TimeStamp iso={e.createdAt} />
                  </p>
                </div>
                {reopenable ? (
                  <button
                    onClick={() => onReopen(e.gateway as Mode, e.subject)}
                    title="Run this again"
                    aria-label={`Run ${e.subject} again`}
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  onClick={() => forget(e.id)}
                  disabled={busyId === e.id}
                  title="Forget this run"
                  aria-label={`Forget ${e.subject}`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                >
                  {busyId === e.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function Heading({ count }: { count?: number }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <History className="h-3.5 w-3.5 shrink-0 text-primary" />
      <h3 className="text-[13px] font-semibold tracking-tight">Your investigations</h3>
      {typeof count === 'number' && count > 0 ? (
        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
          {count}
        </span>
      ) : null}
    </div>
  )
}
