'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bot,
  Eye,
  Gauge,
  Layers as LayersIcon,
  Loader2,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { discardBody } from '@/lib/http/discard'
import { useWorldReport } from '@/hooks/use-world-report'
import { WorldSurface, type SurfacePoint } from '@/components/world-surface'
import { WorldClock } from '@/components/world-clock'
import { TAB_ICONS } from '@/components/side-nav'
import { tierCounts, tierOf, TIER_LABEL, type Tier } from '@/lib/world/tiers'
import {
  activeSituations,
  dailyTotals,
  eventsInLayers,
  intelligenceHealth,
  latestIntelligence,
  LAYER_GROUPS,
  type LayerGroup,
} from '@/lib/world/dashboard'
import { scoreAllCountries } from '@/lib/analysis/country-risk'
import type { ViewMode } from '@/lib/geo/projection'
import type { MarketsBoardReport } from '@/lib/modules/markets-board'
import type { Tab } from '@/lib/navigation'

/**
 * Home — the R338 reference design, filled only with what is real.
 *
 * Every figure comes from the world sweep, the markets board, the reader's own
 * monitors, or the device clock. Where the reference shows a panel this product
 * has no source for yet (opportunities, decisions), the slot says so instead of
 * carrying a number nobody measured.
 */

const TIER_STYLE: Record<Tier, { text: string; dot: string }> = {
  critical: { text: 'text-red-400', dot: 'bg-red-500' },
  significant: { text: 'text-orange-400', dot: 'bg-orange-500' },
  watch: { text: 'text-amber-300', dot: 'bg-amber-400' },
}

