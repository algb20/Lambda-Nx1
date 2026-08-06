'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ExternalLink, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RadarFinding } from '@/lib/db'

interface WatchlistEntry {
  key: string
  label: string
  group: string
  groupLabel: string
  why: string
}

interface FindingsResponse {
  findings?: RadarFinding[]
  watchlist?: WatchlistEntry[]
  error?: string
}

/** Highest grades first — what is confirmed should lead. */
const CONFIDENCE_ORDER = ['confirmed', 'probable', 'possible', 'unconfirmed']

const CONFIDENCE_STYLE: Record<string, string> = {
  confirmed: 'bg-primary/15 text-primary',
  probable: 'bg-muted text-foreground/80',
  possible: 'bg-muted/60 text-muted-foreground',
  unconfirmed: 'bg-muted/40 text-muted-foreground',
}

function groupWatchlist(watchlist: WatchlistEntry[]): Array<[string, WatchlistEntry[]]> {
  const groups = new Map<string, WatchlistEntry[]>()
  for (const entry of watchlist) {
    groups.set(entry.groupLabel, [...(groups.get(entry.groupLabel) ?? []), entry])
  }
  return [...groups.entries()]
}

/**
 * The internal Radar's knowledge base: what the ⭐ watchlist is reading, and the
 * findings the last sweeps filed. Nothing is invented here — when the store is
 * unavailable the panel says so and still shows what is being watched.
 */
export function RadarKnowledgeBase() {
  const [findings, setFindings] = useState<RadarFinding[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/radar/findings?kind=internal&limit=25')
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as FindingsResponse
        if (cancelled) return
        setWatchlist(data.watchlist ?? [])
        setFindings(data.findings ?? [])
        setNote(res.ok ? null : (data.error ?? 'Knowledge base unavailable'))
      })
      .catch(() => {
        if (!cancelled) setNote('Could not reach the knowledge base')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sorted = [...findings].sort(
    (a, b) =>
      CONFIDENCE_ORDER.indexOf(a.confidence) - CONFIDENCE_ORDER.indexOf(b.confidence) ||
      new Date(b.retrievedAt).getTime() - new Date(a.retrievedAt).getTime(),
  )

  return (
    <Card className="p-4">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <BookOpen className="h-4 w-4" />
        Knowledge base — watchlist
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        The Radar reads these public feeds on a schedule and files what is new, de-duplicated
        and graded. Security, AI research and the paper frontier.
      </p>

      {watchlist.length > 0 ? (
        <div className="mb-3 space-y-2">
          {groupWatchlist(watchlist).map(([groupLabel, entries]) => (
            <div key={groupLabel}>
              <p className="text-[11px] font-medium text-muted-foreground">{groupLabel}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {entries.map((entry) => (
                  <span
                    key={entry.key}
                    title={entry.why}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {entry.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : note ? (
        <p className="py-2 text-xs text-muted-foreground">{note}</p>
      ) : sorted.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No findings filed yet.</p>
      ) : (
        sorted.map((f) => (
          <div key={f.id} className="border-b border-border/40 py-2 last:border-0">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-sm">{f.title}</p>
              <Badge
                variant="secondary"
                className={`shrink-0 text-[10px] ${CONFIDENCE_STYLE[f.confidence] ?? ''}`}
              >
                {f.admiralty ? `${f.admiralty} · ` : ''}
                {f.confidence}
              </Badge>
            </div>
            {f.summary ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{f.summary}</p>
            ) : null}
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{new Date(f.retrievedAt).toLocaleDateString()}</span>
              {f.sourceUrl ? (
                <a
                  href={f.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-foreground"
                >
                  source <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>
        ))
      )}
    </Card>
  )
}
