'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ChainRadarReport } from '@/lib/modules/chain-radar'
import {
  STATUS_MEANING,
  UNKNOWN,
  ageLabel,
  concentrationVerdict,
  count,
  directionOf,
  networkStatus,
  percent,
  share,
  signedPercent,
  usd,
  type Direction,
} from '@/lib/analysis/market-format'

/**
 * Markets and chains, on one page.
 *
 * ## Why this exists
 *
 * The chain radar has been producing all of this for some time — four networks
 * with height, fees, congestion, throughput and supply; total capitalisation
 * and dominance; movers with prices; twenty-five exchanges with volumes, shares
 * and trust scores. Almost none of it reached a screen. The globe consumed
 * `venueCountries` to place dots and ignored the rest, so the owner's verdict
 * was accurate: *"لا عملات ولا كل بلوكشين ولا بورصات ولا اي شيئ"* — no coins,
 * no chains, no exchanges, nothing.
 *
 * The work was never to collect this. It was to show it.
 *
 * ## What each section has to earn
 *
 * Every number here carries three things, because a number without them is
 * decoration: **what it is**, **when it was measured**, and **who measured it**
 * with a link back. That is the charter's evidence rule (§6) applied to a
 * dashboard rather than to a report.
 *
 * Nothing is computed that the publisher did not publish. Where a chain reports
 * no congestion, the row says so rather than showing a full bar or an empty one
 * — both of which would be a measurement we invented.
 */

/** How often the page refreshes itself. Matches the radar's own cadence. */
const REFRESH_MS = 120_000

const TONE: Record<Direction, string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
}

const STATUS_TONE: Record<string, string> = {
  quiet: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  normal: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  busy: 'bg-amber-500/15 text-amber-700 dark:text-amber-500',
  congested: 'bg-destructive/15 text-destructive',
  unknown: 'bg-muted text-muted-foreground',
}

