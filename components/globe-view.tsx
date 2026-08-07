'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Globe2,
  Loader2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  MapPin,
  Radio,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ErrorBoundary } from '@/components/error-boundary'
import { WorldSurface, type SurfacePoint } from '@/components/world-surface'
import type { ViewMode } from '@/lib/geo/projection'
import type { EventCategory, WorldEvent, WorldEventsReport } from '@/lib/modules/world-events'

/**
 * The live world surface — what is happening right now, where, and who measured
 * it. Two projections of the same data (3D globe / flat map, one click apart),
 * category filters, and a click on any dot opens the underlying evidence with a
 * link to the agency that reported it.
 *
 * Refreshes on an interval, but only while the tab is visible: an intelligence
 * page left open in a background tab should not keep hitting public agencies'
 * endpoints, which is both rude and a rate-limit risk (charter §3).
 */

const REFRESH_MS = 5 * 60 * 1000

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso)
  if (!Number.isFinite(diff) || diff < 0) return 'just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function GlobeView() {
  const [report, setReport] = useState<WorldEventsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>('globe')
  const [muted, setMuted] = useState<Set<EventCategory>>(new Set())
  const [selected, setSelected] = useState<WorldEvent | null>(null)

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/world', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || data?.error) throw new Error(data?.error ?? `Request failed (${res.status})`)
      setReport(data as WorldEventsReport)
      setError(null)
    } catch (err) {
      // Keep the last good picture on screen; say why it is not fresh.
      setError(err instanceof Error ? err.message : 'Could not reach the live feeds')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(false)
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') load(true)
    }
    const timer = window.setInterval(tick, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const visibleEvents = useMemo(
    () => (report?.events ?? []).filter((e) => !muted.has(e.category)),
    [report, muted],
  )

  const points: SurfacePoint[] = useMemo(
    () =>
      visibleEvents.map((e) => ({
        id: e.id,
        lat: e.lat as number,
        lon: e.lon as number,
        label: e.title,
        // Severity drives size where it was measured; everything else plots at a
        // uniform, modest size rather than pretending to a magnitude it lacks.
        weight: 1 + e.severity * 3,
        color: e.color,
        intensity: e.severity,
      })),
    [visibleEvents],
  )

  const toggleCategory = (category: EventCategory) => {
    setMuted((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const onSelect = (point: SurfacePoint) => {
    setSelected(visibleEvents.find((e) => e.id === point.id) ?? null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Globe2 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Live world surface</h2>
        {report ? (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {report.summary.placed} plotted · {report.summary.total} events
          </Badge>
        ) : null}
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {report ? `Updated ${timeAgo(report.generatedAt)}` : 'Refresh'}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Natural hazards and seismic events measured by NASA and USGS, plus humanitarian and world
        events from official reporters. Drag to move, scroll to zoom, click any point for its
        source. Switch between the globe and the flat map with one click. Public sources only —
        nothing here touches a target.
      </p>

      <Card className="overflow-hidden p-0">
        {/* The canvas is the riskiest part of this page (2D drawing, pointer
            capture, animation frames). Isolate it so a failure there still
            leaves the event list below usable. */}
        <ErrorBoundary label="The world surface">
          <WorldSurface
            points={points}
            height={440}
            mode={mode}
            onModeChange={setMode}
            onSelect={onSelect}
          />
        </ErrorBoundary>
      </Card>

      {selected ? (
        <Card className="border-primary/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: selected.color }}
                />
                <span className="text-xs font-medium">{selected.categoryLabel}</span>
                {selected.admiralty ? (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {selected.admiralty.source}
                    {selected.admiralty.info}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="text-[10px] capitalize">
                  {selected.confidence}
                </Badge>
              </div>
              <h3 className="font-semibold leading-tight">{selected.title}</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {selected.country ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selected.country}
                  </span>
                ) : null}
                {selected.lat !== null ? (
                  <span className="font-mono">
                    {selected.lat.toFixed(2)}, {(selected.lon as number).toFixed(2)}
                  </span>
                ) : null}
                {selected.magnitude !== null ? (
                  <span>
                    {selected.magnitude} {selected.magnitudeUnit ?? ''}
                  </span>
                ) : null}
                <span>{timeAgo(selected.at)}</span>
                <span className="font-mono">{selected.sourceKey}</span>
              </div>
              {selected.sourceUrl ? (
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Open the source report <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the live feeds…
        </Card>
      ) : null}

      {error ? (
        <Card className="flex items-start gap-2 border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span className="text-muted-foreground">
            {report
              ? `Showing the last good picture — the latest refresh failed: ${error}`
              : error}
          </span>
        </Card>
      ) : null}

      {report && report.categories.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-2 text-sm font-semibold">Layers</h4>
          <div className="flex flex-wrap gap-1.5">
            {report.categories.map((c) => {
              const on = !muted.has(c.category)
              return (
                <button
                  key={c.category}
                  onClick={() => toggleCategory(c.category)}
                  aria-pressed={on}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    on
                      ? 'border-border bg-muted/60 text-foreground'
                      : 'border-dashed border-border/60 text-muted-foreground/60'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color, opacity: on ? 1 : 0.35 }}
                  />
                  {c.label}
                  <span className="text-muted-foreground">{c.count}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            A pulsing point means a measured severity — earthquake magnitude, fire area or a
            tsunami alert. Points that were never measured do not pulse; we do not invent an
            urgency the source did not report.
          </p>
        </Card>
      ) : null}

      {report && report.hotspots.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-2 text-sm font-semibold">Most active countries</h4>
          <div className="flex flex-wrap gap-1.5">
            {report.hotspots.map((h) => (
              <Badge key={h.iso || h.country} variant="outline" className="gap-1">
                {h.country}
                <span className="text-muted-foreground">{h.count}</span>
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      {report && visibleEvents.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Radio className="h-3.5 w-3.5 text-primary" /> Most significant now
          </h4>
          <ul className="divide-y divide-border/60">
            {visibleEvents.slice(0, 12).map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setSelected(e)}
                  className="flex w-full items-start gap-2 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: e.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{e.title}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {e.country ? `${e.country} · ` : ''}
                      {e.categoryLabel} · {timeAgo(e.at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {report && report.unplaceable.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-1 text-sm font-semibold">Reported, but not placeable</h4>
          <p className="mb-2 text-[11px] text-muted-foreground">
            These are real events whose source gave no location. They are listed here rather than
            plotted at a guessed position.
          </p>
          <ul className="space-y-1.5">
            {report.unplaceable.slice(0, 8).map((e) => (
              <li key={e.id} className="text-xs">
                {e.sourceUrl ? (
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-foreground hover:text-primary hover:underline"
                  >
                    {e.title}
                  </a>
                ) : (
                  <span>{e.title}</span>
                )}
                <span className="ml-1 text-muted-foreground">· {timeAgo(e.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {report && !loading && report.summary.total === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          The feeds answered but reported no open events in the current window. The surface stays
          empty rather than showing filler.
        </Card>
      ) : null}
    </div>
  )
}
