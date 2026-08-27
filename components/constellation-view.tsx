'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw, RotateCcw, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react'
import { TimeStamp } from '@/components/time-stamp'
import type { ConstellationNode, ConstellationReport } from '@/lib/modules/constellation'

/**
 * The correlation constellation, drawn.
 *
 * ## What is on screen and what it is made of
 *
 * Every dot is an asset. Every line is an edge of the minimum spanning tree
 * over Mantegna distance — meaning it survived the question "of all the ways to
 * connect this market, which n−1 links are the strongest?". Nothing here is
 * chosen for looks:
 *
 * | What you see        | What it is                                        |
 * |---------------------|---------------------------------------------------|
 * | Distance between two dots | their correlation distance, √(2(1−r))       |
 * | Dot size            | cube root of market capitalisation                |
 * | Dot colour          | its cluster, from average-linkage merging          |
 * | Line brightness     | \|r\| of that pair                                 |
 * | Line colour         | amber when r is negative — assets that move apart  |
 * | Ring around a dot   | its degree in the tree: a hub, drawn as a hub      |
 *
 * The layout is computed on the server and is deterministic, so this component
 * never runs a simulation. It rotates a fixed set of coordinates, which is why
 * the same market always looks the same and why a phone can draw it at sixty
 * frames without a physics loop.
 *
 * ## The one thing on screen that is not a measurement
 *
 * The travelling highlight along the strongest edges. It carries no data — it
 * is a phase over time — and it is here because a static graph of a *live*
 * market reads as a screenshot. Its speed is `|r|`, so a brighter, faster
 * filament is a tighter pair, and it only runs on the edges above the median.
 * That is decoration derived from a real value, and it is written down here
 * rather than left for someone to mistake for a signal. Turning it off changes
 * no reading on the page, which is the test of whether decoration is honest.
 */

/**
 * Cluster colours, in the order clusters are numbered.
 *
 * Ten hues, ordered so adjacent cluster numbers are not adjacent hues — cluster
 * 0 and cluster 1 are frequently drawn touching, and two neighbouring blues
 * would read as one group. Chosen for a dark ground and checked to stay
 * distinguishable at the 3px a distant node is drawn at.
 */
const CLUSTER_COLORS = [
  '#38bdf8', // sky
  '#f472b6', // pink
  '#4ade80', // green
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#fb7185', // rose
  '#2dd4bf', // teal
  '#f59e0b', // orange
  '#c084fc', // purple
  '#94a3b8', // slate — the "everything else" tail
]

/** Ground colour, matching the world surface so the two displays are one product. */
const SPACE = '#04090f'
const HUD_LINE = 'rgba(147, 220, 255, 0.85)'
const HUD_DIM = 'rgba(147, 220, 255, 0.35)'

const colorOf = (cluster: number) => CLUSTER_COLORS[cluster % CLUSTER_COLORS.length]

interface Camera {
  yaw: number
  pitch: number
  zoom: number
}

const START_CAMERA: Camera = { yaw: 0.6, pitch: -0.35, zoom: 1 }

interface Projected {
  node: ConstellationNode
  sx: number
  sy: number
  /** Camera-space depth, for painter's-order sorting and for fogging. */
  depth: number
  radius: number
}

/**
 * The canvas height.
 *
 * Not the globe's rule, and the difference is the point: the globe *is* its
 * page and takes the viewport, while this sits inside a scrolling board with a
 * header card above it. Measured at 1920×1080 with the globe's rule, the canvas
 * ran to 1252px on a 1080px screen — a hundred and seventy pixels of the
 * network hanging permanently below the fold, which is worse than a smaller
 * drawing because a reader cannot tell there is more.
 *
 * Capped at 660 so the card ends at the fold on a laptop and the board below it
 * is discoverable by scrolling rather than by luck.
 */
function useSurfaceHeight(): number {
  const [height, setHeight] = useState(420)
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (w >= 1280) return setHeight(Math.round(Math.max(440, Math.min(h * 0.62, 660))))
      setHeight(Math.round(Math.max(280, Math.min(w * 0.95, h * 0.55, 520))))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  return height
}

