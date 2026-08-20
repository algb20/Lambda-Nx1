'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Globe2,
  Loader2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  MapPin,
  Radio,
  X,
  Activity,
  Layers,
  EyeOff,
  GitMerge,
  Timer,
  History,
  Play,
  Pause,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { usePrefs } from '@/components/prefs-provider'
import { CategoryPanels } from '@/components/category-panels'
import { TimeStamp } from '@/components/time-stamp'
import { Badge } from '@/components/ui/badge'
import { ErrorBoundary } from '@/components/error-boundary'
import { WorldSurface, type SurfacePoint } from '@/components/world-surface'
import type { ViewMode } from '@/lib/geo/projection'
import type { ChainRadarReport } from '@/lib/modules/chain-radar'
import {
  CORROBORATION_BANDS,
  LAG_BANDS,
  PLAYBACK_HOURS,
  corroborationBandOf,
  describeWindow,
  detectionLagMinutes,
  fusedByEventId,
  humanHours,
  lagBandOf,
  latencyProfile,
  rankEvents,
  regionOf,
  timeHistogram,
  timedByReceipt,
  utcStamp,
  withinWindow,
  type EventCategory,
  type FusedEventSummary,
  type RankedEvent,
  type Region,
  type TimeWindow,
  type WorldEvent,
  type WorldEventsReport,
} from '@/lib/modules/world-events-shared'

/**
 * The live world surface — what is happening right now, where, who measured it,
 * who else agreed, and how long it took to reach us.
 *
 * Five layers over one renderer, because they are five questions about the same
 * planet and switching between them must not cost a page load:
 *
 *  - **Events** — what happened, graded by a severity a source actually measured.
 *  - **Agreement** — how many independent origins reported each event, and which
 *    ones they contradict each other about. The fusion engine computes this on
 *    every run; until now the interface threw almost all of it away.
 *  - **Latency** — the gap between the world moving and us seeing it. Nothing in
 *    this field draws it, and it is what tells you whether a silence is worth
 *    anything.
 *  - **Blind spots** — where nothing covers us at all.
 *  - **Liquidity** — where the world's crypto volume is booked, by jurisdiction.
 *
 * Across all of them runs a **time cursor**: a trailing window over the last
 * three days that can be scrubbed or played, so a situation can be watched
 * developing instead of being read as a single static now. Events outside the
 * window are removed rather than dimmed — a faded dot still occupies its pixels
 * and still has to be mentally subtracted by the reader.
 *
 * Refreshes on an interval, but only while the tab is visible: an intelligence
 * page left open in a background tab must not keep hitting public agencies'
 * endpoints, which is both rude and a rate-limit risk (charter §3).
 */

const REFRESH_MS = 5 * 60 * 1000

type Layer = 'events' | 'corroboration' | 'latency' | 'coverage' | 'liquidity'

/** The layers that are a view of the event set, and therefore time-scrubbable. */
const EVENT_LAYERS: Layer[] = ['events', 'corroboration', 'latency']

const LAYER_META: Record<
  Layer,
  { label: string; icon: React.ComponentType<{ className?: string }>; question: string }
> = {
  events: {
    label: 'Events',
    icon: Activity,
    question: 'What is happening, where, and how severe a source actually measured it to be.',
  },
  corroboration: {
    label: 'Agreement',
    icon: GitMerge,
    question:
      'How many independent origins reported each event — and which ones they disagree about.',
  },
  latency: {
    label: 'Latency',
    icon: Timer,
    question:
      'How long each report took to reach us. Where that gap is wide, a silence means very little.',
  },
  coverage: {
    label: 'Blind spots',
    icon: EyeOff,
    question: 'Where nothing in the catalogue covers us, so silence is not evidence of calm.',
  },
  liquidity: {
    label: 'Liquidity',
    icon: Layers,
    question: "Where the world's crypto trading volume is booked, by venue jurisdiction.",
  },
}

/** The trailing windows offered. `null` is the filter switched off, the default. */
const WINDOW_CHOICES: Array<number | null> = [null, 72, 24, 6]

/**
 * How many steps a full playback takes. 160 steps at 110 ms is about eighteen
 * seconds for three days — long enough to watch a situation assemble itself,
 * short enough that nobody walks away from it.
 */
const PLAYBACK_STEPS = 160
const PLAYBACK_TICK_MS = 110

/** Bars behind the scrub control. One per ~90 minutes of the playback span. */
const HISTOGRAM_BARS = 48

/**
 * Merge marks closer together than this on screen. Tuned to the dot size the
 * surface draws: below about 22 px two marks are already touching.
 */
const CLUSTER_RADIUS_PX = 24


/**
 * The canvas has to fit a phone as well as a desktop. A fixed 440px filled a
 * small screen entirely and pushed every event below the fold.
 */
function useSurfaceHeight(): number {
  const [height, setHeight] = useState(380)
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      // Never more than half the viewport height, and never taller than wide.
      setHeight(Math.round(Math.max(240, Math.min(w * 0.9, h * 0.5, 460))))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  return height
}

/**
 * The wait, with the truth in it.
 *
 * The first sweep fans out across 119 sources and genuinely takes tens of
 * seconds — that is not a fault, it is what reading the whole world costs. But
 * a bare spinner is indistinguishable from a hang, and after twenty seconds of
 * one a reasonable person concludes the product is broken and leaves.
 *
 * So the wait says what it is doing, how long it has been doing it, and — once
 * it has gone on longer than a healthy sweep ever does — offers the page that
 * explains why an empty map happens.
 */
