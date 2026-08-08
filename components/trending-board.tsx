'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp,
  Globe2,
  Blocks,
  ChevronDown,
  CheckCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { NewsTicker, type TickerItem } from '@/components/news-ticker'
import type { ChainRadarReport } from '@/lib/modules/chain-radar'
import type { WorldEventsReport } from '@/lib/modules/world-events-shared'

/**
 * The trending board — three lanes of what the world is doing right now, each
 * from a different kind of source, because "trending" from a single feed is a
 * popularity contest rather than intelligence:
 *
 *  - **Attention**: the subjects the world looked up most (real view counts).
 *  - **Events**: what actually happened, measured and located.
 *  - **Chains**: every network's live state and where the liquidity sits.
 *
 * Density is the design constraint. This sits above the feed on a phone, so each
 * lane collapses to a few tight rows and opens on demand — the board reports,
 * it does not occupy. Each lane loads independently and hides itself if its feed
 * is down, so one dead provider never blanks the board.
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
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`
  return String(Math.round(n))
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

/**
 * A lane: a tight header row, a few rows of content, and a disclosure for the
 * rest. Collapsed is the default state — the board's job is to be glanceable.
 */
function Lane({
  icon: Icon,
  title,
  note,
  children,
  more,
}: {
  icon: typeof TrendingUp
  title: string
  note?: string | null
  children: React.ReactNode
  more?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="overflow-hidden p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
        <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
        {note ? (
          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
            {note}
          </span>
        ) : null}
      </div>
      {children}
      {more ? (
        <>
          {open ? <div className="mt-2 border-t border-border/50 pt-2">{more}</div> : null}
          <button
            onClick={() => setOpen(!open)}
            className="mt-1.5 flex w-full items-center justify-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {open ? 'Less' : 'More'}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </>
      ) : null}
    </Card>
  )
}

function Skeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-muted" />
      ))}
    </div>
  )
}

/** Lane 1 — what the world is looking up. */
function AttentionLane() {
  const { data, failed } = useFeed<TrendingResponse>('/api/trending')
  if (failed || (data && data.spotlight.length === 0)) return null

  const row = (it: TrendingItem) => (
    <li key={it.rank} className="flex items-center gap-2 py-0.5">
      <span className="w-3 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {it.rank}
      </span>
      {it.url ? (
        <a
          href={it.url}
          target="_blank"
          rel="noreferrer noopener"
          className="min-w-0 flex-1 truncate text-xs hover:text-primary hover:underline"
        >
          {it.title}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs">{it.title}</span>
      )}
      {it.corroborated ? (
        <CheckCheck
          className="h-3 w-3 shrink-0 text-emerald-500"
          aria-label="Two independent sources"
        />
      ) : null}
      {/* The heat bar is inline, not a full-width row of its own. */}
      <span className="h-1 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${Math.max(6, it.heat)}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {compact(it.views)}
      </span>
    </li>
  )

  return (
    <Lane icon={TrendingUp} title="Trending worldwide" note={data?.date}>
      {!data ? (
        <Skeleton />
      ) : (
        <ol className="divide-y divide-border/40">{data.spotlight.slice(0, 5).map(row)}</ol>
      )}
    </Lane>
  )
}

/**
 * Lane 2 — what actually happened, measured and located.
 *
 * A ticker rather than a list: the rectangle keeps its height whether the world
 * is having a quiet day or a terrible one, and the headlines move through it.
 * Every line links to the agency that reported it.
 */
function EventsLane() {
  const { data, failed } = useFeed<WorldEventsReport>('/api/world')
  if (failed) return null

  // Placed events first (they carry a country), then the real ones we could not
  // place — those are still news, and dropping them would hide real events.
  const events = data ? [...data.events, ...data.unplaceable] : []
  if (data && events.length === 0) return null

  const items: TickerItem[] = events.slice(0, 25).map((e) => ({
    id: e.id,
    text: e.title,
    color: e.color,
    href: e.sourceUrl,
    tag: e.countryIso || null,
    meta: [e.country, e.categoryLabel, e.alertLevel].filter(Boolean).join(' · '),
  }))

  return (
    <Lane
      icon={Globe2}
      title="Happening now"
      note={data ? `${data.summary.placed} located` : null}
    >
      {!data ? <Skeleton /> : <NewsTicker items={items} rows={3} label="Live world events" />}
    </Lane>
  )
}

