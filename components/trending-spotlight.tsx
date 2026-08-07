'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface TrendingItem {
  title: string
  url: string | null
  description: string | null
  views: number
  corroborated: boolean
  heat: number
  rank: number
}
interface TrendingResponse {
  date: string
  spotlight: TrendingItem[]
}

function compactViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

/**
 * The day's global trending spotlight — the 5–10 subjects the world looked up
 * most, from real view counts (see lib/modules/trending.ts). Honest heat bars;
 * each links to its source. Silently hides if the feed is unavailable.
 */
export function TrendingSpotlight() {
  const [data, setData] = useState<TrendingResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/trending')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: TrendingResponse) => alive && setData(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  if (failed || (data && data.spotlight.length === 0)) return null

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Trending worldwide today</h2>
        {data?.date ? <span className="text-xs text-muted-foreground">· {data.date}</span> : null}
      </div>

      {!data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : (
        <ol className="space-y-2">
          {data.spotlight.map((it) => (
            <li key={it.rank} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground">
                {it.rank}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {it.url ? (
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {it.title}
                    </a>
                  ) : (
                    <span className="truncate text-sm font-medium">{it.title}</span>
                  )}
                  {it.url ? <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
                  {it.corroborated ? (
                    <span
                      title="Seen on multiple independent sources"
                      className="shrink-0 rounded bg-emerald-500/10 px-1 text-[10px] text-emerald-500"
                    >
                      ✓✓
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${it.heat}%` }} />
                </div>
              </div>
              <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                {compactViews(it.views)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Real view counts (Wikipedia / Wikimedia). An interest signal, honestly graded.
      </p>
    </Card>
  )
}