export function ConstellationView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const height = useSurfaceHeight()

  const [report, setReport] = useState<ConstellationReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [camera, setCamera] = useState<Camera>(START_CAMERA)
  const [spin, setSpin] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  /**
   * The projection is written into a ref on every frame so the pointer handlers
   * can hit-test against exactly what was drawn. Recomputing the projection in
   * the handler would test against a slightly different frame at any rotation
   * speed, and the dot under the cursor would not be the dot that gets selected.
   */
  const projectedRef = useRef<Projected[]>([])
  const cameraRef = useRef<Camera>(START_CAMERA)
  cameraRef.current = camera

  const load = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const res = await fetch('/api/markets/constellation', {
        cache: force ? 'no-store' : 'default',
      })
      const body = (await res.json()) as ConstellationReport & { error?: string }
      if (!res.ok || body.error) throw new Error(body.error ?? `Request failed (${res.status})`)
      setReport(body)
      setError(null)
    } catch (err) {
      // The last good picture stays on screen and stays labelled. Blanking a
      // substantially true drawing over one failed poll throws away more than
      // it protects.
      setError(err instanceof Error ? err.message : 'Could not read the market')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const nodesByKey = useMemo(
    () => new Map((report?.nodes ?? []).map((n) => [n.key, n])),
    [report],
  )

  /**
   * The median |r| across the tree, which decides which filaments carry the
   * travelling highlight. Computed once per report rather than per frame.
   */
  const pulseFloor = useMemo(() => {
    const edges = report?.edges ?? []
    if (edges.length === 0) return 1
    const sorted = edges.map((e) => Math.abs(e.r)).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }, [report])

  const maxCap = useMemo(
    () => (report?.nodes ?? []).reduce((m, n) => Math.max(m, n.marketCap ?? 0), 0),
    [report],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let stop = false

    const draw = (nowMs: number) => {
      if (stop) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const width = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, h)
      ctx.fillStyle = SPACE
      ctx.fillRect(0, 0, width, h)

      const nodes = report?.nodes ?? []
      const edges = report?.edges ?? []
      const cx = width / 2
      const cy = h / 2

      if (nodes.length > 0) {
        const cam = cameraRef.current
        const yaw = cam.yaw + (spin ? nowMs / 24000 : 0)
        const cosY = Math.cos(yaw)
        const sinY = Math.sin(yaw)
        const cosP = Math.cos(cam.pitch)
        const sinP = Math.sin(cam.pitch)

        /**
         * Fit the drawing to the frame from the report's own radius, so a
         * market that spreads out zooms out rather than falling off the edges.
         * The 0.42 leaves room for the labels that hang off the outermost dots.
         */
        const span = Math.max(1, report?.frameRadius || report?.radius || 1)
        const scale = ((Math.min(width, h) * 0.42) / span) * cam.zoom
        /** Camera distance in the same units, for the perspective divide. */
        const eye = span * 3.2

        const projected: Projected[] = []
        for (const n of nodes) {
          const x1 = n.x * cosY - n.z * sinY
          const z1 = n.x * sinY + n.z * cosY
          const y2 = n.y * cosP - z1 * sinP
          const z2 = n.y * sinP + z1 * cosP
          const perspective = eye / Math.max(0.2, eye + z2)
          const cap = n.marketCap ?? 0
          const size = maxCap > 0 && cap > 0 ? Math.cbrt(cap / maxCap) : 0.25
          projected.push({
            node: n,
            sx: cx + x1 * scale * perspective,
            sy: cy + y2 * scale * perspective,
            depth: z2,
            radius: Math.max(2, (2.2 + size * 7) * perspective),
          })
        }
        projectedRef.current = projected
        const at = new Map(projected.map((p) => [p.node.key, p]))

        /**
         * Painter's algorithm: far first. Without it a near node is drawn under
         * a far one and the sense of depth inverts at every rotation.
         */
        projected.sort((a, b) => b.depth - a.depth)

        // ── Edges ────────────────────────────────────────────────────────────
        const focus = selected ?? hovered
        const focusEdges = new Set<string>()
        if (focus) {
          for (const e of edges) if (e.a === focus || e.b === focus) focusEdges.add(`${e.a}|${e.b}`)
        }

        ctx.lineCap = 'round'
        for (const e of edges) {
          const pa = at.get(e.a)
          const pb = at.get(e.b)
          if (!pa || !pb) continue
          const strength = Math.abs(e.r)
          const isFocus = focusEdges.has(`${e.a}|${e.b}`)
          const dim = focus && !isFocus ? 0.18 : 1

          // Amber for a negative correlation: two assets that move apart are a
          // different fact from two that move together, and one colour for both
          // would hide the more interesting one.
          const positive = e.r >= 0
          const base = positive ? colorOf(nodesByKey.get(e.a)?.cluster ?? 0) : '#f59e0b'
          ctx.strokeStyle = withAlpha(base, (0.12 + strength * 0.5) * dim)
          ctx.lineWidth = (isFocus ? 1.8 : 0.6 + strength * 1.1) * (positive ? 1 : 1.4)
          ctx.beginPath()
          ctx.moveTo(pa.sx, pa.sy)
          ctx.lineTo(pb.sx, pb.sy)
          ctx.stroke()

          /**
           * The travelling highlight — the one non-measurement on screen, see
           * the note at the top of this file. Only above the median |r|, phase
           * offset by the pair's own correlation so filaments do not march in
           * lockstep, and speed proportional to |r|.
           */
          if (strength >= pulseFloor && dim === 1) {
            const t = ((nowMs / 1000) * (0.25 + strength * 0.35) + strength * 7.3) % 1
            const hx = pa.sx + (pb.sx - pa.sx) * t
            const hy = pa.sy + (pb.sy - pa.sy) * t
            ctx.fillStyle = withAlpha(base, 0.55)
            ctx.beginPath()
            ctx.arc(hx, hy, 1.4, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        // ── Nodes ────────────────────────────────────────────────────────────
        for (const p of projected) {
          const n = p.node
          const isFocus = focus === n.key
          const dim = focus && !isFocus ? 0.25 : 1
          // Depth fog: a node behind the centre is further away and reads as it.
          const fog = 0.45 + 0.55 * (1 - Math.min(1, Math.max(0, (p.depth + span) / (span * 2))))
          const color = colorOf(n.cluster)

          const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, p.radius * 3.5)
          glow.addColorStop(0, withAlpha(color, 0.35 * fog * dim))
          glow.addColorStop(1, withAlpha(color, 0))
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, p.radius * 3.5, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = withAlpha(color, (0.55 + 0.45 * fog) * dim)
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, p.radius, 0, Math.PI * 2)
          ctx.fill()

          // A hub in the asset tree gets a ring, because "everything connects
          // through this one" is the single most useful thing this picture says.
          if (n.degree >= 4) {
            ctx.strokeStyle = withAlpha(color, 0.75 * dim)
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(p.sx, p.sy, p.radius + 3.5, 0, Math.PI * 2)
            ctx.stroke()
          }

          if (isFocus) {
            ctx.strokeStyle = '#e2e8f0'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(p.sx, p.sy, p.radius + 6, 0, Math.PI * 2)
            ctx.stroke()
          }
        }

        // ── Labels ───────────────────────────────────────────────────────────
        /**
         * Only what can be read: the focused node, and the largest asset in each
         * cluster. A hundred labels on a hundred dots is a hundred labels
         * nobody reads, and the ones that matter are lost in it.
         */
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
        ctx.textBaseline = 'middle'
        const labelled = new Set<string>()
        const leaders = new Map<number, ConstellationNode>()
        for (const n of nodes) {
          const held = leaders.get(n.cluster)
          if (!held || (n.marketCap ?? 0) > (held.marketCap ?? 0)) leaders.set(n.cluster, n)
        }
        for (const n of leaders.values()) labelled.add(n.key)
        if (focus) labelled.add(focus)

        for (const p of projected) {
          if (!labelled.has(p.node.key)) continue
          const isFocus = focus === p.node.key
          const text = p.node.symbol
          const tx = p.sx + p.radius + 5
          const ty = p.sy
          const w = ctx.measureText(text).width
          ctx.fillStyle = 'rgba(3, 10, 18, 0.72)'
          ctx.fillRect(tx - 2, ty - 7, w + 4, 14)
          ctx.fillStyle = isFocus ? '#e2e8f0' : withAlpha(colorOf(p.node.cluster), 0.95)
          ctx.fillText(text, tx, ty)
        }
      }

      drawHud(ctx, width, h, report, loading)
      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => {
      stop = true
      cancelAnimationFrame(frame)
    }
  }, [report, spin, selected, hovered, maxCap, pulseFloor, nodesByKey, loading])

  // ── Pointer ────────────────────────────────────────────────────────────────
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const hitTest = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    let best: { key: string; d: number } | null = null
    for (const p of projectedRef.current) {
      const d = Math.hypot(p.sx - x, p.sy - y)
      // A generous radius: the dots are small and a finger is not.
      if (d <= Math.max(10, p.radius + 6) && (!best || d < best.d)) best = { key: p.node.key, d }
    }
    return best?.key ?? null
  }

  const focusNode = selected ? nodesByKey.get(selected) : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-base font-bold lg:text-lg">Correlation constellation</h3>
        {report ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {report.summary.assetsUsed} of {report.summary.assetsRead} assets ·{' '}
            {report.method.observations} hourly observations
          </span>
        ) : null}
        <p className="w-full text-[10px] leading-relaxed text-muted-foreground lg:w-auto lg:min-w-0 lg:flex-1 lg:truncate">
          <span className="font-medium text-foreground">What moves with what.</span> Every line is
          an edge of the minimum spanning tree over Mantegna distance — the strongest links that
          still connect the whole market.
        </p>
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <button
            onClick={() => setSpin((v) => !v)}
            aria-pressed={spin}
            className={`touch-target rounded-md px-2 py-1 text-[11px] ring-1 transition-colors ${
              spin
                ? 'bg-primary/10 text-primary ring-primary/30'
                : 'text-muted-foreground ring-border hover:bg-muted'
            }`}
          >
            Rotate
          </button>
          <button
            onClick={() => void load(true)}
            disabled={loading}
            className="touch-target flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            {report ? <TimeStamp iso={report.generatedAt} fallback="Refresh" /> : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-500">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" />
          <span>
            {report ? 'Showing the last good picture — refresh failed: ' : ''}
            {error}
          </span>
        </p>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div
          className="relative overflow-hidden rounded-lg border border-border"
          style={{ height, background: SPACE }}
        >
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-grab [touch-action:pan-y] active:cursor-grabbing"
            onPointerDown={(e) => {
              dragRef.current = { x: e.clientX, y: e.clientY, moved: false }
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              const drag = dragRef.current
              if (!drag) {
                setHovered(hitTest(e.clientX, e.clientY))
                return
              }
              const dx = e.clientX - drag.x
              const dy = e.clientY - drag.y
              if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
              drag.x = e.clientX
              drag.y = e.clientY
              setCamera((c) => ({
                ...c,
                yaw: c.yaw + dx * 0.006,
                // Clamped short of the poles, where the projection degenerates
                // and the whole graph collapses into a line.
                pitch: Math.max(-1.3, Math.min(1.3, c.pitch + dy * 0.006)),
              }))
            }}
            onPointerUp={(e) => {
              const drag = dragRef.current
              dragRef.current = null
              e.currentTarget.releasePointerCapture(e.pointerId)
              // A drag is not a click. Without this, every rotation ended by
              // selecting whatever happened to be under the finger.
              if (drag && !drag.moved) {
                const hit = hitTest(e.clientX, e.clientY)
                setSelected((cur) => (hit && cur === hit ? null : hit))
              }
            }}
            onPointerCancel={() => {
              dragRef.current = null
            }}
            onPointerLeave={() => {
              dragRef.current = null
              setHovered(null)
            }}
          />

          <div className="absolute bottom-3 end-3 flex flex-col gap-1">
            <button
              onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(4, c.zoom * 1.3) }))}
              aria-label="Zoom in"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-foreground ring-1 ring-border backdrop-blur hover:bg-background"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(0.4, c.zoom / 1.3) }))}
              aria-label="Zoom out"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-foreground ring-1 ring-border backdrop-blur hover:bg-background"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setCamera(START_CAMERA)
                setSelected(null)
              }}
              aria-label="Reset the view"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground ring-1 ring-border backdrop-blur hover:bg-background"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading && !report ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-sky-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading a hundred price histories…
            </div>
          ) : null}
        </div>

        <ConstellationRail report={report} selected={focusNode ?? null} onSelect={setSelected} />
      </div>
    </div>
  )
}