export function MarketsPanel() {
  const [report, setReport] = useState<ChainRadarReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/chain', { cache: 'no-store' })
        const body = (await res.json()) as ChainRadarReport & { error?: string }
        if (!alive) return
        if (!res.ok || body.error) setError(body.error ?? `The markets feed answered ${res.status}`)
        else {
          setReport(body)
          setError(null)
        }
      } catch (e) {
        // A stale picture is still shown, and still labelled. Blanking it over
        // one failed poll would throw away something substantially true.
        if (alive) setError(e instanceof Error ? e.message : 'The markets feed did not answer')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  if (!report && loading) {
    return (
      <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading the markets…
      </Card>
    )
  }

  if (!report) {
    return (
      <Card className="p-6">
        <h1 className="text-lg font-bold">Markets &amp; chains</h1>
        <p className="mt-2 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error ?? 'No reading yet.'}
        </p>
      </Card>
    )
  }

  const m = report.market
  const age = ageLabel(report.generatedAt)

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold">Markets &amp; chains</h1>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Live prices, network conditions and where the volume actually trades. Every figure
              carries the agency that measured it and when.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {age ? <span className="tabular-nums">Read {age}</span> : null}
            <Button variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {report.summary.sourcesOk} sources
            </Button>
          </div>
        </div>

        {/* A stale picture, labelled. Never silently stale. */}
        {error ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2 text-[13px] text-amber-700 dark:text-amber-500">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Showing the last good reading — {error}
          </p>
        ) : null}

        {m ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total market cap" value={usd(m.totalMarketCapUsd)} change={m.change24h} />
            <Stat label="24h volume" value={usd(m.totalVolumeUsd)} />
            {/* `percent`, not `share`: the source publishes these already as
                percentages. Passing 59.31 through `share` printed 5931.1%. */}
            <Stat label="BTC dominance" value={percent(m.btcDominance)} />
            <Stat label="ETH dominance" value={percent(m.ethDominance)} />
          </div>
        ) : null}
      </Card>

      {/* ── Networks ─────────────────────────────────────────────────────── */}
      <Card className="p-4">
        <SectionHead
          title="Networks"
          note="Height, cost to transact and how busy each chain is right now. A chain that publishes no congestion measure says so — it is not drawn as quiet."
        />
        {report.networks.length === 0 ? (
          <Empty what="No chain answered this sweep." />
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {report.networks.map((n) => {
            const status = networkStatus(n.congestion)
            return (
              <div key={n.chain} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold">{n.label}</h3>
                  <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {n.symbol}
                  </span>
                </div>
                <span
                  className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[status]}`}
                  title={STATUS_MEANING[status]}
                >
                  {status}
                </span>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {STATUS_MEANING[status]}
                </p>
                <dl className="mt-3 space-y-1 text-[12px]">
                  <Row label="Height" value={count(n.height)} />
                  <Row
                    label="Fee"
                    value={n.fee === null ? UNKNOWN : `${n.fee} ${n.feeUnit ?? ''}`.trim()}
                  />
                  <Row label="TPS" value={n.tps === null ? UNKNOWN : n.tps.toFixed(1)} />
                  <Row label="Pending" value={count(n.pending)} />
                  <Row label="Supply" value={count(n.totalSupply)} />
                </dl>
                <Provenance sourceKey={n.sourceKey} sourceUrl={n.sourceUrl} at={n.at} />
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Movers ───────────────────────────────────────────────────────── */}
      <Card className="p-4">
        <SectionHead
          title="Movers"
          note="Largest moves over 24 hours among the coins the source is tracking. A move under 0.05% is shown as flat rather than coloured — noise is not a direction."
        />
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <MoverList title="Gaining" movers={report.gainers} />
          <MoverList title="Falling" movers={report.losers} />
        </div>
      </Card>

      {/* ── Venues ───────────────────────────────────────────────────────── */}
      <Card className="p-4">
        <SectionHead
          title="Exchanges"
          note="Where the volume actually trades, and under whose jurisdiction. Concentration matters: a market whose volume sits in one venue has one point of failure — and a price that one venue can move."
        />
        {report.venues.length === 0 ? (
          <Empty what="No venue data in this sweep, so there is nothing to concentrate." />
        ) : (
        <>
        <p className="mt-2 text-[13px]">
          <span className="font-medium">{concentrationVerdict(report.venueConcentration)}</span>
          <span className="text-muted-foreground">
            {' '}
            — measured across {report.summary.venuesCounted} venues, concentration index{' '}
            {report.venueConcentration === null ? UNKNOWN : report.venueConcentration.toFixed(3)}
          </span>
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pe-3 font-medium">Venue</th>
                <th className="py-1.5 pe-3 font-medium">Jurisdiction</th>
                <th className="py-1.5 pe-3 text-right font-medium">24h volume (BTC)</th>
                <th className="py-1.5 pe-3 text-right font-medium">Share</th>
                <th className="py-1.5 text-right font-medium">Trust</th>
              </tr>
            </thead>
            <tbody>
              {report.venues.slice(0, 15).map((v) => (
                <tr key={v.name} className="border-b border-border/50">
                  <td className="py-1.5 pe-3">
                    {v.sourceUrl ? (
                      <a
                        href={v.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {v.name}
                      </a>
                    ) : (
                      v.name
                    )}
                  </td>
                  <td className="py-1.5 pe-3 text-muted-foreground">{v.country ?? UNKNOWN}</td>
                  <td className="py-1.5 pe-3 text-right tabular-nums">{count(v.volumeBtc)}</td>
                  <td className="py-1.5 pe-3 text-right tabular-nums">{share(v.share)}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {v.trustScore === null ? UNKNOWN : v.trustScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.venues.length > 15 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {/* Two different numbers, both true: the index is computed over
                every venue the source returned, the table lists the largest.
                Saying only one of them is how a card contradicts itself. */}
            Listing the 15 largest by volume, of {report.venues.length} returned in detail.
          </p>
        ) : null}
        </>
        )}
      </Card>
    </div>
  )
}

/**
 * What an empty section says.
 *
 * An empty grid, or a table with headers and no rows, tells a reader nothing
 * and looks like a fault in the page. A sentence saying which sweep came back
 * empty is the difference between "this is broken" and "nobody published
 * anything in the last two minutes" — and only one of those is true.
 */
function Empty({ what }: { what: string }) {
  return (
    <p className="mt-3 rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground">
      {what} Nothing is being hidden — the sweep runs again in two minutes.
    </p>
  )
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 max-w-prose text-[12px] leading-relaxed text-muted-foreground">{note}</p>
    </>
  )
}

function Stat({
  label,
  value,
  change,
}: {
  label: string
  value: string
  change?: number | null
}) {
  const dir = directionOf(change)
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {change !== undefined ? (
        <p className={`text-[12px] tabular-nums ${TONE[dir]}`}>{signedPercent(change)} · 24h</p>
      ) : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate tabular-nums">{value}</dd>
    </div>
  )
}

function MoverList({ title, movers }: { title: string; movers: ChainRadarReport['gainers'] }) {
  return (
    <div>
      <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {movers.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Nothing reported in this direction in the last reading.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border/60">
          {movers.map((mover) => {
            const dir = directionOf(mover.change)
            return (
              <li key={`${mover.symbol}-${mover.name}`} className="flex items-baseline gap-2 py-1.5">
                {/* `FIGR_HELOC` is ten characters and ran straight into the
                    name beside it at w-14. Wider, and truncating. */}
                <span className="w-24 shrink-0 truncate text-[12px] font-medium uppercase">
                  {mover.symbol}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                  {mover.name}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums">{usd(mover.price)}</span>
                <span className={`w-16 shrink-0 text-right text-[12px] tabular-nums ${TONE[dir]}`}>
                  {signedPercent(mover.change)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Who measured this, and when. A number without both is decoration. */
function Provenance({
  sourceKey,
  sourceUrl,
  at,
}: {
  sourceKey: string
  sourceUrl: string | null
  at: string
}) {
  const age = ageLabel(at)
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
          {sourceKey}
        </a>
      ) : (
        <span className="truncate">{sourceKey}</span>
      )}
      {age ? (
        <>
          <span aria-hidden>·</span>
          <span>{age}</span>
        </>
      ) : null}
    </p>
  )
}
