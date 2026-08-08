'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Minus, RotateCcw, Globe2, Map as MapIcon } from 'lucide-react'
import { ATLAS } from '@/lib/geo/atlas'
import {
  greatCircle,
  globeRadius,
  mapFrame,
  projectGlobe,
  projectMap,
  unprojectGlobe,
  unprojectMap,
  type GlobeCamera,
  type MapCamera,
  type ScreenPoint,
  type ViewMode,
  type Viewport,
} from '@/lib/geo/projection'

/**
 * WorldSurface — our own world renderer. One canvas, real country outlines, two
 * projections, no map SDK and no tile server: nothing here calls out to a third
 * party at runtime, so the map works offline, cannot leak what a user is looking
 * at, and stays swappable per the project's no-lock-in rule.
 *
 * The 3D globe and the flat map are the *same* drawing code differing only in
 * the projection function, which is why a signal lands on the identical country
 * in both and the toggle between them costs one click and no reload.
 */

export interface SurfacePoint {
  lat: number
  lon: number
  label: string
  weight: number
  id?: string
  /** Category tint; falls back to the default signal green. */
  color?: string
  /** 0–1. Drives the pulse — a real severity, never decoration. */
  intensity?: number
}

export interface SurfaceArc {
  from: { lat: number; lon: number }
  to: { lat: number; lon: number }
}

const MIN_ZOOM = 0.6
const MAX_ZOOM = 8
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
const clampTilt = (t: number) => Math.max(-1.2, Math.min(1.2, t))

/**
 * One palette for both projections — the flat map is the globe's colour scheme
 * on a different transform, not a second look. Deep navy ocean, land raised out
 * of it, and coastlines lit in cyan: the point is that an operator can read
 * shape and edge instantly at a glance, in a room that is usually dark.
 */
const OCEAN_INNER = '#0b1f33'
const OCEAN_OUTER = '#04090f'
const LAND_TOP = '#2a608a'
const LAND_BOTTOM = '#1a3d5c'
/** Coastlines are drawn twice: a wide faint bloom, then a fine bright edge. */
const COAST_GLOW = 'rgba(56, 189, 248, 0.20)'
const COAST_EDGE = 'rgba(147, 220, 255, 0.75)'
const GRATICULE = 'rgba(56, 189, 248, 0.10)'
/** The equator and prime meridian carry the map's frame of reference. */
const GRATICULE_AXIS = 'rgba(56, 189, 248, 0.30)'
const POINT_DEFAULT = '#22c55e'
/** HUD readouts: the same cyan as the coastlines, so the instrument reads as one. */
const HUD_TEXT = 'rgba(147, 220, 255, 0.9)'

interface Camera {
  globe: GlobeCamera
  map: MapCamera
}