/**
 * The status rail — clusters, the selected asset, and every exclusion.
 *
 * The exclusions are in the rail rather than behind a disclosure because they
 * are the part a reader would otherwise never think to ask for. "Ninety-nine of
 * a hundred assets, and here is the one that left and why" is a sentence this
 * surface can say and almost no comparable product does.
 */
function ConstellationRail({
  report,
  selected,
  onSelect,
}: {
  report: ConstellationReport | null
  selected: ConstellationNode | null
  onSelect: (key: string | null) => void
}) {
  if (!report) {
    return (
      <aside className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
        Nothing read yet.
      </aside>
    )
  }

  if (report.nodes.length === 0) {
    return (
      <aside className="space-y-2 rounded-lg border border-border p-3 text-xs">
        <p className="font-medium">No correlation to draw.</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {report.summary.assetsRead} price histories were read and{' '}
          {report.summary.assetsUsed} survived the checks. A network needs at least two series
          that move and cover the same hours.
        </p>
        {/*
          Why, in the provider's own words.
          The deployed site returned "1 source failed" and nothing else — an
          empty picture with no reason, which reads exactly like a market with
          no structure in it. A count without its cause is the silence this
          project exists to remove.
        */}
        {report.failures.length > 0 ? (
          <section className="space-y-1">
            <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Sources that did not answer
            </h4>
            <ul className="space-y-0.5 text-[10px] leading-relaxed text-muted-foreground">
              {report.failures.map((f) => (
                <li key={f.source}>
                  <span className="text-foreground">{f.source}</span> — {f.error}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {report.dropped.length > 0 ? <DroppedList dropped={report.dropped} /> : null}
      </aside>
    )
  }

  const neighbours = selected
    ? report.edges
        .filter((e) => e.a === selected.key || e.b === selected.key)
        .map((e) => ({ key: e.a === selected.key ? e.b : e.a, r: e.r }))
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    : []
  const byKey = new Map(report.nodes.map((n) => [n.key, n]))

  return (
    <aside className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-lg border border-border p-3 text-xs xl:max-h-none">
      {selected ? (
        <section className="space-y-1.5">
          <header className="flex items-baseline justify-between gap-2">
            <h4 className="flex items-center gap-1.5 font-semibold">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: colorOf(selected.cluster) }}
                aria-hidden
              />
              {selected.symbol}
            </h4>
            <button
              onClick={() => onSelect(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              clear
            </button>
          </header>
          <p className="text-[11px] text-muted-foreground">{selected.name}</p>
          <dl className="grid grid-cols-2 gap-1.5">
            <Stat label="mean r" value={selected.meanCorrelation.toFixed(2)} />
            <Stat label="tree links" value={String(selected.degree)} />
            <Stat
              label="24h"
              value={selected.change24h === null ? '—' : `${selected.change24h.toFixed(1)}%`}
            />
            <Stat label="rank" value={selected.rank === null ? '—' : `#${selected.rank}`} />
          </dl>
          {neighbours.length > 0 ? (
            <>
              <p className="pt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Nearest in the tree
              </p>
              <ul className="space-y-0.5">
                {neighbours.map((n) => (
                  <li key={n.key}>
                    <button
                      onClick={() => onSelect(n.key)}
                      className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-[11px] hover:bg-muted"
                    >
                      <span className="truncate">{byKey.get(n.key)?.symbol ?? n.key}</span>
                      <span className="tabular-nums text-muted-foreground">{n.r.toFixed(2)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-1.5">
        <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Groups · {report.clusters.length}
        </h4>
        <ul className="space-y-1">
          {[...report.clusters]
            .sort((a, b) => b.members - a.members)
            .map((c) => (
              <li
                key={c.index}
                className="flex items-center gap-2 rounded border border-border/60 px-1.5 py-1"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: colorOf(c.index) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{c.label}</span>
                <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                  {c.members}
                </span>
                {/* Cohesion as a bar, because "how tight is this group" is a
                    magnitude and a number in a list of numbers is not read. */}
                <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.round(Math.max(0, c.cohesion) * 100)}%`,
                      background: colorOf(c.index),
                    }}
                  />
                </span>
              </li>
            ))}
        </ul>
        {/* The concentration finding. A picture with one huge group in it is
            what this market *is*, and saying so is the difference between a
            reader trusting the clustering and doubting it. */}
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          The largest group holds{' '}
          <span className="font-medium tabular-nums text-foreground">
            {report.concentration.largestCluster}
          </span>{' '}
          of {report.summary.assetsUsed} assets (
          {Math.round(report.concentration.share * 100)}%). One dominant factor is a property of
          this market, not of the method.
        </p>
      </section>

      <section className="space-y-1">
        <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground">Method</h4>
        <ul className="space-y-0.5 text-[10px] leading-relaxed text-muted-foreground">
          <li>
            Log returns over{' '}
            <span className="tabular-nums text-foreground">{report.method.observations}</span>{' '}
            observations, {report.method.intervalHours}h apart —{' '}
            <span className="tabular-nums text-foreground">{report.method.windowHours}</span> hours
            in all.
          </li>
          <li>Distance √(2(1−r)) — Mantegna, 1999.</li>
          <li>Structure: minimum spanning tree. Groups: average linkage.</li>
          <li>
            Sources: {report.summary.sourcesOk} answered, {report.summary.sourcesFailed} failed.
          </li>
        </ul>
      </section>

      {report.dropped.length > 0 ? <DroppedList dropped={report.dropped} /> : null}
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 px-1.5 py-1">
      <dd className="text-[11px] font-semibold tabular-nums">{value}</dd>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
    </div>
  )
}

const DROP_REASON: Record<string, string> = {
  flat: 'does not move — a correlation would be noise divided by nothing',
  'too-short': 'too few observations to correlate',
  'short-window': 'does not reach back as far as the rest',
  'non-finite': 'a price the logarithm cannot take',
}

function DroppedList({ dropped }: { dropped: ConstellationReport['dropped'] }) {
  return (
    <section className="space-y-1">
      <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Excluded · {dropped.length}
      </h4>
      <ul className="space-y-0.5 text-[10px] leading-relaxed text-muted-foreground">
        {dropped.map((d) => (
          <li key={d.key}>
            <span className="text-foreground">{d.label}</span> — {DROP_REASON[d.reason] ?? d.reason}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The frame: corner brackets, a title block, a clock, and the method on the
 * bottom edge.
 *
 * Drawn on the canvas rather than in the DOM so it stays welded to the display
 * — an overlay in HTML drifts by a pixel at some zoom levels and the brackets
 * stop meeting the corner, which is the one thing a bracket must do.
 */
function drawHud(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  report: ConstellationReport | null,
  loading: boolean,
) {
  const pad = 10
  const arm = 14
  ctx.save()
  ctx.strokeStyle = HUD_DIM
  ctx.lineWidth = 1
  for (const [x, y, dx, dy] of [
    [pad, pad, 1, 1],
    [width - pad, pad, -1, 1],
    [pad, height - pad, 1, -1],
    [width - pad, height - pad, -1, -1],
  ] as Array<[number, number, number, number]>) {
    ctx.beginPath()
    ctx.moveTo(x + dx * arm, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + dy * arm)
    ctx.stroke()
  }

  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.textBaseline = 'top'
  ctx.fillStyle = HUD_LINE
  ctx.fillText('ASSET TREE · MST / MANTEGNA', pad + 8, pad + 6)

  if (report) {
    ctx.fillStyle = HUD_DIM
    ctx.fillText(
      `${report.summary.assetsUsed} NODES · ${report.edges.length} LINKS · ${report.method.windowHours}H`,
      pad + 8,
      pad + 20,
    )

    const right = `${report.method.observations} OBS`
    ctx.textAlign = 'right'
    ctx.fillStyle = HUD_LINE
    ctx.fillText(right, width - pad - 8, pad + 6)
    ctx.textAlign = 'left'
  }

  ctx.textBaseline = 'bottom'
  ctx.fillStyle = HUD_DIM
  ctx.fillText(
    loading ? 'READING…' : 'DRAG TO ROTATE · TAP A NODE',
    pad + 8,
    height - pad - 6,
  )
  ctx.restore()
}

/** `#rrggbb` plus an alpha, without pulling in a colour library for one job. */
function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}