/** Lane 3 — every chain's live state, and where the liquidity sits. */
function ChainLane() {
  const { data, failed } = useFeed<ChainRadarReport>('/api/chain')
  if (failed) return null
  const nothing =
    data && data.networks.length === 0 && !data.market && data.venues.length === 0
  if (nothing) return null

  return (
    <Lane
      icon={Blocks}
      title="Blockchain radar"
      note={data ? `${data.summary.chains} chains` : null}
      more={
        data ? (
          <div className="space-y-2.5">
            {data.market ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span>
                  Cap{' '}
                  <span className="font-mono text-foreground">
                    ${compact(data.market.totalMarketCapUsd)}
                  </span>
                </span>
                {data.market.change24h !== null ? (
                  <span className={data.market.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                    {data.market.change24h >= 0 ? '+' : ''}
                    {data.market.change24h.toFixed(2)}%
                  </span>
                ) : null}
                {data.market.btcDominance !== null ? (
                  <span>
                    BTC dom{' '}
                    <span className="font-mono text-foreground">
                      {data.market.btcDominance.toFixed(1)}%
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}

            {data.venueCountries.length > 0 ? (
              <div>
                <div className="mb-1 flex items-baseline gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>Liquidity by jurisdiction</span>
                  {data.venueConcentration !== null ? (
                    <span
                      className="ml-auto normal-case tracking-normal"
                      title="How concentrated volume is across venues — 100% would mean a single venue"
                    >
                      concentration {Math.round(data.venueConcentration * 100)}%
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-0.5">
                  {data.venueCountries.slice(0, 6).map((c) => (
                    <li key={c.iso || c.country} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 truncate text-[11px]">{c.country}</span>
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary/70"
                          style={{ width: `${Math.max(2, c.share * 100)}%` }}
                        />
                      </span>
                      <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                        {Math.round(c.share * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.gainers.length > 0 || data.losers.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {[...data.gainers.slice(0, 4), ...data.losers.slice(0, 4)].map((m) => (
                  <span
                    key={m.symbol}
                    className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px]"
                  >
                    <span className="font-mono font-semibold uppercase">{m.symbol}</span>
                    <span className="font-mono tabular-nums">${price(m.price)}</span>
                    <span
                      className={`font-mono tabular-nums ${
                        m.change >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {m.change >= 0 ? '+' : ''}
                      {m.change.toFixed(1)}%
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null
      }
    >
      {!data ? (
        <Skeleton n={2} />
      ) : (
        <ul className="divide-y divide-border/40">
          {data.networks.map((n) => (
            <li key={n.chain} className="flex items-center gap-2 py-1">
              <span className="w-9 shrink-0 font-mono text-[10px] font-semibold uppercase">
                {n.symbol}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] tabular-nums">
                {n.height !== null ? `#${n.height.toLocaleString('en-US')}` : '—'}
              </span>
              {n.tps !== null ? (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {Math.round(n.tps).toLocaleString('en-US')} tx/s
                </span>
              ) : null}
              {n.fee !== null ? (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {n.fee < 10 ? n.fee.toFixed(1) : Math.round(n.fee)} {n.feeUnit}
                </span>
              ) : null}
              {n.congestion !== null ? (
                <span
                  className="h-1 w-8 shrink-0 overflow-hidden rounded-full bg-muted"
                  title={`Congestion ${Math.round(n.congestion * 100)}%`}
                >
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                    style={{ width: `${Math.max(4, n.congestion * 100)}%` }}
                  />
                </span>
              ) : (
                <span className="w-8 shrink-0" />
              )}
            </li>
          ))}
        </ul>
      )}
    </Lane>
  )
}

export function TrendingBoard() {
  return (
    <div className="space-y-2">
      <AttentionLane />
      <EventsLane />
      <ChainLane />
    </div>
  )
}