function SweepProgress() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <Card className="space-y-1 p-3 text-xs text-muted-foreground">
      <p className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading 119 live sources — {seconds}s
      </p>
      {seconds > 8 ? (
        <p>A first sweep reads every publisher at once and normally settles inside half a minute.</p>
      ) : null}
      {seconds > 40 ? (
        <p>
          Longer than a healthy sweep takes.{' '}
          <a href="/setup" className="font-medium text-primary hover:underline">
            Check what this deployment is missing
          </a>
          .
        </p>
      ) : null}
    </Card>
  )
}

export function GlobeView() {
  const [report, setReport] = useState<WorldEventsReport | null>(null)
  const [chain, setChain] = useState<ChainRadarReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /**
   * Five of these used to be plain component state, so switching tabs unmounted
   * the panel and threw every choice away. They are preferences now: written to
   * the browser instantly and to the account on a debounce, so a layout survives
   * a tab switch, a reload, and a new device.
   */
  const { prefs, update } = usePrefs()
  const mode = prefs.globe.view as ViewMode
  const layer = prefs.globe.layer as Layer
  const region = prefs.globe.region as Region | 'all'
  const windowHours = prefs.globe.windowHours
  const muted = useMemo(() => new Set(prefs.globe.muted as EventCategory[]), [prefs.globe.muted])

  const setMode = useCallback(
    (next: ViewMode) => update((p) => ({ ...p, globe: { ...p.globe, view: next } })),
    [update],
  )
  const setLayer = useCallback(
    (next: Layer) => update((p) => ({ ...p, globe: { ...p.globe, layer: next } })),
    [update],
  )
  const setRegion = useCallback(
    (next: Region | 'all') => update((p) => ({ ...p, globe: { ...p.globe, region: next } })),
    [update],
  )
  const setWindowHours = useCallback(
    (next: number | null) => update((p) => ({ ...p, globe: { ...p.globe, windowHours: next } })),
    [update],
  )
  /**
   * Accepts the same updater shape the old `setMuted` took, so every call site
   * that toggles a category chip is unchanged — the set simply now lives
   * somewhere that survives the component.
   */
  const setMuted = useCallback(
    (next: Set<EventCategory> | ((current: Set<EventCategory>) => Set<EventCategory>)) =>
      update((p) => {
        const current = new Set(p.globe.muted as EventCategory[])
        const resolved = typeof next === 'function' ? next(current) : next
        return { ...p, globe: { ...p.globe, muted: [...resolved] } }
      }),
    [update],
  )
  /** The selection is held by id, not by value — see `selected` below. */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** null means pinned to the live edge, which is not the same as "at now". */
  const [cursorMs, setCursorMs] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const height = useSurfaceHeight()

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

  // The liquidity layer is only fetched if someone actually asks for it.
  useEffect(() => {
    if (layer !== 'liquidity' || chain) return
    let alive = true
    fetch('/api/chain', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && !d.error) setChain(d as ChainRadarReport)
      })
      .catch(() => {
        /* the layer simply stays empty and says so */
      })
    return () => {
      alive = false
    }
  }, [layer, chain])

  /**
   * The live edge of the data, not the browser's clock.
   *
   * Taken from the report's own generation time so the timeline is anchored to
   * the picture being displayed: a tab left open for an hour must not drift its
   * cursor away from the data it is actually showing. An event dated after the
   * report was generated (a forecast-stamped advisory) extends the edge rather
   * than falling off the end of the timeline.
   */
  const liveEdgeMs = useMemo(() => {
    if (!report) return Date.now()
    const generated = Date.parse(report.generatedAt)
    let edge = Number.isFinite(generated) ? generated : Date.now()
    for (const event of report.events) {
      const t = Date.parse(event.observedAt ?? event.at)
      if (Number.isFinite(t) && t > edge) edge = t
    }
    return edge
  }, [report])

  const playbackStartMs = liveEdgeMs - PLAYBACK_HOURS * 3_600_000
  const cursor = Math.min(liveEdgeMs, Math.max(playbackStartMs, cursorMs ?? liveEdgeMs))

  const cursorRef = useRef<number | null>(cursorMs)
  cursorRef.current = cursorMs

  /**
   * Playback. Advances the cursor a fixed slice of the span per tick and stops
   * at the live edge, returning the board to its pinned state rather than
   * looping — an operations board that silently restarts three days ago is a
   * board that will eventually be misread as current.
   */
  useEffect(() => {
    if (!playing || windowHours === null) return
    const step = (PLAYBACK_HOURS * 3_600_000) / PLAYBACK_STEPS
    const timer = window.setInterval(() => {
      const next = (cursorRef.current ?? playbackStartMs) + step
      if (next >= liveEdgeMs) {
        setPlaying(false)
        setCursorMs(null)
      } else setCursorMs(next)
    }, PLAYBACK_TICK_MS)
    return () => window.clearInterval(timer)
  }, [playing, windowHours, liveEdgeMs, playbackStartMs])

  const timeWindow: TimeWindow = useMemo(
    () => ({ endMs: cursor, hours: windowHours, liveEdgeMs }),
    [cursor, windowHours, liveEdgeMs],
  )

  /** Category and region filters — the reader's standing choices about scope. */
  const inScope = useMemo(
    () =>
      (report?.events ?? []).filter(
        (e) =>
          !muted.has(e.category) &&
          (region === 'all' || regionOf(e.lat as number, e.lon as number) === region),
      ),
    [report, muted, region],
  )

  /** …and then the window. Outside it, an event is not part of this picture. */
  const inWindow = useMemo(
    () => inScope.filter((e) => withinWindow(e, timeWindow)),
    [inScope, timeWindow],
  )

  /**
   * Every report behind every event, indexed by the event a reader can click.
   * This is the fusion engine's whole output, which the board used to reduce to
   * a headline count.
   */
  const fusedIndex = useMemo(() => fusedByEventId(report?.fused ?? []), [report])

  /**
   * The order, computed here rather than trusted from the wire, because the
   * ranking depends on the cursor: scrubbed back to yesterday, the board must
   * show yesterday's order, not today's applied to yesterday's events.
   */
  const ranked = useMemo(
    () => rankEvents(inWindow, { now: cursor, fused: fusedIndex }),
    [inWindow, cursor, fusedIndex],
  )

  const latency = useMemo(() => latencyProfile(inWindow), [inWindow])
  const receiptTimed = useMemo(() => inWindow.filter(timedByReceipt).length, [inWindow])

  const histogram = useMemo(
    () => timeHistogram(inScope, playbackStartMs, liveEdgeMs, HISTOGRAM_BARS),
    [inScope, playbackStartMs, liveEdgeMs],
  )

  /**
   * The selection is resolved from the current ranking rather than stored whole.
   * If the reader scrubs to a window the selected event is not in, it stops
   * being part of the picture and the panel closes with it — a detail card for
   * something the map is no longer showing is a lie about what is on screen.
   */
  const selected = useMemo(
    () => ranked.find((r) => r.event.id === selectedId) ?? null,
    [ranked, selectedId],
  )

  const points: SurfacePoint[] = useMemo(() => {
    if (layer === 'coverage') {
      /**
       * The layer nobody else draws.
       *
       * Dark regions are plotted **large and red** precisely because there is
       * nothing there. Every other map in this field leaves them blank, which
       * makes a blind spot look like a calm region — and the thinnest coverage
       * is where international attention is scarcest, which is
       * disproportionately where a warning would matter most.
       */
      return (report?.coverage ?? []).map((r) => ({
        id: `coverage:${r.region}`,
        lat: r.lat,
        lon: r.lon,
        label: r.explanation,
        // Inverted on purpose: the *less* we can see, the larger the mark.
        weight: r.status === 'dark' ? 5 : r.status === 'thin' ? 4 : 2,
        color:
          r.status === 'dark'
            ? '#ef4444'
            : r.status === 'thin'
              ? '#f59e0b'
              : r.status === 'quiet'
                ? '#64748b'
                : '#22c55e',
        intensity: r.status === 'dark' ? 1 : r.status === 'thin' ? 0.6 : 0,
      }))
    }
    if (layer === 'liquidity') {
      const countries = chain?.venueCountries ?? []
      const top = countries[0]?.volumeBtc ?? 1
      return countries
        .filter((c) => c.lat !== null && c.lon !== null)
        .map((c) => ({
          id: `venue:${c.iso || c.country}`,
          lat: c.lat,
          lon: c.lon,
          label: `${c.country} — ${Math.round(c.share * 100)}% of measured volume (${c.venues} venues)`,
          // Size by share of world volume, which is what the layer is about.
          weight: 1 + (c.volumeBtc / top) * 4,
          color: '#facc15',
          intensity: 0,
        }))
    }
    if (layer === 'corroboration') {
      /**
       * Sized and coloured by how many independent origins reported the event,
       * with disagreement overriding every count: an event three origins
       * contradict each other about is an open question, not a well-confirmed
       * one, and it must not be drawn in the colour that means settled.
       */
      return ranked.map((r) => {
        const band = corroborationBandOf(r.origins, r.contested)
        return {
          id: r.event.id,
          lat: r.event.lat as number,
          lon: r.event.lon as number,
          label: `${r.event.title} — ${r.contested ? 'origins disagree' : `${r.origins} independent origin${r.origins === 1 ? '' : 's'}`}`,
          weight: 1 + Math.min(4, r.origins),
          color: band.color,
          // No pulse here: the pulse means measured severity everywhere else on
          // this surface and must not come to mean two different things.
          intensity: 0,
        }
      })
    }
    if (layer === 'latency') {
      /**
       * Only events whose source published an observation time can appear: for
       * the rest the gap is unmeasurable, and plotting them at zero lag would
       * flatter every feed that publishes no dates. The count of those is stated
       * in the panel below instead.
       */
      return ranked.flatMap((r) => {
        const lag = detectionLagMinutes(r.event)
        if (lag === null) return []
        const band = lagBandOf(lag)
        return [
          {
            id: r.event.id,
            lat: r.event.lat as number,
            lon: r.event.lon as number,
            label: `${r.event.title} — reached us ${humanHours(lag / 60)} after it happened`,
            weight: 1 + LAG_BANDS.indexOf(band),
            color: band.color,
            intensity: 0,
          },
        ]
      })
    }
    return ranked.map((r) => ({
      id: r.event.id,
      lat: r.event.lat as number,
      lon: r.event.lon as number,
      label: r.event.title,
      // Severity drives size where it was measured; everything else plots at a
      // uniform, modest size rather than pretending to a magnitude it lacks.
      weight: 1 + r.event.severity * 3,
      color: r.event.color,
      intensity: r.event.severity,
    }))
  }, [layer, chain, ranked, report])

  /**
   * Hide or show a category on the map — and close its panel when it is hidden.
   *
   * The two halves of one intention. A category hidden from the map that still
   * has an open panel underneath it is a contradiction the reader has to resolve
   * themselves, and resolving it means deciding which of our two surfaces to
   * believe. Revealing a category does *not* force its panel open: the user
   * asked to see it on the map, which is a smaller request.
   */
  const toggleCategory = (category: EventCategory) =>
    update((p) => {
      const hidden = p.globe.muted.includes(category)
      return {
        ...p,
        globe: {
          ...p.globe,
          muted: hidden ? p.globe.muted.filter((c) => c !== category) : [...p.globe.muted, category],
          panels: hidden ? p.globe.panels : p.globe.panels.filter((c) => c !== category),
        },
      }
    })

  const isEventLayer = EVENT_LAYERS.includes(layer)

  const onSelect = (point: SurfacePoint) => {
    if (!isEventLayer) return
    setSelectedId(point.id ?? null)
  }

  const chooseWindow = (hours: number | null) => {
    setWindowHours(hours)
    // Switching the filter off has to release the cursor too, or the board would
    // keep ranking against a moment the reader can no longer see or change.
    if (hours === null) {
      setPlaying(false)
      setCursorMs(null)
    }
  }

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    // Pressing play at the live edge replays the whole span from its start.
    if (cursorMs === null || cursorMs >= liveEdgeMs - 60_000) setCursorMs(playbackStartMs)
    setPlaying(true)
  }

  const failedSources = report?.sourceHealth.filter((s) => s.status === 'failed') ?? []
  const emptySources = report?.sourceHealth.filter((s) => s.status === 'empty') ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Globe2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Live world surface</h2>
        {report ? (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {report.summary.placed}/{report.summary.total}
          </Badge>
        ) : null}
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          {report ? <TimeStamp iso={report.generatedAt} fallback="Refresh" /> : 'Refresh'}
        </button>
      </div>

      {/* Layer + region controls, above the canvas so they are reachable on a
          phone without scrolling past a full-height globe. The labels collapse
          to icons on a narrow screen; the sentence underneath always names the
          layer in full, so nothing depends on recognising a glyph. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center overflow-hidden rounded-md ring-1 ring-border">
          {(Object.keys(LAYER_META) as Layer[]).map((l) => {
            const Icon = LAYER_META[l].icon
            return (
              <button
                key={l}
                onClick={() => setLayer(l)}
                aria-pressed={layer === l}
                title={LAYER_META[l].label}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] transition-colors ${
                  layer === l
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{LAYER_META[l].label}</span>
              </button>
            )
          })}
        </span>

        {isEventLayer && report && report.regions.length > 1 ? (
          <>
            <button
              onClick={() => setRegion('all')}
              aria-pressed={region === 'all'}
              className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                region === 'all'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              World
            </button>
            {report.regions.map((r) => (
              <button
                key={r.region}
                onClick={() => setRegion(r.region)}
                aria-pressed={region === r.region}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                  region === r.region
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {r.label} <span className="text-muted-foreground">{r.count}</span>
              </button>
            ))}
          </>
        ) : null}
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{LAYER_META[layer].label}.</span>{' '}
        {LAYER_META[layer].question}
      </p>

      {isEventLayer && report ? (
        <TimeScrubber
          window={timeWindow}
          histogram={histogram}
          playbackStartMs={playbackStartMs}
          playing={playing}
          shown={inWindow.length}
          held={inScope.length}
          receiptTimed={receiptTimed}
          onChooseWindow={chooseWindow}
          onScrub={(ms) => {
            setPlaying(false)
            // Landing on the last minute means "live", not "a minute ago": the
            // board has to be able to return to its pinned state by hand.
            setCursorMs(ms >= liveEdgeMs - 60_000 ? null : ms)
          }}
          onTogglePlay={togglePlay}
        />
      ) : null}

      <Card className="overflow-hidden p-0">
        {/* The canvas is the riskiest part of this page (2D drawing, pointer
            capture, animation frames). Isolate it so a failure there still
            leaves the event list below usable. */}
        <ErrorBoundary label="The world surface">
          <WorldSurface
            points={points}
            height={height}
            mode={mode}
            onModeChange={setMode}
            onSelect={isEventLayer ? onSelect : undefined}
            /**
             * Clustering is for the layers that plot hundreds of events. The
             * coverage layer draws ten region marks whose *size* is its
             * message, and the liquidity layer one mark per jurisdiction;
             * merging either would destroy the thing being shown.
             */
            clusterRadius={isEventLayer ? CLUSTER_RADIUS_PX : 0}
          />
        </ErrorBoundary>
      </Card>

      {isEventLayer && report && inWindow.length === 0 && inScope.length > 0 ? (
        <Card className="flex items-start gap-2 border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span className="text-muted-foreground">
            Nothing falls inside this window. {inScope.length} event
            {inScope.length === 1 ? ' is' : 's are'} held outside it — widen the window or return to
            the live edge to see them.
          </span>
        </Card>
      ) : null}

      {layer === 'liquidity' ? (
        <Card className="p-3">
          <h4 className="mb-1 text-xs font-semibold">Where the liquidity sits</h4>
          {!chain ? (
            <p className="text-[11px] text-muted-foreground">Reading venue data…</p>
          ) : chain.venueCountries.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No venue jurisdictions resolved from the current feed.
            </p>
          ) : (
            <>
              <ul className="space-y-1">
                {chain.venueCountries.slice(0, 8).map((c) => (
                  <li key={c.iso || c.country} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate text-[11px]">{c.country}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.max(2, c.share * 100)}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {Math.round(c.share * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                Share of measured 24h volume by the jurisdiction each venue is registered in. This
                is where trading is booked, not where any individual trader is — no public feed
                identifies counterparties, and we do not guess at them.
              </p>
            </>
          )}
        </Card>
      ) : null}

      {selected ? (
        <EventDetail
          ranked={selected}
          position={ranked.indexOf(selected) + 1}
          total={ranked.length}
          fused={fusedIndex.get(selected.event.id) ?? null}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {loading ? <SweepProgress /> : null}

      {error ? (
        <Card className="flex items-start gap-2 border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="space-y-1 text-muted-foreground">
            <p>{report ? `Showing the last good picture — refresh failed: ${error}` : error}</p>
            {/*
              An empty map has three causes that look identical: a deployment
              with no server, a server with no outbound access, and — rarely —
              a genuine fault here. Leaving the reader to guess is the actual
              defect; this hands them the page that tells them which.
            */}
            {!report ? (
              <p>
                Three different things produce an empty map.{' '}
                <a href="/setup" className="font-medium text-primary hover:underline">
                  Find out which one this is
                </a>
                .
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* The agreement layer's own legend and its most-corroborated events. */}
      {layer === 'corroboration' && report ? (
        <Card className="space-y-2 p-3">
          <h4 className="text-xs font-semibold">
            Agreement{' '}
            <span className="font-normal text-muted-foreground">
              counted in independent origins, never in reports
            </span>
          </h4>
          <div className="flex flex-wrap gap-1">
            {CORROBORATION_BANDS.map((band) => {
              const count = ranked.filter(
                (r) => corroborationBandOf(r.origins, r.contested).key === band.key,
              ).length
              return (
                <span
                  key={band.key}
                  className="flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px]"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: band.color }}
                  />
                  {band.label}
                  <span className="text-muted-foreground">{count}</span>
                </span>
              )
            })}
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Twenty outlets carrying one wire are one origin, not twenty. That is why this count is
            smaller than a competitor&apos;s source list and why it is the only one worth putting in
            a confidence grade.
          </p>
          {ranked.filter((r) => r.origins >= 2).length > 0 ? (
            <ul className="space-y-1">
              {ranked
                .filter((r) => r.origins >= 2)
                .slice(0, 6)
                .map((r) => (
                  <li key={r.event.id}>
                    <button
                      onClick={() => setSelectedId(r.event.id)}
                      className="flex w-full items-start gap-2 text-left text-[11px] transition-colors hover:bg-muted/40"
                    >
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: corroborationBandOf(r.origins, r.contested).color,
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{r.event.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {r.origins}×{r.contested ? ' ⚠' : ''}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Nothing in this window was reported by more than one independent origin. That is a
              statement about corroboration, not about whether these events happened.
            </p>
          )}
        </Card>
      ) : null}

      {/* The latency layer's own panel. */}
      {layer === 'latency' && report ? (
        <Card className="space-y-2 p-3">
          <h4 className="text-xs font-semibold">
            Detection latency{' '}
            <span className="font-normal text-muted-foreground">
              {latency.medianMinutes === null
                ? 'no measurable gap in this window'
                : `median ${humanHours(latency.medianMinutes / 60)} from event to receipt`}
            </span>
          </h4>
          <div className="space-y-1">
            {latency.bands.map((band) => (
              <div key={band.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[11px]">{band.label}</span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${latency.timed > 0 ? Math.max(1, (band.count / latency.timed) * 100) : 0}%`,
                      backgroundColor: band.color,
                    }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {band.count}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            The gap between when a source says the event happened and when we received its report.
            It measures the feed and our pipeline, never the event.{' '}
            {latency.untimed > 0 ? (
              <>
                <span className="font-medium text-foreground">{latency.untimed}</span> event
                {latency.untimed === 1 ? '' : 's'} in this window cannot be measured at all — their
                source published no observation time, so they are absent from this layer rather than
                drawn at a lag of zero.
              </>
            ) : null}
          </p>
        </Card>
      ) : null}

      {layer === 'events' && report && report.categories.length > 0 ? (
        <Card className="p-3">
          {/*
            Two rows of chips on this page carry the same words. These hide and
            show categories *on the map*; the "Category panels" picker further
            down opens a category as a readable panel. A live walk-through
            clicked the first "Earthquake" it found, expecting a panel, and hid
            the earthquakes instead — the two controls were indistinguishable
            by name, so the heading and each chip's label now say which is which.
          */}
          <h4 className="mb-0.5 text-xs font-semibold">Show on the map</h4>
          <p className="mb-1.5 text-[10px] text-muted-foreground">
            Hides a category from the globe. To read a category instead, open it under{' '}
            <span className="font-medium">Category panels</span> below.
          </p>
          <div className="flex flex-wrap gap-1">
            {report.categories.map((c) => {
              const on = !muted.has(c.category)
              return (
                <button
                  key={c.category}
                  onClick={() => toggleCategory(c.category)}
                  aria-pressed={on}
                  aria-label={`${on ? 'Hide' : 'Show'} ${c.label} on the map`}
                  title={`${on ? 'Hide' : 'Show'} ${c.label} on the map`}
                  className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${
                    on
                      ? 'border-border bg-muted/60 text-foreground'
                      : 'border-dashed border-border/60 text-muted-foreground/60'
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: c.color, opacity: on ? 1 : 0.35 }}
                  />
                  {c.label}
                  <span className="text-muted-foreground">{c.count}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            A pulsing point carries a real severity — a magnitude, a burnt area, or an agency&apos;s
            own alert level. Points that were never graded do not pulse; we do not invent urgency a
            source did not report. A numbered mark is several events too close together to draw
            apart at this zoom: tap it to fly in and split it.
          </p>
        </Card>
      ) : null}

      {isEventLayer && report && ranked.length > 0 ? (
        <Card className="p-3">
          <h4 className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold">
            <Radio className="h-3 w-3 text-primary" />
            {windowHours === null ? 'Most significant now' : 'Most significant in this window'}
          </h4>
          <p className="mb-1.5 text-[10px] leading-relaxed text-muted-foreground">
            Measured severity, halved every 72 hours of age, then lifted where independent origins
            agree — capped, so corroboration can never outrank a severity. Each line says why it
            sits where it sits.
          </p>
          <ul className="divide-y divide-border/60">
            {ranked.slice(0, 20).map((r) => (
              <li key={r.event.id}>
                <button
                  onClick={() => setSelectedId(r.event.id)}
                  className="flex w-full items-start gap-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: r.event.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{r.event.title}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {r.event.country ? `${r.event.country} · ` : ''}
                      {r.event.categoryLabel} · {r.reasons.join(' · ')}
                    </span>
                  </span>
                  {r.contested ? (
                    <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-500">
                      ⚠
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {isEventLayer && report && report.unplaceable.length > 0 ? (
        <Card className="p-3">
          <h4 className="mb-0.5 text-xs font-semibold">Reported, but not placeable</h4>
          <p className="mb-1.5 text-[10px] text-muted-foreground">
            Real events whose source gave no location — listed here rather than plotted at a guess.
          </p>
          <ul className="space-y-1">
            {report.unplaceable.slice(0, 10).map((e) => (
              <li key={e.id} className="text-[11px]">
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
                <TimeStamp iso={e.observedAt ?? e.at} offsetMinutes={e.observedOffsetMinutes ?? null} place={e.country} className="ml-1 text-muted-foreground" prefix="·" />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/*
        The blind-spot panel.

        Shown only on its own layer, because it answers a different question
        from the events layer and mixing the two would let a reader take a
        coverage warning for a hazard.
      */}
      {layer === 'coverage' && report?.coverage ? (
        <Card className="space-y-2 p-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold">
            <EyeOff className="h-3.5 w-3.5" />
            Where we cannot see
            <span className="font-normal text-muted-foreground">
              {report.coverageSummary.trustworthyRegions} of{' '}
              {report.coverageSummary.totalRegions} regions we can speak about
            </span>
          </h4>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A region with no events may be <strong>quiet</strong> — covered, reporting nothing —
            or <strong>dark</strong>, meaning nothing covers it and silence tells you nothing.
            Every comparable map draws those the same way. This one does not.
          </p>
          <div className="space-y-1">
            {report.coverage.map((r) => (
              <div key={r.region} className="flex items-start gap-2 text-[11px]">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    r.status === 'dark'
                      ? 'bg-destructive'
                      : r.status === 'thin'
                        ? 'bg-amber-500'
                        : r.status === 'quiet'
                          ? 'bg-slate-400'
                          : 'bg-emerald-500'
                  }`}
                />
                <span className="min-w-0">
                  <span className="font-medium">{r.label}</span>{' '}
                  <span className="text-muted-foreground">{r.explanation}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/*
        Fusion. The number competitors never show.

        "142 reports → 38 events" tells a reader the screen summarises more work
        than it displays — and it is the honest way to present a count that
        would otherwise look like *less* coverage than a rival showing every
        duplicate as a separate line. The contested count is the one that
        matters most: sources disagreeing is a finding, not an error to hide.
      */}
      {report?.fusion && report.fusion.signals > 0 ? (
        <Card className="p-3">
          <h4 className="mb-1.5 text-xs font-semibold">
            Event fusion{' '}
            <span className="font-normal text-muted-foreground">
              {report.fusion.signals} reports → {report.fusion.events} events
            </span>
          </h4>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{report.fusion.corroborated}</span>{' '}
              corroborated by more than one origin
            </span>
            {report.fusion.contested > 0 ? (
              <span className="text-amber-600 dark:text-amber-500">
                <span className="font-medium">{report.fusion.contested}</span> contested — sources
                disagree
              </span>
            ) : null}
            {report.fusion.duplicatesRemoved > 0 ? (
              <span>
                <span className="font-medium text-foreground">
                  {report.fusion.duplicatesRemoved}
                </span>{' '}
                duplicate reports absorbed
              </span>
            ) : null}
          </div>

          {/* The contested events themselves, named and openable. */}
          {report.fused
            ?.filter((f) => f.contradictions.length > 0)
            .slice(0, 3)
            .map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedId(f.signals[0]?.id ?? null)}
                className="mt-2 block w-full rounded border border-amber-500/30 p-2 text-left transition-colors hover:bg-amber-500/5"
              >
                <p className="text-[11px] font-medium">{f.title}</p>
                {f.contradictions.map((c, i) => (
                  <p key={i} className="text-[10px] leading-relaxed text-muted-foreground">
                    ⚠ {c.detail} — {c.between.join(' vs ')}
                  </p>
                ))}
              </button>
            ))}
        </Card>
      ) : null}

      {/* Source integrity. A board that quietly loses a feed is a lying board. */}
      {report ? (
        <Card className="p-3">
          <h4 className="mb-1.5 text-xs font-semibold">
            Source integrity{' '}
            <span className="font-normal text-muted-foreground">
              {report.summary.sourcesOk} of {report.sourceHealth.length} contributing
            </span>
          </h4>
          <div className="flex flex-wrap gap-1">
            {report.sourceHealth.map((s) => (
              <span
                key={s.sourceKey}
                title={
                  s.status === 'failed'
                    ? (s.error ?? 'Did not answer')
                    : s.status === 'empty'
                      ? 'Answered, but reported nothing in this window'
                      : `${s.count} event${s.count === 1 ? '' : 's'}`
                }
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                  s.status === 'failed'
                    ? 'border-destructive/40 text-destructive'
                    : s.status === 'empty'
                      ? 'border-amber-500/40 text-amber-600 dark:text-amber-500'
                      : 'border-border text-muted-foreground'
                }`}
              >
                <span
                  className={`h-1 w-1 rounded-full ${
                    s.status === 'failed'
                      ? 'bg-destructive'
                      : s.status === 'empty'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                />
                {s.sourceKey}
                {s.status === 'ok' ? <span className="opacity-60">{s.count}</span> : null}
              </span>
            ))}
          </div>
          {failedSources.length > 0 || emptySources.length > 0 ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              {failedSources.length > 0
                ? `${failedSources.length} feed${failedSources.length === 1 ? '' : 's'} did not answer. `
                : ''}
              {emptySources.length > 0
                ? `${emptySources.length} answered but reported nothing. `
                : ''}
              This picture is therefore incomplete — hover a chip for the reason.
            </p>
          ) : null}
        </Card>
      ) : null}

      {/*
        Why the surface is bare.

        An empty globe with every source reporting healthy is the worst state
        this screen can be in: it looks broken and the diagnostics insist it is
        fine. Whenever there is nothing to draw, the reason is stated here in
        the order that actually explains it — feeds that failed first, then
        feeds that answered with nothing, then the genuinely quiet case.
      */}
      {report && !loading && report.events.length === 0 ? (
        <Card className="space-y-2 border-amber-500/30 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Nothing is plotted right now — here is why
          </p>

          {failedSources.length > 0 ? (
            <div className="space-y-1 text-muted-foreground">
              <p className="font-medium text-foreground">
                {failedSources.length} feed{failedSources.length === 1 ? '' : 's'} could not be
                reached:
              </p>
              <ul className="space-y-0.5">
                {failedSources.map((s) => (
                  <li key={s.sourceKey} className="font-mono text-[10px]">
                    {s.sourceKey} — {s.error ?? 'no answer'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {emptySources.length > 0 ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {emptySources.length} feed{emptySources.length === 1 ? '' : 's'} answered but
                reported nothing
              </span>{' '}
              ({emptySources.map((s) => s.sourceKey).join(', ')}). An absence of reports is not
              evidence that nothing happened — it means these feeds are giving us no coverage of
              this window.
            </p>
          ) : null}

          {failedSources.length === 0 && emptySources.length === 0 ? (
            <p className="text-muted-foreground">
              Every feed answered and none reported an open event in the current window. The
              surface stays empty rather than showing filler.
            </p>
          ) : null}

          {report.unplaceable.length > 0 ? (
            <p className="text-muted-foreground">
              {report.unplaceable.length} event{report.unplaceable.length === 1 ? '' : 's'} arrived
              without a location and are listed above rather than plotted at a guess.
            </p>
          ) : null}
        </Card>
      ) : null}

      {/*
        The panels sit under the map, built from the same world picture the dots
        above them are drawn from — no second fetch, because a panel that
        re-queried would show a different world from the globe it sits beneath.
      */}
      <CategoryPanels report={report} />
    </div>
  )
}

/**
 * The time control.
 *
 * Three parts, in the order a reader needs them: how long a window, where the
 * cursor is, and what that means in words. The histogram behind the slider is
 * the real distribution of reports over the playback span — without it the
 * cursor is dragged blind, and an operator hunting the hour a situation began
 * has to scrub the whole three days to find it.
 */
function TimeScrubber({
  window: timeWindow,
  histogram,
  playbackStartMs,
  playing,
  shown,
  held,
  receiptTimed,
  onChooseWindow,
  onScrub,
  onTogglePlay,
}: {
  window: TimeWindow
  histogram: number[]
  playbackStartMs: number
  playing: boolean
  shown: number
  held: number
  receiptTimed: number
  onChooseWindow: (hours: number | null) => void
  onScrub: (ms: number) => void
  onTogglePlay: () => void
}) {
  const span = timeWindow.liveEdgeMs - playbackStartMs
  const peak = Math.max(1, ...histogram)
  // Which bars the window currently covers, so the slider's meaning is visible
  // rather than implied: the highlighted bars are exactly the events on screen.
  const barMs = span / Math.max(1, histogram.length)
  const firstLit =
    timeWindow.hours === null
      ? 0
      : Math.floor((timeWindow.endMs - timeWindow.hours * 3_600_000 - playbackStartMs) / barMs)
  const lastLit =
    timeWindow.hours === null
      ? histogram.length - 1
      : Math.floor((timeWindow.endMs - playbackStartMs) / barMs)

  return (
    <Card className="space-y-1.5 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <History className="h-3.5 w-3.5 shrink-0 text-primary" />
        {WINDOW_CHOICES.map((hours) => (
          <button
            key={hours ?? 'all'}
            onClick={() => onChooseWindow(hours)}
            aria-pressed={timeWindow.hours === hours}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
              timeWindow.hours === hours
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {hours === null ? 'All held' : `${hours}h window`}
          </button>
        ))}
        {timeWindow.hours !== null ? (
          <button
            onClick={onTogglePlay}
            aria-label={playing ? 'Pause playback' : 'Play the last 72 hours'}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted"
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playing ? 'Pause' : 'Play 72h'}
          </button>
        ) : null}
      </div>

      {timeWindow.hours !== null ? (
        <div className="space-y-1">
          <div className="flex h-6 items-end gap-px" aria-hidden="true">
            {histogram.map((count, i) => (
              <span
                key={i}
                className={`flex-1 rounded-t-[1px] ${
                  i >= firstLit && i <= lastLit ? 'bg-primary' : 'bg-muted-foreground/25'
                }`}
                // A bar with reports in it is never invisible: one event has to
                // be distinguishable from none at a glance.
                style={{ height: `${count === 0 ? 0 : Math.max(12, (count / peak) * 100)}%` }}
              />
            ))}
          </div>
          <input
            type="range"
            min={playbackStartMs}
            max={timeWindow.liveEdgeMs}
            step={60_000}
            value={timeWindow.endMs}
            onChange={(e) => onScrub(Number(e.target.value))}
            aria-label="Time cursor"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        </div>
      ) : null}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {describeWindow(timeWindow)}{' '}
        <span className="text-foreground">
          {shown} of {held} shown.
        </span>{' '}
        {receiptTimed > 0 ? (
          <>
            {receiptTimed} carr{receiptTimed === 1 ? 'ies' : 'y'} no published time and{' '}
            {receiptTimed === 1 ? 'is' : 'are'} placed here by when we received{' '}
            {receiptTimed === 1 ? 'it' : 'them'}.
          </>
        ) : null}
      </p>
    </Card>
  )
}

/**
 * What is behind one dot.
 *
 * The panel this replaces showed a title, a coordinate and one source key —
 * which is to say it showed one report and implied it was the event. Every
 * other report of the same event, the independence groups behind them, their
 * Admiralty ratings and any disagreement between them were all computed on the
 * server and then discarded before the screen.
 *
 * The order here is the order an analyst reads in: what it is, why it ranks
 * where it does, who says so, and what they disagree about.
 */
function EventDetail({
  ranked,
  position,
  total,
  fused,
  onClose,
}: {
  ranked: RankedEvent
  position: number
  total: number
  fused: FusedEventSummary | null
  onClose: () => void
}) {
  const event = ranked.event
  const reports = fused?.signals ?? []

  return (
    <Card className="border-primary/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: event.color }}
            />
            <span className="text-[11px] font-medium">{event.categoryLabel}</span>
            {event.alertLevel ? (
              <Badge variant="outline" className="text-[10px]">
                {event.alertLevel}
              </Badge>
            ) : null}
            {event.admiralty ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                {event.admiralty.source}
                {event.admiralty.info}
              </Badge>
            ) : null}
            {ranked.contested ? (
              <Badge
                variant="outline"
                className="border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-500"
              >
                contested
              </Badge>
            ) : null}
          </div>
          <h3 className="text-sm font-semibold leading-tight">{event.title}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {event.country ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.country}
              </span>
            ) : null}
            {event.lat !== null ? (
              <span className="font-mono">
                {event.lat.toFixed(2)}, {(event.lon as number).toFixed(2)}
              </span>
            ) : null}
            {event.magnitude !== null ? (
              <span>
                {event.magnitude} {event.magnitudeUnit ?? ''}
              </span>
            ) : null}
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Why it sits where it does. An ordering nobody can interrogate is an
          ordering they have to take on faith. */}
      <p className="mt-2 rounded bg-muted/50 px-2 py-1 text-[10px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">
          Ranked {position} of {total}
        </span>{' '}
        · {ranked.reasons.join(' · ')}
      </p>

      {/* Both clocks, never collapsed into one. */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>
          Happened:{' '}
          <span className="font-mono text-foreground">
            {event.observedAt ? utcStamp(Date.parse(event.observedAt)) : 'not stated'}
          </span>
        </span>
        <span>
          Received:{' '}
          <span className="font-mono text-foreground">{utcStamp(Date.parse(event.at))}</span>
        </span>
        {detectionLagMinutes(event) !== null ? (
          <span>
            Took{' '}
            <span className="font-mono text-foreground">
              {humanHours((detectionLagMinutes(event) as number) / 60)}
            </span>{' '}
            to reach us
          </span>
        ) : null}
      </div>

      {/* The reports themselves. */}
      <div className="mt-2 border-t border-border/60 pt-2">
        <h4 className="mb-1 text-[11px] font-semibold">
          {reports.length > 1 ? `${reports.length} reports behind this event` : 'The report behind this event'}{' '}
          <span className="font-normal text-muted-foreground">
            {fused && fused.independentSources > 1
              ? `· ${fused.independentSources} independent origins`
              : '· one origin'}
            {fused ? (fused.basis === 'single' ? '' : ' · joined on place and time') : ''}
          </span>
        </h4>

        {reports.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">
            The fusion index does not hold this event — it arrived after the last fusion pass. The
            single source below is what we have.
          </p>
        ) : null}

        <ul className="space-y-1">
          {(reports.length > 0
            ? reports
            : [
                {
                  id: event.id,
                  title: event.title,
                  sourceKey: event.sourceKey,
                  sourceUrl: event.sourceUrl,
                  independence: event.independence ?? event.sourceKey,
                  admiralty: event.admiralty,
                  observedAt: event.observedAt,
                  receivedAt: event.at,
                  magnitude: event.magnitude,
                },
              ]
          ).map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px]">
              <span className="font-mono text-foreground">{s.sourceKey}</span>
              <span className="text-muted-foreground">
                origin <span className="font-mono">{s.independence}</span>
              </span>
              <span className="font-mono text-muted-foreground">
                {s.admiralty ? `${s.admiralty.source}${s.admiralty.info}` : 'ungraded'}
              </span>
              <span className="text-muted-foreground">
                {s.observedAt ? utcStamp(Date.parse(s.observedAt)) : 'no time stated'}
              </span>
              {s.magnitude !== null && s.magnitude !== undefined ? (
                <span className="text-muted-foreground">mag {s.magnitude}</span>
              ) : null}
              {s.sourceUrl ? (
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                >
                  open <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* Disagreement is a finding, not an error to resolve quietly. */}
      {fused && fused.contradictions.length > 0 ? (
        <div className="mt-2 space-y-1 rounded border border-amber-500/30 p-2">
          <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-500">
            The origins do not agree
          </p>
          {fused.contradictions.map((c, i) => (
            <p key={i} className="text-[10px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{c.field}</span> — {c.detail} (
              {c.between.join(' vs ')})
            </p>
          ))}
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Shown rather than resolved. Quietly taking the majority would hide the one fact worth
            knowing here: this is not settled.
          </p>
        </div>
      ) : null}
    </Card>
  )
}
