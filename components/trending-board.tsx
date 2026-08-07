'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp,
  ExternalLink,
  Globe2,
  Blocks,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  CheckCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { ChainRadarReport } from '@/lib/modules/chain-radar'
import type { WorldEventsReport } from '@/lib/modules/world-events'

/**
 * The trending board — three lanes of what the world is doing right now, each
 * from a different kind of source, because "trending" from one feed is a
 * popularity contest rather than intelligence:
 *
 *  - **Attention**: the subjects the world looked up most (real view counts).
 *  - **Events**: what actually happened, measured and located.
 *  - **Chains**: on-chain network state and the day's real movers.
 *
 * Each lane loads independently and simply does not render if its feed is
 * unavailable, so one provider being down never blanks the board.
 */

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

function compact(n: number): string {
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

function price(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 1) return n.toFixed(2)
  return n.toPrecision(3)
}

function useFeed<T>(url: string): { data: T | null; failed: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!alive) return
        if (d?.error) setFailed(true)
        else setData(d as T)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [url])
  return { data, failed }
}

function LaneHeader({
  icon: Icon,
  title,
  note,
}: {
  icon: typeof TrendingUp
  title: string
  note?: string
}) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <Icon className="h-4 w-4 shrink-0 translate-y-0.5 text-primary" />
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {note ? <span className="ml-auto text-[11px] text-muted-foreground">{note}</span> : null}
    </div>
  )
}

function SkeletonRows({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="h-6 animate-pulse rounded bg-muted" />
      ))}
    </div>
  )
}