function ago(iso: string | null, now: number): string {
  if (!iso) return 'no time given'
  const ms = now - Date.parse(iso)
  if (!Number.isFinite(ms)) return 'no time given'
  const h = ms / 3_600_000
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`
  if (h < 48) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}

function Panel({
  title,
  action,
  className,
  children,
}: {
  title: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-2xl border border-border bg-card/80 p-4 shadow-sm', className)}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function Sparkline({ series, color, title }: { series: number[]; color: string; title: string }) {
  if (series.length < 2) return null
  const max = Math.max(...series, 1)
  const w = 96
  const h = 32
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title} className="shrink-0">
      <title>{title}</title>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function KpiCard({
  icon: Icon,
  title,
  value,
  note,
  tone,
  series,
  onClick,
}: {
  icon: typeof Activity
  title: string
  value: string
  note: string
  tone: 'blue' | 'red' | 'amber' | 'violet' | 'teal'
  series?: number[]
  onClick?: () => void
}) {
  const tones = {
    blue: { ring: 'border-blue-500/40 from-blue-600/25', icon: 'bg-blue-600', line: '#60a5fa' },
    red: { ring: 'border-red-500/40 from-red-600/25', icon: 'bg-red-600', line: '#f87171' },
    amber: { ring: 'border-amber-500/40 from-amber-500/25', icon: 'bg-amber-500', line: '#fbbf24' },
    violet: { ring: 'border-violet-500/40 from-violet-600/25', icon: 'bg-violet-600', line: '#a78bfa' },
    teal: { ring: 'border-teal-500/40 from-teal-600/25', icon: 'bg-teal-600', line: '#2dd4bf' },
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-2xl border bg-gradient-to-br to-card p-4 text-start transition-colors hover:brightness-110',
        tones.ring,
      )}
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white', tones.icon)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-muted-foreground">{title}</span>
        <span className="block text-2xl font-bold tabular-nums">{value}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{note}</span>
      </span>
      {series ? (
        <Sparkline
          series={series}
          color={tones.line}
          title="Reports per UTC day in this sweep. Sources keep different look-back windows, so older days are under-counted; this is not a trend."
        />
      ) : null}
    </button>
  )
}

function Ring({ value }: { value: number | null }) {
  const r = 26
  const c = 2 * Math.PI * r
  const v = value ?? 0
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden>
      <circle cx="34" cy="34" r={r} stroke="currentColor" className="text-muted" strokeWidth="7" fill="none" />
      <circle
        cx="34"
        cy="34"
        r={r}
        stroke="#2dd4bf"
        strokeWidth="7"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={c - (v / 100) * c}
        strokeLinecap="round"
        transform="rotate(-90 34 34)"
      />
      <text x="34" y="38" textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
        {value === null ? '—' : `${value}%`}
      </text>
    </svg>
  )
}

export function HomeDashboard({ onNavigate }: { onNavigate: (tab: Tab | string) => void }) {
  const { report, loading, error } = useWorldReport()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const [layers, setLayers] = useState<Set<LayerGroup>>(() => new Set(LAYER_GROUPS.map((g) => g.id)))
  const [mode, setMode] = useState<ViewMode>('map')
  const [picked, setPicked] = useState<string | null>(null)

  const [board, setBoard] = useState<MarketsBoardReport | null>(null)
  const [boardFailed, setBoardFailed] = useState(false)
  useEffect(() => {
    let live = true
    fetch('/api/intelligence/board', { method: 'POST' })
      .then((r) => {
        if (r.ok) return r.json()
        discardBody(r)
        throw new Error(String(r.status))
      })
      .then((j: MarketsBoardReport) => live && setBoard(j))
      .catch(() => live && setBoardFailed(true))
    return () => {
      live = false
    }
  }, [])

  const [monitors, setMonitors] = useState<Array<{ id: string; target: string; kind?: string; type?: string }> | 'signed-out' | null>(null)
  useEffect(() => {
    let live = true
    fetch('/api/monitors')
      .then(async (r) => {
        if (r.status === 401 || !r.ok) {
          discardBody(r)
          if (r.status === 401) {
            if (live) setMonitors('signed-out')
            return
          }
          throw new Error(String(r.status))
        }
        const j = await r.json()
        if (live) setMonitors(Array.isArray(j.monitors) ? j.monitors : [])
      })
      .catch(() => live && setMonitors([]))
    return () => {
      live = false
    }
  }, [])

  const derived = useMemo(() => {
    if (!report) return null
    const all = report.events.concat(report.unplaceable)
    const tiers = tierCounts(all)
    const series = dailyTotals(report)
    const health = intelligenceHealth(report)
    const feed = latestIntelligence(report, 6, now)
    const situations = activeSituations(report, 5)
    const observed = scoreAllCountries(all, now).filter((r) => r.observability >= 34)
    const elevated = observed.filter((r) => r.signal >= 34).length
    const risks = [...observed].sort((a, b) => b.signal - a.signal).slice(0, 6)
    return { tiers, series, health, feed, situations, risks, elevated }
  }, [report, now])

  const points: SurfacePoint[] = useMemo(() => {
    if (!report) return []
    return eventsInLayers(report.events, layers)
      .filter((e) => e.lat !== null && e.lon !== null)
      .map((e) => ({
        id: e.id,
        lat: e.lat as number,
        lon: e.lon as number,
        label: e.title,
        weight: 1 + e.severity * 3,
        color: e.color,
        intensity: e.severity,
        category: e.category,
      }))
  }, [report, layers])

  const pickedEvent = picked && report ? report.events.find((e) => e.id === picked) ?? null : null

  const indicators = useMemo(() => {
    if (!board) return []
    const rows = board.sections.flatMap((s) => s.rows)
    const want = ['DCOILBRENTEU', 'DCOILWTICO', 'DHHNGSP', 'VIXCLS', 'BTC', 'ETH', 'USD/EUR']
    return want.map((sym) => rows.find((r) => r.symbol === sym)).filter((r): r is NonNullable<typeof r> => Boolean(r))
  }, [board])

  const toggleLayer = (id: LayerGroup) =>
    setLayers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const pct = (v: number | null) => (v === null ? '—' : `${v}%`)

  return (
    <div className="space-y-4">
      {/* ── KPI row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Activity}
          title="Active situations"
          value={derived ? String(report!.fusion.events) : '…'}
          note={
            derived
              ? `${report!.fusion.corroborated} corroborated by independent origins`
              : 'Reading the sources'
          }
          tone="blue"
          series={derived?.series}
          onClick={() => onNavigate('situations')}
        />
        <KpiCard
          icon={AlertTriangle}
          title="Critical alerts"
          value={derived ? String(derived.tiers.critical) : '…'}
          note={derived ? `${derived.tiers.significant} significant` : 'Agency alert levels and measured severity'}
          tone="red"
          onClick={() => onNavigate('situations')}
        />
        <KpiCard
          icon={Eye}
          title="Watchlist items"
          value={monitors === null ? '…' : monitors === 'signed-out' ? '—' : String(monitors.length)}
          note={monitors === 'signed-out' ? 'Sign in to keep a watchlist' : 'Monitors you keep'}
          tone="amber"
          onClick={() => onNavigate('monitor')}
        />
        <KpiCard
          icon={ShieldAlert}
          title="Countries with elevated signal"
          value={derived ? String(derived.elevated) : '…'}
          note="Among countries we can observe well"
          tone="teal"
          onClick={() => onNavigate('risks')}
        />
      </div>

      {error && !report ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          The world sweep failed: {error}. Nothing below is guessed; panels fill when it answers.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          {/* ── Map + feed ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-card/80">
              {/* On a phone the panel would cover the map it controls, so the
                  same switches become a scrolling row above it. */}
              <div className="scroll-row flex gap-1.5 overflow-x-auto border-b border-border p-2 text-xs sm:hidden">
                {LAYER_GROUPS.map((g) => {
                  const on = layers.has(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggleLayer(g.id)}
                      className={cn(
                        'shrink-0 rounded-full border px-2.5 py-1',
                        on ? 'border-primary bg-primary/20 text-foreground' : 'border-border text-muted-foreground',
                      )}
                    >
                      {g.label}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'map' ? 'globe' : 'map')}
                  className="shrink-0 rounded-full border border-border px-2.5 py-1"
                >
                  {mode === 'map' ? '3D' : '2D'}
                </button>
              </div>
              <div className="absolute start-3 top-3 z-10 hidden w-44 rounded-xl sm:block border border-border bg-background/85 p-2 text-xs backdrop-blur">
                <div className="mb-1 flex items-center gap-1.5 px-1 font-semibold">
                  <LayersIcon className="h-3.5 w-3.5" /> Layers
                </div>
                <ul className="space-y-0.5">
                  {LAYER_GROUPS.map((g) => {
                    const on = layers.has(g.id)
                    return (
                      <li key={g.id}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          onClick={() => toggleLayer(g.id)}
                          className="flex w-full items-center justify-between rounded-md px-1 py-1 hover:bg-muted"
                        >
                          <span>{g.label}</span>
                          <span className={cn('relative h-4 w-7 rounded-full transition-colors', on ? 'bg-primary' : 'bg-muted')}>
                            <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all', on ? 'start-3.5' : 'start-0.5')} />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-2 flex rounded-lg bg-muted p-0.5">
                  {(['globe', 'map'] as ViewMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={cn('flex-1 rounded-md py-1 font-medium', mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                    >
                      {m === 'globe' ? '3D' : '2D'}
                    </button>
                  ))}
                </div>
              </div>

              {loading && !report ? (
                <div className="flex h-[500px] items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="me-2 h-4 w-4 animate-spin" /> Reading the live sources…
                </div>
              ) : (
                <WorldSurface
                  points={points}
                  height={500}
                  mode={mode}
                  onModeChange={setMode}
                  showToggle={false}
                  onSelect={(p) => setPicked(p.id ?? null)}
                  clusterRadius={24}
                  labelBudget={12}
                />
              )}

              {pickedEvent ? (
                <div className="absolute end-3 top-3 z-10 w-64 rounded-xl border border-border bg-background/95 p-3 text-xs shadow-xl">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className={cn('font-semibold', TIER_STYLE[tierOf(pickedEvent)].text)}>
                      {TIER_LABEL[tierOf(pickedEvent)]}
                    </span>
                    <button onClick={() => setPicked(null)} aria-label="Close" className="rounded p-0.5 hover:bg-muted">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mb-2 text-sm font-medium leading-snug">{pickedEvent.title}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
                    <dt>Type</dt>
                    <dd className="text-foreground">{pickedEvent.categoryLabel}</dd>
                    {pickedEvent.country ? (
                      <>
                        <dt>Country</dt>
                        <dd className="text-foreground">{pickedEvent.country}</dd>
                      </>
                    ) : null}
                    <dt>Confidence</dt>
                    <dd className="text-foreground">{pickedEvent.confidence}</dd>
                    <dt>Source</dt>
                    <dd className="truncate text-foreground">{pickedEvent.sourceKey}</dd>
                    <dt>Happened</dt>
                    <dd className="text-foreground">{ago(pickedEvent.observedAt, now)}</dd>
                  </dl>
                  {pickedEvent.sourceUrl ? (
                    <a href={pickedEvent.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block text-primary hover:underline">
                      Open the source
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>

            <Panel
              title="Latest intelligence"
              action={
                <button onClick={() => onNavigate('situations')} className="text-xs text-primary hover:underline">
                  View all
                </button>
              }
            >
              {!derived ? (
                <p className="text-xs text-muted-foreground">Reading the sources…</p>
              ) : derived.feed.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing reported in this sweep.</p>
              ) : (
                <ul className="space-y-3">
                  {derived.feed.map((r) => {
                    const tier = tierOf(r.event)
                    return (
                      <li key={r.event.id} className="flex gap-3">
                        <span
                          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `${r.event.color}33`, color: r.event.color }}
                          aria-hidden
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className={cn('text-[11px] font-semibold', TIER_STYLE[tier].text)}>{TIER_LABEL[tier]}</div>
                          {r.event.sourceUrl ? (
                            <a href={r.event.sourceUrl} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm leading-snug hover:underline">
                              {r.event.title}
                            </a>
                          ) : (
                            <p className="line-clamp-2 text-sm leading-snug">{r.event.title}</p>
                          )}
                          <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
                            <span className="truncate">{r.event.categoryLabel}</span>
                            <span className="shrink-0">{ago(r.event.observedAt ?? r.event.at, now)}</span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {/* ── Health, time, situations ───────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Panel title="Intelligence health" action={<Gauge className="h-4 w-4 text-primary" />}>
              {!derived ? (
                <p className="text-xs text-muted-foreground">Reading the sources…</p>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-3">
                    <Ring value={derived.health.overall} />
                    <div className="text-xs text-muted-foreground">
                      Share of sources that answered with data in this sweep
                      <div className="mt-0.5 text-[11px]">
                        {report!.summary.sourcesOk} ok · {report!.summary.sourcesEmpty} empty · {report!.summary.sourcesFailed} failed
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {[
                      ['Source health', derived.health.sourceHealth],
                      ['Sources reachable', derived.health.reachability],
                      ['Regions observable', derived.health.coverage],
                      ['Events corroborated', derived.health.corroboration],
                      ['Events with source time', derived.health.dated],
                    ].map(([label, v]) => (
                      <li key={label as string} className="flex justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <span className="h-2 w-2 rounded-full bg-teal-400" />
                          {label}
                        </span>
                        <span className="tabular-nums">{pct(v as number | null)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>

            <Panel title="Active situations" action={<button onClick={() => onNavigate('situations')} className="text-xs text-primary hover:underline">View all</button>}>
              {!derived ? (
                <p className="text-xs text-muted-foreground">Reading the sources…</p>
              ) : (
                <ul className="space-y-2.5">
                  {derived.situations.map((s) => (
                    <li key={s.id} className="text-sm">
                      <p className="line-clamp-1 font-medium">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.independentSources} independent origin{s.independentSources === 1 ? '' : 's'} · {s.signals.length} report
                        {s.signals.length === 1 ? '' : 's'}
                        {s.contradictions.length ? ' · origins disagree' : ''} · {ago(s.observedAt ?? s.lastReceivedAt, now)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Global time">
              <WorldClock />
            </Panel>
          </div>

          {/* ── Category strip ───────────────────────────────────────────── */}
          <nav aria-label="Categories" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {(
              [
                ['globe', 'Global view', 'Explore the world'],
                ['situations', 'Geopolitical', 'Situations & alerts'],
                ['markets', 'Economy', 'Markets & finance'],
                ['home', 'Home', 'Your intelligence centre'],
                ['markets', 'Energy', 'Resources & supply'],
                ['intelligence', 'Technology', 'Innovation & research'],
                ['risks', 'Security', 'Risks & threats'],
                ['globe', 'Environment', 'Climate & natural world'],
              ] as Array<[Tab, string, string]>
            ).map(([tab, label, note]) => {
              const Icon = TAB_ICONS[tab]
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onNavigate(tab)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border border-border bg-card/80 p-3 text-start transition-colors hover:border-primary/60',
                    label === 'Home' && 'border-primary bg-primary/20',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{label}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{note}</span>
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="grid min-w-0 grid-cols-1 content-start gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <Panel title="Key global indicators" action={<button onClick={() => onNavigate('markets')} className="text-xs text-primary hover:underline">View all</button>}>
            {board === null && !boardFailed ? (
              <p className="text-xs text-muted-foreground">Reading the markets…</p>
            ) : indicators.length === 0 ? (
              <p className="text-xs text-muted-foreground">The markets board did not answer.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {indicators.map((r) => (
                  <li key={r.symbol} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate" title={r.name}>
                      {r.name.split(' · ')[0]}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                      <span>
                        {r.price.toLocaleString('en-US', { maximumFractionDigits: r.price < 10 ? 4 : 2 })}
                        {r.unit && r.unit !== 'USD' ? ` ${r.unit}` : ''}
                      </span>
                      {r.change === null ? (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      ) : (
                        <span className={cn('text-[11px]', r.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {r.change >= 0 ? '↑' : '↓'} {Math.abs(r.change).toFixed(2)}%
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">Prices as published by each source; never predicted.</p>
          </Panel>

          <Panel title="Top watchlist" action={<button onClick={() => onNavigate('monitor')} className="text-xs text-primary hover:underline">View all</button>}>
            {monitors === null ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : monitors === 'signed-out' ? (
              <p className="text-xs text-muted-foreground">Sign in to keep a watchlist of domains, companies and assets.</p>
            ) : monitors.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing watched yet. Add a monitor from Monitoring &amp; Watchlist.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {monitors.slice(0, 6).map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span className="truncate">{m.target}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{m.kind ?? m.type ?? ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Global risks" action={<button onClick={() => onNavigate('risks')} className="text-xs text-primary hover:underline">View all</button>}>
            {!derived ? (
              <p className="text-xs text-muted-foreground">Reading the sources…</p>
            ) : derived.risks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No country is observed well enough to compare yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {derived.risks.map((r) => {
                  const level = r.signal >= 67 ? 'High' : r.signal >= 34 ? 'Medium' : 'Low'
                  return (
                    <li key={r.iso} className="flex items-center justify-between gap-2">
                      <span className="truncate">{r.country}</span>
                      <span
                        className={cn(
                          'shrink-0 text-xs font-medium',
                          level === 'High' ? 'text-red-400' : level === 'Medium' ? 'text-orange-400' : 'text-sky-300',
                        )}
                        title={`Reported signal ${r.signal}/100 · observability ${r.observability}/100 · ${r.origins} independent origins`}
                      >
                        {level}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">Reported signal among well-observed countries — not a forecast.</p>
          </Panel>

          <Panel title="AI analyst" action={<Bot className="h-4 w-4 text-primary" />}>
            <p className="mb-3 text-xs text-muted-foreground">
              Triages any report: summarises, grades severity, suggests the next pivot. It sorts; it never verifies.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['What changed in the last 24 hours?', 'Which events have independent corroboration?', 'Investigate a company'].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onNavigate('intelligence')}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:border-primary/60"
                >
                  {q}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('intelligence')}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground"
            >
              <Sparkles className="h-4 w-4" /> Open the analyst
            </button>
          </Panel>
        </div>
      </div>
    </div>
  )
}