export function WorldSurface({
  points,
  arcs = [],
  height = 400,
  focus,
  mode: modeProp,
  onModeChange,
  showToggle = true,
  onSelect,
}: {
  points: SurfacePoint[]
  arcs?: SurfaceArc[]
  height?: number
  focus?: { lat: number; lon: number }
  mode?: ViewMode
  onModeChange?: (mode: ViewMode) => void
  showToggle?: boolean
  onSelect?: (point: SurfacePoint) => void
}) {
  const [internalMode, setInternalMode] = useState<ViewMode>(modeProp ?? 'globe')
  const mode = modeProp ?? internalMode
  const setMode = useCallback(
    (next: ViewMode) => {
      setInternalMode(next)
      onModeChange?.(next)
    },
    [onModeChange],
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cameraRef = useRef<Camera>({
    globe: {
      rotation: focus ? -(focus.lon * Math.PI) / 180 : 0,
      tilt: focus ? clampTilt((focus.lat * Math.PI) / 180) : 0.35,
      zoom: focus ? 1.8 : 1,
    },
    map: { zoom: 1, offsetX: 0, offsetY: 0 },
  })
  const modeRef = useRef(mode)
  modeRef.current = mode

  const dragRef = useRef({ active: false, lastX: 0, lastY: 0, moved: 0 })
  const autospinRef = useRef(true)
  const autospinTimerRef = useRef<number | null>(null)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchRef = useRef<number | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  /** Screen positions of the last frame's points — click uses these, so hit
   *  testing always matches exactly what the user can see. */
  const plottedRef = useRef<Array<{ x: number; y: number; point: SurfacePoint }>>([])
  const pointsRef = useRef(points)
  pointsRef.current = points

  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null)
  const hoverRef = useRef(hover)
  hoverRef.current = hover

  /** Callers almost always pass an inline array; keying on the geometry stops the
   *  render loop from being torn down and rebuilt on every parent render. */
  const arcsKey = JSON.stringify(arcs)
  const arcsRef = useRef(arcs)
  arcsRef.current = arcs

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    const arcSamples = arcsRef.current.map((a) => greatCircle(a.from, a.to))

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const cam = cameraRef.current
      const factor = 1 - e.deltaY * 0.0012
      if (modeRef.current === 'globe') cam.globe.zoom = clampZoom(cam.globe.zoom * factor)
      else cam.map.zoom = clampZoom(cam.map.zoom * factor)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })

    const draw = () => {
      const width = canvas.clientWidth
      const viewport: Viewport = { width, height }
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const cam = cameraRef.current
      const isGlobe = modeRef.current === 'globe'
      const project = (lat: number, lon: number): ScreenPoint =>
        isGlobe
          ? projectGlobe(lat, lon, cam.globe, viewport)
          : projectMap(lat, lon, cam.map, viewport)

      const cx = width / 2
      const cy = height / 2
      const R = globeRadius(cam.globe, viewport)

      // ---- Ocean / backdrop -------------------------------------------------
      if (isGlobe) {
        const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.18)
        glow.addColorStop(0, 'rgba(56,189,248,0.16)')
        glow.addColorStop(1, 'rgba(56,189,248,0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(cx, cy, R * 1.18, 0, Math.PI * 2)
        ctx.fill()

        const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R)
        body.addColorStop(0, OCEAN_INNER)
        body.addColorStop(1, OCEAN_OUTER)
        ctx.fillStyle = body
        ctx.beginPath()
        ctx.arc(cx, cy, R, 0, Math.PI * 2)
        ctx.fill()
        // Everything else stays on the sphere.
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, R, 0, Math.PI * 2)
        ctx.clip()
      } else {
        const frame = mapFrame(cam.map, viewport)
        // The map keeps a true 2:1 aspect, so a taller container leaves bands
        // above and below. Paint the whole canvas first: the bands then read as
        // the surround of a viewport rather than as a rendering failure.
        ctx.fillStyle = OCEAN_OUTER
        ctx.fillRect(0, 0, width, height)
        const body = ctx.createLinearGradient(0, frame.top, 0, frame.top + frame.h)
        body.addColorStop(0, OCEAN_OUTER)
        body.addColorStop(0.5, OCEAN_INNER)
        body.addColorStop(1, OCEAN_OUTER)
        ctx.fillStyle = body
        ctx.fillRect(frame.left, frame.top, frame.w, frame.h)
        ctx.save()
        ctx.beginPath()
        ctx.rect(frame.left, frame.top, frame.w, frame.h)
        ctx.clip()
      }

      // ---- Graticule --------------------------------------------------------
      const traceLine = (samples: Array<[number, number]>) => {
        let started = false
        ctx.beginPath()
        for (const [lat, lon] of samples) {
          const p = project(lat, lon)
          if (!p.visible) {
            started = false
            continue
          }
          if (started) ctx.lineTo(p.x, p.y)
          else {
            ctx.moveTo(p.x, p.y)
            started = true
          }
        }
        ctx.stroke()
      }
      const zoom = isGlobe ? cam.globe.zoom : cam.map.zoom
      const step = zoom > 2.5 ? 15 : 30
      ctx.lineWidth = 1
      for (let lon = -180; lon <= 180; lon += step) {
        if (lon === 0) continue
        const s: Array<[number, number]> = []
        for (let lat = -90; lat <= 90; lat += 3) s.push([lat, lon])
        ctx.strokeStyle = GRATICULE
        traceLine(s)
      }
      for (let lat = -60; lat <= 60; lat += step) {
        if (lat === 0) continue
        const s: Array<[number, number]> = []
        for (let lon = -180; lon <= 180; lon += 3) s.push([lat, lon])
        ctx.strokeStyle = GRATICULE
        traceLine(s)
      }
      // The equator and the prime meridian are the frame everything else is read
      // against, so they are drawn brighter than the rest of the grid.
      ctx.strokeStyle = GRATICULE_AXIS
      const equator: Array<[number, number]> = []
      for (let lon = -180; lon <= 180; lon += 3) equator.push([0, lon])
      traceLine(equator)
      const meridian: Array<[number, number]> = []
      for (let lat = -90; lat <= 90; lat += 3) meridian.push([lat, 0])
      traceLine(meridian)

      // ---- Countries --------------------------------------------------------
      // Filled with the visible vertices only. On the globe a ring straddling the
      // limb therefore closes along the horizon chord, which is what the eye
      // expects; nothing is ever drawn on the hidden hemisphere.
      //
      // Land is collected into one path per pass so the fill and the two
      // coastline strokes each cost a single canvas operation instead of one per
      // country — the difference between a smooth 60fps and a stuttering globe.
      const landPath = new Path2D()
      for (const shape of ATLAS) {
        for (const ring of shape.rings) {
          let started = false
          let drawn = 0
          for (let i = 0; i < ring.coords.length; i += 2) {
            const p = project(ring.coords[i + 1], ring.coords[i])
            if (!p.visible) continue
            if (started) landPath.lineTo(p.x, p.y)
            else {
              landPath.moveTo(p.x, p.y)
              started = true
            }
            drawn++
          }
          if (drawn >= 3) landPath.closePath()
        }
      }

      const landTop = isGlobe ? cy - R : mapFrame(cam.map, viewport).top
      const landHeight = isGlobe ? R * 2 : mapFrame(cam.map, viewport).h
      const landFill = ctx.createLinearGradient(0, landTop, 0, landTop + landHeight)
      landFill.addColorStop(0, LAND_TOP)
      landFill.addColorStop(1, LAND_BOTTOM)
      ctx.fillStyle = landFill
      ctx.fill(landPath)
      // Bloom first, then the fine edge on top: coastlines read as lit rather
      // than outlined.
      ctx.strokeStyle = COAST_GLOW
      ctx.lineWidth = zoom > 3 ? 4 : 2.5
      ctx.stroke(landPath)
      ctx.strokeStyle = COAST_EDGE
      ctx.lineWidth = zoom > 3 ? 1.1 : 0.7
      ctx.stroke(landPath)

      // ---- Arcs -------------------------------------------------------------
      if (arcSamples.length > 0) {
        ctx.strokeStyle = 'rgba(52,211,153,0.5)'
        ctx.lineWidth = 1.4
        for (const samples of arcSamples) traceLine(samples)
      }

      // ---- Signals ----------------------------------------------------------
      const current = pointsRef.current
      const maxWeight = Math.max(1, ...current.map((p) => p.weight))
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 420)
      const plotted: Array<{ x: number; y: number; point: SurfacePoint }> = []
      let nearest: { x: number; y: number; label: string; d: number } | null = null

      for (const pt of current) {
        const p = project(pt.lat, pt.lon)
        if (!p.visible) continue
        const color = pt.color ?? POINT_DEFAULT
        const size = (2.5 + (pt.weight / maxWeight) * 6) * Math.min(1.6, Math.sqrt(zoom))
        const intensity = pt.intensity ?? 0

        if (intensity > 0.45) {
          // A live ring that grows and fades — only for genuinely urgent signals.
          ctx.strokeStyle = color
          ctx.globalAlpha = (1 - pulse) * 0.6 * intensity
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(p.x, p.y, size * (1.5 + pulse * 2.5), 0, Math.PI * 2)
          ctx.stroke()
          ctx.globalAlpha = 1
        }

        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3)
        halo.addColorStop(0, withAlpha(color, 0.55))
        halo.addColorStop(1, withAlpha(color, 0))
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
        ctx.fill()

        plotted.push({ x: p.x, y: p.y, point: pt })
        const hp = pointerRef.current
        if (hp) {
          const d = Math.hypot(hp.x - p.x, hp.y - p.y)
          if (d < 16 && (!nearest || d < nearest.d)) {
            nearest = { x: p.x, y: p.y, label: pt.label, d }
          }
        }
      }
      plottedRef.current = plotted

      // ---- Depth pass -------------------------------------------------------
      // Still inside the clip: a vignette sinks the edges so the eye is pulled to
      // the centre of the surface rather than to its border.
      if (isGlobe) {
        const vignette = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R)
        vignette.addColorStop(0, 'rgba(0,0,0,0)')
        // Enough to round the sphere, not enough to bury a country's shape.
        vignette.addColorStop(1, 'rgba(0,0,0,0.28)')
        ctx.fillStyle = vignette
        ctx.beginPath()
        ctx.arc(cx, cy, R, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const frame = mapFrame(cam.map, viewport)
        const vignette = ctx.createRadialGradient(
          frame.left + frame.w / 2,
          frame.top + frame.h / 2,
          Math.min(frame.w, frame.h) * 0.35,
          frame.left + frame.w / 2,
          frame.top + frame.h / 2,
          Math.max(frame.w, frame.h) * 0.75,
        )
        vignette.addColorStop(0, 'rgba(0,0,0,0)')
        // Lighter than the globe's: a flat map has data all the way to its
        // edges, and dimming the corners must not hide a signal sitting there.
        vignette.addColorStop(1, 'rgba(0,0,0,0.3)')
        ctx.fillStyle = vignette
        ctx.fillRect(frame.left, frame.top, frame.w, frame.h)
      }

      ctx.restore()

      // ---- HUD --------------------------------------------------------------
      // Readouts, not decoration: the coordinate is the real position under the
      // pointer (inverse projection), the counts are the real plotted counts,
      // and the clock is real UTC. An instrument that displays invented numbers
      // is worse than one that displays none.
      const hp = pointerRef.current
      const cursor = hp
        ? isGlobe
          ? unprojectGlobe(hp.x, hp.y, cam.globe, viewport)
          : unprojectMap(hp.x, hp.y, cam.map, viewport)
        : null

      ctx.font =
        '10px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
      ctx.textBaseline = 'top'
      const hud = (text: string, x: number, y: number, align: CanvasTextAlign = 'left') => {
        ctx.textAlign = align
        ctx.fillStyle = 'rgba(3, 10, 18, 0.55)'
        const w = ctx.measureText(text).width
        const bx = align === 'right' ? x - w - 4 : x - 4
        ctx.fillRect(bx, y - 2, w + 8, 14)
        ctx.fillStyle = HUD_TEXT
        ctx.fillText(text, x, y)
      }

      const now = new Date()
      const utc = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}Z`

      hud(`${isGlobe ? 'ORTHO' : 'EQUIRECT'}  ×${zoom.toFixed(2)}`, 12, height - 34)
      hud(
        cursor
          ? `${cursor.lat >= 0 ? 'N' : 'S'}${Math.abs(cursor.lat).toFixed(2)}  ${cursor.lon >= 0 ? 'E' : 'W'}${Math.abs(cursor.lon).toFixed(2)}`
          : 'LAT ---.--  LON ---.--',
        12,
        height - 18,
      )
      hud(utc, width - 12, height - 34, 'right')
      hud(`${plotted.length}/${current.length} PLOTTED`, width - 12, height - 18, 'right')

      // A reticle at the pointer, so the coordinate readout has something to
      // point at. Only when the pointer is genuinely over the planet.
      if (hp && cursor) {
        ctx.strokeStyle = 'rgba(125,211,252,0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(hp.x - 9, hp.y)
        ctx.lineTo(hp.x - 3, hp.y)
        ctx.moveTo(hp.x + 3, hp.y)
        ctx.lineTo(hp.x + 9, hp.y)
        ctx.moveTo(hp.x, hp.y - 9)
        ctx.lineTo(hp.x, hp.y - 3)
        ctx.moveTo(hp.x, hp.y + 3)
        ctx.lineTo(hp.x, hp.y + 9)
        ctx.stroke()
      }

      // ---- Instrument frame -------------------------------------------------
      // Outside the clip, so it sits on the surface's boundary: a lit rim on the
      // globe, a measured border on the map. This is the identity of the
      // product — a reading instrument, not an illustration.
      if (isGlobe) {
        const rim = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.04)
        rim.addColorStop(0, 'rgba(56,189,248,0)')
        rim.addColorStop(0.5, 'rgba(125,211,252,0.5)')
        rim.addColorStop(1, 'rgba(56,189,248,0)')
        ctx.fillStyle = rim
        ctx.beginPath()
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const frame = mapFrame(cam.map, viewport)
        ctx.strokeStyle = 'rgba(125,211,252,0.35)'
        ctx.lineWidth = 1
        ctx.strokeRect(frame.left + 0.5, frame.top + 0.5, frame.w - 1, frame.h - 1)
        // Corner ticks — the convention of a plotted chart.
        const tick = Math.min(18, frame.w * 0.05)
        ctx.strokeStyle = 'rgba(125,211,252,0.75)'
        ctx.lineWidth = 1.5
        for (const [x, y, dx, dy] of [
          [frame.left, frame.top, 1, 1],
          [frame.left + frame.w, frame.top, -1, 1],
          [frame.left, frame.top + frame.h, 1, -1],
          [frame.left + frame.w, frame.top + frame.h, -1, -1],
        ]) {
          ctx.beginPath()
          ctx.moveTo(x + dx * tick, y)
          ctx.lineTo(x, y)
          ctx.lineTo(x, y + dy * tick)
          ctx.stroke()
        }
      }

      if (nearest) {
        if (!hoverRef.current || hoverRef.current.label !== nearest.label) {
          setHover({ x: nearest.x, y: nearest.y, label: nearest.label })
        }
      } else if (hoverRef.current) setHover(null)

      if (isGlobe && autospinRef.current && !dragRef.current.active) {
        cam.globe.rotation += 0.0022
      }
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('wheel', onWheel)
      if (autospinTimerRef.current) window.clearTimeout(autospinTimerRef.current)
    }
  }, [arcsKey, height])

  const onPointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, moved: 0 }
    autospinRef.current = false
    // Pointer capture is a convenience, never a requirement: it throws when the
    // pointer is already gone (routine on touch), and an uncaught throw here
    // would unmount the tree and blank the page.
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* dragging still works without capture */
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const pts = pointersRef.current
    const cam = cameraRef.current
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pts.size >= 2) {
      const [a, b] = [...pts.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinchRef.current != null && pinchRef.current > 0) {
        const factor = dist / pinchRef.current
        if (mode === 'globe') cam.globe.zoom = clampZoom(cam.globe.zoom * factor)
        else cam.map.zoom = clampZoom(cam.map.zoom * factor)
      }
      pinchRef.current = dist
      return
    }

    const drag = dragRef.current
    if (!drag.active) return
    const dx = e.clientX - drag.lastX
    const dy = e.clientY - drag.lastY
    drag.moved += Math.abs(dx) + Math.abs(dy)
    if (mode === 'globe') {
      cam.globe.rotation += dx * 0.006
      cam.globe.tilt = clampTilt(cam.globe.tilt + dy * 0.006)
    } else {
      cam.map.offsetX += dx
      cam.map.offsetY += dy
    }
    drag.lastX = e.clientX
    drag.lastY = e.clientY
  }

  const releasePointer = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) {
      dragRef.current.active = false
      if (autospinTimerRef.current) window.clearTimeout(autospinTimerRef.current)
      // Only a cosmetic idle behaviour — it must never outlive the canvas.
      autospinTimerRef.current = window.setTimeout(() => {
        autospinRef.current = true
      }, 2500)
    }
    try {
      const el = e.currentTarget as HTMLElement
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    } catch {
      /* nothing to release */
    }
  }

  const onClick = (e: React.PointerEvent) => {
    // A drag that ended over a point is a pan, not a selection.
    if (!onSelect || dragRef.current.moved > 6) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    let best: { d: number; point: SurfacePoint } | null = null
    for (const p of plottedRef.current) {
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < 18 && (!best || d < best.d)) best = { d, point: p.point }
    }
    if (best) onSelect(best.point)
  }

  const nudgeZoom = (factor: number) => {
    const cam = cameraRef.current
    if (mode === 'globe') cam.globe.zoom = clampZoom(cam.globe.zoom * factor)
    else cam.map.zoom = clampZoom(cam.map.zoom * factor)
  }

  const resetView = () => {
    const cam = cameraRef.current
    cam.map = { zoom: 1, offsetX: 0, offsetY: 0 }
    cam.globe = {
      zoom: focus ? 1.8 : 1,
      tilt: focus ? clampTilt((focus.lat * Math.PI) / 180) : 0.35,
      rotation: focus ? -(focus.lon * Math.PI) / 180 : cam.globe.rotation,
    }
  }

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <canvas
        ref={canvasRef}
        /**
         * `touch-action: pan-y`, not `none`.
         *
         * The canvas fills most of a phone screen. With touch actions disabled
         * outright it swallowed every vertical swipe, so a reader could not
         * scroll past the globe to the events beneath it — the page looked like
         * it contained nothing but a sphere. Keeping vertical panning with the
         * browser costs the globe only vertical drag (tilt), which the reset
         * button restores, and gives the page back to the reader.
         */
        className={`h-full w-full [touch-action:pan-y] ${
          onSelect ? 'cursor-pointer' : 'cursor-grab'
        } active:cursor-grabbing`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          onClick(e)
          releasePointer(e)
        }}
        onPointerCancel={releasePointer}
        onPointerLeave={(e) => {
          pointerRef.current = null
          releasePointer(e)
        }}
      />

      {showToggle ? (
        // One button, not two: there are exactly two views, so the control shows
        // the view you would switch *to* and swaps on each press.
        <button
          onClick={() => setMode(mode === 'globe' ? 'map' : 'globe')}
          className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-background/80 px-2.5 py-1.5 text-[11px] font-medium text-foreground ring-1 ring-border backdrop-blur transition-colors hover:bg-background"
          title={mode === 'globe' ? 'Switch to the flat world map' : 'Switch to the 3D globe'}
          aria-label={mode === 'globe' ? 'Switch to the flat world map' : 'Switch to the 3D globe'}
        >
          {mode === 'globe' ? (
            <>
              <MapIcon className="h-3.5 w-3.5 text-primary" /> Map
            </>
          ) : (
            <>
              <Globe2 className="h-3.5 w-3.5 text-primary" /> Globe
            </>
          )}
        </button>
      ) : null}

      {/* Clear of the HUD band along the bottom edge. */}
      <div className="absolute bottom-12 right-3 flex flex-col gap-1">
        <button
          onClick={() => nudgeZoom(1.3)}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-foreground ring-1 ring-border backdrop-blur hover:bg-background"
          title="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => nudgeZoom(1 / 1.3)}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-foreground ring-1 ring-border backdrop-blur hover:bg-background"
          title="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={resetView}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground ring-1 ring-border backdrop-blur hover:bg-background"
          title="Reset view"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 max-w-[240px] -translate-x-1/2 -translate-y-full truncate rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium shadow ring-1 ring-border"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          {hover.label}
        </div>
      ) : null}
    </div>
  )
}

/** Accepts #rrggbb or an rgb()/rgba() string and returns it at a given alpha. */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  const nums = color.match(/-?\d+(\.\d+)?/g)
  if (nums && nums.length >= 3) return `rgba(${nums[0]},${nums[1]},${nums[2]},${alpha})`
  return color
}