/** Lane 1 — what the world is looking up. */
function AttentionLane() {
  const { data, failed } = useFeed<TrendingResponse>('/api/trending')
  if (failed || (data && data.spotlight.length === 0)) return null

  return (
    <Card className="p-4">
      <LaneHeader icon={TrendingUp} title="Trending worldwide" note={data?.date} />
      {!data ? (
        <SkeletonRows />
      ) : (
        <ol className="space-y-2.5">
          {data.spotlight.map((it) => (
            <li key={it.rank} className="flex items-baseline gap-3">
              <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {it.rank}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {it.url ? (
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate text-sm font-medium hover:text-primary hover:underline"
                    >
                      {it.title}
                    </a>
                  ) : (
                    <span className="truncate text-sm font-medium">{it.title}</span>
                  )}
                  {it.url ? (
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                  ) : null}
                  {it.corroborated ? (
                    <CheckCheck
                      className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                      aria-label="Seen on multiple independent sources"
                    />
                  ) : null}
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                    style={{ width: `${Math.max(4, it.heat)}%` }}
                  />
                </div>
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {compact(it.views)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Real view counts. The bar is size relative to today&apos;s top subject; the double check
        means two independent sources carried it.
      </p>
    </Card>
  )
}

/** Lane 2 — what actually happened, measured and located. */
function EventsLane() {
  const { data, failed } = useFeed<WorldEventsReport>('/api/world')
  if (failed) return null
  const events = data?.events.slice(0, 6) ?? []
  if (data && events.length === 0) return null

  return (
    <Card className="p-4">
      <LaneHeader
        icon={Globe2}
        title="Happening now"
        note={data ? `${data.summary.placed} located` : undefined}
      />
      {!data ? (
        <SkeletonRows n={4} />
      ) : (
        <ul className="divide-y divide-border/60">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: e.color }}
              />
              <div className="min-w-0 flex-1">
                {e.sourceUrl ? (
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate text-sm font-medium hover:text-primary hover:underline"
                  >
                    {e.title}
                  </a>
                ) : (
                  <span className="block truncate text-sm font-medium">{e.title}</span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {e.country ? `${e.country} · ` : ''}
                  {e.categoryLabel}
                  {e.magnitude !== null ? ` · ${e.magnitude} ${e.magnitudeUnit ?? ''}` : ''}
                </span>
              </div>
              {e.admiralty ? (
                <span
                  className="shrink-0 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground"
                  title="Admiralty rating — source reliability × information credibility"
                >
                  {e.admiralty.source}
                  {e.admiralty.info}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Measured by NASA, USGS and official reporters — not headlines about them. Open the world
        surface to see them on the map.
      </p>
    </Card>
  )
}

function MoverRow({
  symbol,
  name,
  value,
  change,
  url,
}: {
  symbol: string
  name: string
  value: number
  change: number
  url: string | null
}) {
  const up = change >= 0
  const Arrow = up ? ArrowUpRight : ArrowDownRight
  return (
    <li className="flex items-center gap-2 py-1.5">
      <span className="w-12 shrink-0 truncate font-mono text-[11px] font-semibold uppercase">
        {symbol}
      </span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground hover:text-primary"
        >
          {name}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{name}</span>
      )}
      <span className="shrink-0 font-mono text-[11px] tabular-nums">${price(value)}</span>
      <span
        className={`flex w-16 shrink-0 items-center justify-end gap-0.5 font-mono text-[11px] tabular-nums ${
          up ? 'text-emerald-500' : 'text-rose-500'
        }`}
      >
        <Arrow className="h-3 w-3" />
        {Math.abs(change).toFixed(1)}%
      </span>
    </li>
  )
}

/** Lane 3 — on-chain state and the day's real movers. */
function ChainLane() {
  const { data, failed } = useFeed<ChainRadarReport>('/api/chain')
  if (failed) return null
  const nothing =
    data && !data.network && !data.market && data.gainers.length === 0 && data.losers.length === 0
  if (nothing) return null

  return (
    <Card className="p-4">
      <LaneHeader icon={Blocks} title="Blockchain radar" note={data?.network ? 'Bitcoin' : undefined} />
      {!data ? (
        <SkeletonRows n={4} />
      ) : (
        <div className="space-y-3">
          {data.network ? (
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Chain tip
                </div>
                <div className="font-mono text-sm tabular-nums">
                  {data.network.tipHeight !== null
                    ? data.network.tipHeight.toLocaleString('en-US')
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Mempool
                </div>
                <div className="font-mono text-sm tabular-nums">
                  {data.network.mempoolCount !== null ? compact(data.network.mempoolCount) : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Next block
                </div>
                <div className="font-mono text-sm tabular-nums">
                  {data.network.fees ? `${data.network.fees.fastest} sat/vB` : '—'}
                </div>
              </div>
              {data.network.congestion !== null ? (
                <div className="col-span-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" /> Congestion
                    </span>
                    <span>{Math.round(data.network.congestion * 100)}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                      style={{ width: `${Math.max(3, data.network.congestion * 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {data.market ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Market cap{' '}
                <span className="font-mono text-foreground">
                  ${compact(data.market.totalMarketCapUsd)}
                </span>
              </span>
              {data.market.change24h !== null ? (
                <span className={data.market.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {data.market.change24h >= 0 ? '+' : ''}
                  {data.market.change24h.toFixed(2)}% 24h
                </span>
              ) : null}
              {data.market.btcDominance !== null ? (
                <span>
                  BTC dominance{' '}
                  <span className="font-mono text-foreground">
                    {data.market.btcDominance.toFixed(1)}%
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}

          {data.gainers.length > 0 || data.losers.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.gainers.length > 0 ? (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Gainers · 24h
                  </div>
                  <ul className="divide-y divide-border/40">
                    {data.gainers.map((m) => (
                      <MoverRow
                        key={m.symbol}
                        symbol={m.symbol}
                        name={m.name}
                        value={m.price}
                        change={m.change}
                        url={m.sourceUrl}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.losers.length > 0 ? (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Losers · 24h
                  </div>
                  <ul className="divide-y divide-border/40">
                    {data.losers.map((m) => (
                      <MoverRow
                        key={m.symbol}
                        symbol={m.symbol}
                        name={m.name}
                        value={m.price}
                        change={m.change}
                        url={m.sourceUrl}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Network state read from the chain&apos;s own public endpoints. Congestion is derived from
        the real next-block fee — we report what moved, we never forecast what will.
      </p>
    </Card>
  )
}

export function TrendingBoard() {
  return (
    <div className="space-y-3">
      <AttentionLane />
      <EventsLane />
      <ChainLane />
    </div>
  )
}
