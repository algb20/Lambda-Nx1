'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  hasViewState,
  parseViewState,
  shareUrl,
  toSearch,
  type GlobeViewState,
  type ViewDefaults,
} from '@/lib/globe/view-state'
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
  Link2 as LinkIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { KpiStrip } from '@/components/kpi-strip'
import { LayerRail } from '@/components/layer-rail'
import { allLayers, onlyLayer } from '@/lib/world/layers'
import {
  NameList,
  PanelSection,
  SectionIndex,
  type SectionState,
} from '@/components/panel-section'
import { usePrefs } from '@/components/prefs-provider'
import { DensityControl } from '@/components/density-control'
import { collapsedAt, PANEL_SIZE_BY_DENSITY, type Density } from '@/lib/prefs/density'
import { diversify, overflowSummary } from '@/lib/analysis/significance'
import { TimeStamp } from '@/components/time-stamp'
import { Badge } from '@/components/ui/badge'
import { ErrorBoundary } from '@/components/error-boundary'
import { WorldSurface, type SurfacePoint } from '@/components/world-surface'
import { useWorldReport } from '@/hooks/use-world-report'
import { loadWorld } from '@/lib/world/report-store'
import type { ViewMode } from '@/lib/geo/projection'
import type { ChainRadarReport } from '@/lib/modules/chain-radar'
import { originOf } from '@/lib/engine/catalog/origins'
import { discardBody } from '@/lib/http/discard'
import { GlyphMark } from '@/components/glyph-mark'
import {
  CORROBORATION_BANDS,
  LAG_BANDS,
  PLAYBACK_HOURS,
  corroborationBandOf,
  describeWindow,
  detectionLagMinutes,
  fusedByEventId,
  hasCoordinate,
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
 * The refresh clock lives in the shared store (lib/world/report-store), which
 * polls only while the tab is visible: an intelligence page left open in a
 * background tab must not keep hitting public agencies' endpoints, which is both
 * rude and a rate-limit risk (charter §3).
 */

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
      /**
       * A phone gets a map it can see past; a monitor gets a display.
       *
       * The single rule was "never more than half the viewport height, never
       * taller than wide", which is right on a phone — a full-height globe there
       * pushes every event below the fold — and badly wrong on a desktop, where
       * it produced a 450px map on a 900px screen with empty space under it. On
       * a wide screen the globe *is* the page, so it takes the height and leaves
       * only enough room for the controls above it.
       */
      if (w >= 1280) return setHeight(Math.round(Math.max(420, h - 260)))
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
  // One sweep for the whole screen — see the note beside `load` below.
  const { report, loading, refreshing, error } = useWorldReport()
  const [chain, setChain] = useState<ChainRadarReport | null>(null)
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
  /**
   * The view, in the address bar.
   *
   * Two mechanisms that answer different questions and do not overlap:
   * preferences answer *what do I usually want*, the URL answers *what am I
   * pointing at right now*. Without the second, nobody can send anyone a view —
   * which is the single most useful thing in the competitor link the owner sent.
   *
   * The URL wins on arrival and only on arrival: after that the reader's own
   * changes drive it. Applied once, guarded by a ref, because re-applying on
   * every render would fight every control on the page.
   */
  const viewDefaults: ViewDefaults = useMemo(
    () => ({ mode: 'globe', layer: 'events', region: 'all', windowHours: null }),
    [],
  )
  const currentView: GlobeViewState = useMemo(
    () => ({ mode, layer, region, windowHours, lat: null, lon: null, zoom: null }),
    [mode, layer, region, windowHours],
  )
  const linkApplied = useRef(false)
  useEffect(() => {
    if (linkApplied.current || typeof window === 'undefined') return
    linkApplied.current = true
    if (!hasViewState(window.location.search)) return
    const shared = parseViewState(window.location.search, { mode, layer, region, windowHours })
    update((p) => ({
      ...p,
      globe: {
        ...p.globe,
        view: shared.mode,
        layer: shared.layer,
        region: shared.region,
        windowHours: shared.windowHours,
      },
    }))
    // Deliberately once, on mount. See the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * And the address bar follows the controls.
   *
   * `replaceState`, not `pushState`: changing a layer is not a navigation, and
   * making it one means the back button walks through every chip the reader
   * pressed instead of leaving the page.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !linkApplied.current) return
    const next = window.location.pathname + toSearch(currentView, viewDefaults)
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(window.history.state, '', next)
    }
  }, [currentView, viewDefaults])

  const [copied, setCopied] = useState(false)
  const copyView = useCallback(() => {
    if (typeof window === 'undefined') return
    const url = shareUrl(window.location.origin, window.location.pathname, currentView)
    void navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        /* a refused clipboard is not worth an error dialogue */
      })
  }, [currentView])

  /** The selection is held by id, not by value — see `selected` below. */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** null means pinned to the live edge, which is not the same as "at now". */
  const [cursorMs, setCursorMs] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const height = useSurfaceHeight()

  /**
   * The world picture comes from the shared store, not from a fetch of our own.
   *
   * It used to be ours alone, which was fine while the globe was the only thing
   * drawing it. The moment the columns beside the map were added, two components
   * each polling `/api/world` meant two sweeps of a report thousands of events
   * long — and worse, two sweeps landing at different moments, so the map and
   * the list beside it would be drawn from two different pictures of the world.
   * A dot with no row and a row with no dot, and no way for a reader to tell
   * which was right. See lib/world/report-store.
   */
  const load = useCallback(async (isRefresh: boolean) => {
    await loadWorld(isRefresh)
  }, [])

  // The liquidity layer is only fetched if someone actually asks for it.
  useEffect(() => {
    if (layer !== 'liquidity' || chain) return
    let alive = true
    fetch('/api/chain', { cache: 'no-store' })
      .then((r) => {
        // See lib/http/discard.ts: a body nobody reads holds the connection.
        if (!r.ok) {
          discardBody(r)
          return null
        }
        return r.json()
      })
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
  /**
   * What the ranked list draws from — which is **not** what the map draws from.
   *
   * The map can only plot an event that has a coordinate. The list has no such
   * constraint, and restricting it to placed events was a real defect with a
   * loud symptom: a Security Council resolution, a sanctions package, a central
   * bank decision and a breach disclosure all arrive without coordinates, so
   * every one of them was excluded from "Most significant now" **by
   * construction**. Only hazards have coordinates, so only hazards could rank.
   *
   * That is the larger half of "the news is all weather" — larger than the NWS
   * volume problem, and invisible until the two were separated.
   *
   * Unplaceable events join the list only when no region filter is active: we
   * cannot honestly place them in a region we do not know.
   */
  const listScope = useMemo(() => {
    if (region !== 'all') return inWindow
    const extra = (report?.unplaceable ?? []).filter(
      (e) => !muted.has(e.category) && withinWindow(e, timeWindow),
    )
    return [...inWindow, ...extra]
  }, [inWindow, report, muted, region, timeWindow])

  const ranked = useMemo(
    () => rankEvents(listScope, { now: cursor, fused: fusedIndex }),
    [listScope, cursor, fusedIndex],
  )

  /**
   * The board, capped so no single publisher owns it.
   *
   * Rarity weighting in `rankEvents` lowers a prolific source's score; this is
   * the hard stop behind it. Measured before both existed: **17 of the top 20
   * rows were `nws_alerts`**, because NWS issues county-level warnings all day
   * and each grades to the same severity. A reader opening the world board saw
   * American county weather and concluded the product only carries weather.
   *
   * What is held back is counted and offered, never dropped — hiding real
   * events would be a worse failure than the one being fixed.
   */
  const board = useMemo(
    () =>
      diversify(
        ranked.map((r) => ({
          ...r,
          sourceKey: r.event.sourceKey,
          // The publisher, not just the feed — see Rankable.origin.
          origin: originOf(r.event.sourceKey),
          category: r.event.category as string,
          severity: r.event.severity,
        })),
        20,
      ),
    [ranked],
  )
  const heldBack = useMemo(() => overflowSummary(board.overflow), [board.overflow])

  /**
   * How the board is ordered, and by whom.
   *
   * Significance is the default and the one the engine is built around — but a
   * reader who wants "what came in last" was previously told to scroll and work
   * it out from the age suffixes. An ordering a reader cannot change is a
   * ranking imposed on them; these three are the orderings this data actually
   * supports, and no others are offered because no others would be honest.
   */
  const [sort, setSort] = useState<'significance' | 'newest' | 'oldest'>('significance')

  /**
   * One publisher, or all of them.
   *
   * The board is capped at three rows per publisher, which stops a flood — and
   * on a quiet run leaves a reader looking at ten advisories from one feed with
   * no way to say "show me everything from this one" or "show me anything but".
   */
  const [publisher, setPublisher] = useState<string | null>(null)

  const publishers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of board.taken) {
      counts.set(r.event.sourceKey, (counts.get(r.event.sourceKey) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [board.taken])

  const rows = useMemo(() => {
    const filtered = publisher ? board.taken.filter((r) => r.event.sourceKey === publisher) : board.taken
    if (sort === 'significance') return filtered
    // A row we cannot time cannot be ordered by time, so it goes last rather
    // than being given an invented position at the top.
    const timeOf = (r: (typeof filtered)[number]) => {
      const t = Date.parse(r.event.observedAt ?? r.event.at ?? '')
      return Number.isFinite(t) ? t : null
    }
    return [...filtered].sort((a, b) => {
      const ta = timeOf(a)
      const tb = timeOf(b)
      if (ta === null && tb === null) return 0
      if (ta === null) return 1
      if (tb === null) return -1
      return sort === 'newest' ? tb - ta : ta - tb
    })
  }, [board.taken, publisher, sort])

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

  /**
   * The ranked events the map may actually draw.
   *
   * `ranked` deliberately carries unplaceable events, because the *list* must
   * rank a sanctions package and a central-bank decision alongside a hazard —
   * that is the defect documented above `listScope`. The **map** cannot draw
   * them, and the three point branches below were reading `r.event.lat as
   * number` off records whose `lat` is `null`.
   *
   * A cast is not a conversion. `null as number` is still `null` at runtime,
   * arithmetic coerces it to `0`, and every undated-location event was
   * therefore plotted at **0°N 0°E** — Null Island, in the Gulf of Guinea.
   * Caught by looking at a running board: the badge read `0 of 10 on the map`
   * and the sentence beneath it read "there is nothing to plot", while the
   * canvas drew a cluster mark labelled **10** off the coast of Ghana.
   *
   * This is the exact failure this module's own header swears against — "a real
   * event with no coordinate is listed beside the map rather than silently
   * discarded or, *worse*, plotted at a guessed location". Null Island is the
   * worst available guess, because it looks like a finding.
   *
   * So the filter lives here, once, in front of every branch that plots events,
   * and it is a real coordinate check rather than a cast.
   */
  const plottable = useMemo(
    () =>
      ranked.filter((r) => hasCoordinate(r.event)),
    [ranked],
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
      return plottable.map((r) => {
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
      return plottable.flatMap((r) => {
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
    return plottable.map((r) => ({
      id: r.event.id,
      lat: r.event.lat as number,
      lon: r.event.lon as number,
      label: r.event.title,
      // Severity drives size where it was measured; everything else plots at a
      // uniform, modest size rather than pretending to a magnitude it lacks.
      weight: 1 + r.event.severity * 3,
      color: r.event.color,
      intensity: r.event.severity,
      // What it is, which decides the shape it is drawn as.
      category: r.event.category,
    }))
  }, [layer, chain, plottable, report])

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

  /**
   * Isolate one category, and restore them all — the two gestures a checkbox
   * rail makes tedious.
   *
   * "Show me only earthquakes" is the common operator move, and with per-item
   * toggles alone it costs one click per other category to get there and the
   * same again to come back. `onlyCategory` mutes every category *present in
   * this run* rather than the whole catalogue: muting kinds that reported
   * nothing would leave the rail's hidden count claiming twenty hidden layers
   * when nineteen of them had nothing to hide.
   *
   * Both close the panels of what they hide, for the same reason `toggleCategory`
   * does: a panel open under a category absent from the map is a contradiction
   * the reader has to resolve.
   */
  const onlyCategory = (category: EventCategory) =>
    update((p) => {
      const next = onlyLayer(
        (report?.categories ?? []).map((c) => c.category),
        category,
      )
      return {
        ...p,
        globe: {
          ...p.globe,
          muted: next,
          panels: p.globe.panels.filter((c) => !next.includes(c as EventCategory)),
        },
      }
    })

  const showAllCategories = () => update((p) => ({ ...p, globe: { ...p.globe, muted: allLayers() } }))

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
  const okSources = report?.sourceHealth.filter((s) => s.status === 'ok') ?? []

  /**
   * Density sets the layout; the chevron overrides one section for this visit.
   *
   * ## Two controls, one source of truth
   *
   * A section can now be closed by two things: the density level, which says
   * what a *layout* shows, and the section's own chevron, which says what *this
   * reader* wants right now. That is fine as long as exactly one of them is
   * authoritative at a time, and the first attempt here was not — it kept the
   * persisted collapse set and tried to reconcile the two, which meant a click
   * on a section that density had closed toggled a stored value the reader
   * could not see, and did visibly nothing. One click doing nothing is the kind
   * of fault a reader blames themselves for.
   *
   * So the override is a plain map from section to the reader's own answer, and
   * `collapsedAt` supplies the answer for everything they have not touched.
   *
   * ## Why the override is not persisted, and the density is
   *
   * It replaced a set of five booleans in `localStorage`. Persisting both would
   * be two stored sources of truth for one question, and they would contradict
   * each other the moment a reader changed density on another device — the
   * layout would say Minimal and three sections would be open with no
   * explanation on screen. The **level** is the durable choice and is stored in
   * preferences; the chevron is the momentary one and lasts as long as the
   * visit. Choosing a level clears the overrides, because choosing a layout is
   * a deliberate reset.
   */
  const [override, setOverride] = useState<ReadonlyMap<string, boolean>>(() => new Map())

  const density = prefs.globe.density

  const sectionCollapsed = useCallback(
    (id: string) => override.get(id) ?? collapsedAt(density, id),
    [override, density],
  )

  const toggleSection = useCallback(
    (id: string) =>
      setOverride((prev) => {
        const next = new Map(prev)
        next.set(id, !(prev.get(id) ?? collapsedAt(density, id)))
        return next
      }),
    [density],
  )

  const chooseDensity = useCallback(
    (next: Density) => {
      setOverride(new Map())
      update((p) => ({
        ...p,
        globe: { ...p.globe, density: next, panelSize: PANEL_SIZE_BY_DENSITY[next] },
      }))
    },
    [update],
  )

  /**
   * What is on this page, in the order it appears, with live counts.
   *
   * Built from the same numbers the sections render, so the index can never
   * promise a section something it does not contain. A zero is still listed:
   * knowing a category is silent is a finding, and dropping it would make the
   * page look shorter by making it less honest.
   */
  const sections: SectionState[] = useMemo(() => {
    if (!report) return []
    const list: SectionState[] = []
    if (isEventLayer) {
      list.push({ id: 'sec-significant', title: 'Most significant', count: rows.length })
      list.push({ id: 'sec-unplaceable', title: 'Not placeable', count: report.unplaceable.length })
    }
    if (layer === 'coverage' && report.coverage) {
      list.push({ id: 'sec-coverage', title: 'Blind spots', count: report.coverage.length })
    }
    if (report.fusion) {
      list.push({ id: 'sec-fusion', title: 'Fusion', count: report.fusion.events })
    }
    list.push({ id: 'sec-sources', title: 'Sources', count: okSources.length })
    return list
  }, [report, isEventLayer, layer, rows.length, okSources.length])

  return (
    <div className="space-y-3">
      {/*
        One control band, not four stacked ones.

        The title, the layer chips, the sentence naming the selected layer and
        the refresh button each had a row of their own, separated by 12px. That
        is article rhythm, and this is not an article — measured, the map began:

        | Viewport  | Map starts at | Screen spent before it |
        |-----------|---------------|------------------------|
        | 1920×1080 | 359px         | 33%                    |
        | 1440×900  | 375px         | **42%**                |
        | 390×844   | 414px         | **49%**                |

        Half a phone screen, and nearly half a laptop's, went to chrome before
        the thing the page exists to show. Nothing here is deleted — the title,
        the counts, the layer names and the sentence all remain, and the sentence
        is still on its own line on a phone where the band would otherwise wrap
        into a paragraph. They simply share a line where there is a line to
        share.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Globe2 className="h-5 w-5 shrink-0 text-primary" />
        <h2 className="text-base font-bold lg:text-lg">Live world surface</h2>
        {/*
          It read `0/10` beside a green dot, and nothing else. A reader met two
          numbers with no units, a healthy-looking dot, and an empty map — and
          could only conclude the page was broken. Both numbers are real and
          they mean different things: how many events could be drawn, and how
          many arrived. Said in words, `0 of 10 on the map` is a finding; as
          `0/10` it is a riddle.
        */}
        {report ? (
          <Badge
            variant="outline"
            className="gap-1 text-[10px]"
            title="Events with coordinates, out of every event in this run. The rest are listed under “Not placeable”."
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                report.summary.placed > 0 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="tabular-nums">{report.summary.placed}</span> of{' '}
            <span className="tabular-nums">{report.summary.total}</span> on the map
          </Badge>
        ) : null}

        {/* Layer controls, in the title band rather than a row below it, and
            still above the canvas so they are reachable on a phone without
            scrolling past a full-height globe.

            The labels used to collapse to icons below 640px, on the reasoning
            that the sentence underneath names the layer in full. It names the
            *selected* one — so a phone reader saw five unlabelled glyphs and had
            to tap each to find out what it was. A glyph is not a word, and it is
            less of one for the majority of our readers, who never met this icon
            set. The row scrolls sideways instead: every option stays readable and
            the cost is one gesture. */}
        <span className="scroll-row flex max-w-full items-center rounded-md ring-1 ring-border">
          {(Object.keys(LAYER_META) as Layer[]).map((l) => {
            const Icon = LAYER_META[l].icon
            return (
              <button
                key={l}
                onClick={() => setLayer(l)}
                aria-pressed={layer === l}
                title={LAYER_META[l].label}
                className={`touch-target flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-1.5 text-[11px] transition-colors ${
                  layer === l
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{LAYER_META[l].label}</span>
              </button>
            )
          })}
        </span>

        {isEventLayer && report && report.regions.length > 1 ? (
          <>
            <button
              onClick={() => setRegion('all')}
              aria-pressed={region === 'all'}
              className={`touch-target rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
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
                className={`touch-target rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
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

        {/*
          The sentence naming the selected layer. It keeps its own line on a
          phone — squeezed into a band beside five chips it would wrap to two
          words a line — and joins the band from `lg`, where there is room for
          it and the row below it was pure spacing.
        */}
        <p className="w-full text-[10px] leading-relaxed text-muted-foreground lg:w-auto lg:min-w-0 lg:flex-1 lg:truncate">
          <span className="font-medium text-foreground">{LAYER_META[layer].label}.</span>{' '}
          {LAYER_META[layer].question}
        </p>

        {/*
            Copy this exact view.

            The link carries every field rather than only what differs from the
            defaults: a colleague opening it must land on what the sharer is
            looking at, not on their own settings with a couple of overrides.
        */}
        <button
          onClick={copyView}
          className="touch-target ms-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted"
          title="Copy a link to exactly this view — layer, region, window and mode"
        >
          <LinkIcon className="h-3 w-3" />
          {copied ? 'Copied' : 'Share view'}
        </button>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="touch-target flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          {report ? <TimeStamp iso={report.generatedAt} fallback="Refresh" /> : 'Refresh'}
        </button>
      </div>

      {/*
        Below `xl` the map comes first and its controls follow it.

        Measured on a 390×844 phone once the rail and the strip landed: the
        canvas began **685px down an 844px screen — 81% of it**. Eighty-one per
        cent of a phone spent on instrumentation before the world it instruments.

        The order is the fix, not deletion. The scrubber and the layer rail are
        both *controls over the map*, and where height is the scarce resource a
        control belongs under the thing it controls: the reader sees the world,
        then adjusts it. Nothing is hidden and nothing moves more than one
        screen. The **source order is unchanged** — only `order` moves things —
        so the reading order for a screen reader and the tab order for a
        keyboard both stay as written, which rearranging the JSX would have
        broken silently.

        From `xl`, where the height exists, the arrangement is exactly as before.
        Measured after: 52% phone · 45% laptop · 33% desktop.
      */}
      <div className="flex flex-col gap-3">
        <div className="order-3 space-y-3 xl:order-1">
          {/*
            How much of the analysis to show at once.

            It was in the title band with the layer chips, on the reasoning that
            both change what the page shows rather than what the data is. The
            reasoning is right and the placement was not: measured on a 390px
            phone, four more buttons wrapped that band from 134px to **228px**
            and pushed the map from 438px down to 532px — 63% of the screen,
            past the limit the browser suite holds this page to.

            So it moves in with the scrubber, which is the same kind of control
            and already sits below the canvas under `xl` and above it from
            there. Where height is the scarce resource, a control over the map
            belongs under the map — the rule the scrubber and the layer rail
            already follow.
          */}
          <DensityControl density={density} onChange={chooseDensity} />
        {isEventLayer && report ? (
          <TimeScrubber
            window={timeWindow}
            histogram={histogram}
            playbackStartMs={playbackStartMs}
            playing={playing}
            shown={inWindow.length}
            held={inScope.length}
            unplaceable={report.unplaceable.length}
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

        </div>

        <div className="order-1 xl:order-2">
        {/*
          The headline band.

          Above the map rather than below it, and above the rail rather than
          inside it, because these six figures decide whether anything under them
          can be believed. Every figure is computed in `lib/world/kpis` and tested
          there; four of them are ones a board that wanted to look healthy would
          not volunteer — refused feeds, the age of the newest *observation*, the
          regions nothing covers, and how many kinds are reporting at all.
        */}
        <KpiStrip report={report} />

        </div>

        <div className="order-2 xl:order-3">
        {/*
          Rail beside the map, in one row from `2xl`.

          The category toggles used to live in a card *below* the canvas, so
          changing what the map drew meant scrolling past the map, losing sight of
          the thing being changed, and scrolling back to see the result. Below
          `2xl` the rail keeps its place directly above the canvas and lays its
          rows out sideways — still adjacent, still never behind it.

          The breakpoint is `2xl` and not `xl`, and it was measured rather than
          chosen. This tab already splits into a map pane and a 26rem context rail
          from `xl`, so on a 1440 laptop the map pane is 752px wide — and a 208px
          layer rail beside it left the canvas **530px**, a third of its width
          spent on a third column of chrome. At 1920 the same rail leaves the map
          884px, which it can afford. So the sideways form serves every width
          where the vertical one would come out of the map itself.

          `items-start` so the rail is its own height rather than stretching to
          the canvas: an empty column of card below twelve categories is the kind
          of dead space that made this page eleven thousand pixels tall.
        */}
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start">
          {isEventLayer && report && report.categories.length > 0 ? (
              <div className="order-2 2xl:order-none 2xl:w-56 2xl:shrink-0">
              <LayerRail
                report={report}
                muted={muted}
                onToggle={toggleCategory}
                onOnly={onlyCategory}
                onAll={showAllCategories}
              />
            </div>
          ) : null}

            <Card className="order-1 min-w-0 flex-1 overflow-hidden p-0 2xl:order-none">
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
        </div>
        </div>
      </div>

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
                      className="touch-target flex w-full items-start gap-2 text-left text-[11px] transition-colors hover:bg-muted/40"
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

      {/*
        How to read the marks.

        This card used to carry a second copy of the category toggles, and the
        duplication had already caused a real misclick in a walk-through: a
        reader wanting to *open* Earthquakes clicked the first "Earthquake" they
        saw and *hid* them instead. The toggles now exist once, in the rail
        beside the map, which is also the legend — so what is left here is the
        part the rail cannot say: what the motion and the numbers on a mark mean.
      */}
      {layer === 'events' && report && report.categories.length > 0 ? (
        <Card className="p-3">
          <h4 className="mb-1 text-xs font-semibold">Reading the marks</h4>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            A pulsing point carries a real severity — a magnitude, a burnt area, or an agency&apos;s
            own alert level. Points that were never graded do not pulse; we do not invent urgency a
            source did not report. A numbered mark is several events too close together to draw
            apart at this zoom: tap it to fly in and split it. Each shape is its category&apos;s own,
            drawn in the rail beside the map at the same size the canvas draws it — to hide a
            category use that rail, and to *read* one open it under{' '}
            <span className="font-medium">Category panels</span> below.
          </p>
        </Card>
      ) : null}

      {report && sections.length > 0 ? <SectionIndex sections={sections} /> : null}

      {isEventLayer && report ? (
        <PanelSection
          id="sec-significant"
          title={windowHours === null ? 'Most significant now' : 'Most significant in this window'}
          count={rows.length}
          collapsed={sectionCollapsed('sec-significant')}
          onToggle={toggleSection}
          emptyLabel={
            publisher
              ? `Nothing from ${publisher} in this window.`
              : 'No events ranked in this window.'
          }
          controls={
            <>
              {/* Ordering the reader can change. Three, because these are the
                  three this data honestly supports. */}
              <span className="scroll-row flex items-center rounded-md ring-1 ring-border">
                {(['significance', 'newest', 'oldest'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    aria-pressed={sort === s}
                    className={`touch-target shrink-0 whitespace-nowrap px-2 py-1 text-[10px] capitalize transition-colors ${
                      sort === s
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </span>
              {publishers.length > 1 ? (
                <select
                  value={publisher ?? ''}
                  onChange={(e) => setPublisher(e.target.value || null)}
                  aria-label="Filter by publisher"
                  className="max-w-[9rem] rounded-md border border-border bg-background px-1.5 py-1 text-[10px] text-muted-foreground"
                >
                  <option value="">All publishers ({board.taken.length})</option>
                  {publishers.map(([key, n]) => (
                    <option key={key} value={key}>
                      {key} ({n})
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          }
          hint={
            <>
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Radio className="h-3 w-3 text-primary" />
                How this order is decided
              </span>
              Measured severity, halved every 72 hours of age, lifted where independent origins
              agree, and lowered for a publisher that is sending a great many reports this run — a
              county flood warning is one of forty, a magnitude 7.7 is one of two. No publisher may
              hold more than three rows. Each line says why it sits where it sits.
              {sort !== 'significance' ? (
                <span className="mt-1 block text-amber-600 dark:text-amber-500">
                  Sorted by time — the ranking above is not what you are looking at.
                </span>
              ) : null}
            </>
          }
        >
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.event.id}>
                <button
                  onClick={() => setSelectedId(r.event.id)}
                  className="touch-target flex w-full items-start gap-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: r.event.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">
                      {/*
                        The mark is rare by construction, and that is what makes
                        it worth anything: severe *and* unusual for its
                        publisher, or agreed by independent origins, or measured
                        past the point where grading matters — and never more
                        than twelve hours old. A banner that fires on the county
                        flood warning is a banner nobody reads, which then fails
                        at the one moment it exists for.
                      */}
                      {r.breaking.breaking ? (
                        <span className="mr-1.5 inline-block rounded-sm bg-red-600 px-1 py-px align-[1px] text-[9px] font-bold uppercase tracking-wide text-white">
                          Breaking
                        </span>
                      ) : null}
                      {r.event.title}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {r.event.country ? `${r.event.country} · ` : ''}
                      {r.event.categoryLabel} · {r.reasons.join(' · ')}
                    </span>
                    {/* Never a bare label: the reader is told what made it one,
                        in the same breath, so they can disagree. */}
                    {r.breaking.breaking ? (
                      <span className="block text-[10px] font-medium text-red-600 dark:text-red-400">
                        Breaking because {r.breaking.reasons.join('; ')}
                      </span>
                    ) : null}
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

          {/* Counted and offered, never dropped. Silently hiding real events
              would be a worse failure than the crowding it fixes.

              Suppressed while a publisher filter is on: "4 more from ubuntu_usn
              were held back so one publisher does not fill the board" is a
              confusing thing to read directly underneath a list the reader has
              deliberately narrowed to that one publisher. */}
          {!publisher && (heldBack || board.diversified < board.taken.length) ? (
            <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
              {heldBack}
              {board.diversified < board.taken.length ? (
                <>
                  {' '}
                  The first {board.diversified} rows met the diversity rule on their own; the rest
                  fill the board and are there for completeness.
                </>
              ) : null}
            </p>
          ) : null}
        </PanelSection>
      ) : null}

      {isEventLayer && report ? (
        <PanelSection
          id="sec-unplaceable"
          title="Reported, but not placeable"
          count={report.unplaceable.length}
          collapsed={sectionCollapsed('sec-unplaceable')}
          onToggle={toggleSection}
          emptyLabel="Every event in this run carried a location."
          hint="Real events whose source gave no location — listed here rather than plotted at a guess."
        >
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
          {report.unplaceable.length > 10 ? (
            <p className="text-[10px] text-muted-foreground">
              Showing the 10 most recent of {report.unplaceable.length}.
            </p>
          ) : null}
        </PanelSection>
      ) : null}

      {/*
        The blind-spot panel.

        Shown only on its own layer, because it answers a different question
        from the events layer and mixing the two would let a reader take a
        coverage warning for a hazard.
      */}
      {layer === 'coverage' && report?.coverage ? (
        <PanelSection
          id="sec-coverage"
          title="Where we cannot see"
          count={report.coverage.length}
          collapsed={sectionCollapsed('sec-coverage')}
          onToggle={toggleSection}
          emptyLabel="No region assessment for this run."
          hint={
            <>
              {report.coverageSummary.trustworthyRegions} of {report.coverageSummary.totalRegions}{' '}
              regions we can speak about. A region with no events may be{' '}
              <strong>quiet</strong> — covered, reporting nothing — or <strong>dark</strong>,
              meaning nothing covers it and silence tells you nothing. Every comparable map draws
              those the same way. This one does not.
            </>
          }
        >
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
        </PanelSection>
      ) : null}

      {/*
        Fusion. The number competitors never show.

        "142 reports → 38 events" tells a reader the screen summarises more work
        than it displays — and it is the honest way to present a count that
        would otherwise look like *less* coverage than a rival showing every
        duplicate as a separate line. The contested count is the one that
        matters most: sources disagreeing is a finding, not an error to hide.
      */}
      {report?.fusion ? (
        <PanelSection
          id="sec-fusion"
          title="Event fusion"
          count={report.fusion.events}
          collapsed={sectionCollapsed('sec-fusion')}
          onToggle={toggleSection}
          emptyLabel="No reports arrived to fuse in this window."
          hint={`${report.fusion.signals} reports resolved to ${report.fusion.events} distinct events.`}
        >
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
        </PanelSection>
      ) : null}

      {/*
        Source integrity. A board that quietly loses a feed is a lying board —
        so this cannot be dropped. But it printed all 167 feed keys as one
        undifferentiated wall, and a wall is not a report: the seven that
        *failed* are the finding, and they were indistinguishable from the 159
        that simply had nothing to say.

        Three counts first, then the names on request, worst first.
      */}
      {report ? (
        <PanelSection
          id="sec-sources"
          title="Source integrity"
          count={okSources.length}
          collapsed={sectionCollapsed('sec-sources')}
          onToggle={toggleSection}
          emptyLabel={`No feed contributed to this run — ${failedSources.length} failed and ${emptySources.length} answered with nothing.`}
          hint={`${report.summary.sourcesOk} of ${report.sourceHealth.length} feeds contributed to this picture.`}
        >
          <div className="flex flex-wrap gap-3 text-[11px]">
            <span>
              <span className="font-medium text-emerald-600 dark:text-emerald-500">
                {okSources.length}
              </span>{' '}
              <span className="text-muted-foreground">contributed</span>
            </span>
            <span>
              <span className="font-medium text-amber-600 dark:text-amber-500">
                {emptySources.length}
              </span>{' '}
              <span className="text-muted-foreground">answered, nothing to report</span>
            </span>
            <span>
              <span className="font-medium text-destructive">{failedSources.length}</span>{' '}
              <span className="text-muted-foreground">did not answer</span>
            </span>
          </div>

          {/* Failures first and never folded away: this is the part that makes
              the rest of the page incomplete, and it is short. */}
          {failedSources.length > 0 ? (
            <div className="space-y-1 rounded border border-destructive/30 p-2">
              <p className="text-[11px] font-medium text-destructive">
                {failedSources.length} feed{failedSources.length === 1 ? '' : 's'} could not be
                reached — this picture is incomplete
              </p>
              <ul className="space-y-0.5">
                {failedSources.map((s) => (
                  <li key={s.sourceKey} className="font-mono text-[10px] text-muted-foreground">
                    {s.sourceKey} — {s.error ?? 'no answer'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <NameList
            names={okSources.map((s) => `${s.sourceKey} ${s.count}`)}
            label="feeds contributed events to this run"
          />
          <NameList
            names={emptySources.map((s) => s.sourceKey)}
            label="feeds answered but reported nothing — an absence of reports is not evidence that nothing happened"
            tone="warn"
          />
        </PanelSection>
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

          {/*
            The counts and a pointer, not the names.

            This card used to reprint every failed key *and* all 159 empty ones
            inside a paragraph — the same names the integrity section had just
            listed above it. Roughly 330 monospace identifiers on one page, most
            of them twice. Nobody reads that; they scroll past it, and whatever
            is below is on the far side of the scroll.
          */}
          {failedSources.length > 0 ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-destructive">
                {failedSources.length} feed{failedSources.length === 1 ? '' : 's'} could not be
                reached
              </span>{' '}
              and{' '}
              <span className="font-medium text-foreground">
                {emptySources.length} answered with nothing
              </span>
              . An absence of reports is not evidence that nothing happened — it means these feeds
              are giving us no coverage of this window.{' '}
              <a href="#sec-sources" className="text-primary hover:underline">
                Which ones →
              </a>
            </p>
          ) : emptySources.length > 0 ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">
                All {emptySources.length} feeds answered
              </span>
              , and none reported an event in this window. An absence of reports is not evidence
              that nothing happened.{' '}
              <a href="#sec-sources" className="text-primary hover:underline">
                Which ones →
              </a>
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
        The category feeds and the country picture used to hang off the bottom
        of this component, so the map surface and two unrelated analyses were
        one nine-thousand-pixel column. They are now workspaces of their own —
        see components/globe-workspace.tsx — and this renders only the map and
        what is directly about it.

        They still read the same world picture from the shared store, so
        switching workspace costs nothing and cannot show a different world from
        the globe.
      */}
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
  unplaceable,
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
  /** Events that arrived with no location — they cannot be plotted at all. */
  unplaceable: number
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
            className={`touch-target rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
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
        {/*
          `0 of 0 shown` was printed directly above ten events listed further
          down the page, and a reader is right to call that an error. It was not
          wrong so much as unqualified: both numbers count *plottable* events,
          and on a run where every report arrived without coordinates there are
          genuinely none. The sentence has to say which population it is
          counting, or it reads as a claim that nothing happened.
        */}
        <span className="text-foreground">
          {shown} of {held} shown on the map.
        </span>{' '}
        {held === 0 && unplaceable > 0 ? (
          <>
            Every report in this run arrived without a location, so there is nothing to plot —{' '}
            {unplaceable} {unplaceable === 1 ? 'is' : 'are'} listed under &ldquo;Not
            placeable&rdquo;.{' '}
          </>
        ) : null}
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

      {/* The same verdict as the board row, from the same computation, so the
          two can never disagree about what is breaking. */}
      {ranked.breaking.breaking ? (
        <p className="mt-1.5 rounded border border-red-600/30 bg-red-600/10 px-2 py-1 text-[10px] leading-relaxed text-red-700 dark:text-red-400">
          <span className="font-bold uppercase tracking-wide">Breaking</span> — {' '}
          {ranked.breaking.reasons.join('; ')}. Nothing here is a forecast: this says the report is
          unusual, corroborated or extreme right now, not what happens next.
        </p>
      ) : null}

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
