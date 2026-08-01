'use client'

import { useEffect, useRef, useState } from 'react'
import type { GlobePoint } from '@/lib/geo/centroids'

/**
 * DataGlobe — our own 3D globe (pure canvas, no heavy libraries). It projects a
 * unit sphere with yaw + tilt, draws a glowing graticule and plots weighted data
 * points on the front hemisphere. Auto-rotates, drag to spin, hover for a label.
 * Designed for the Lambda NX look: a dark "intelligence" planet with cyan grid
 * and emerald signals. Renders reliably everywhere (2D canvas).
 */
interface Projected {
  sx: number
  sy: number
  visible: boolean
}

function project(
  latDeg: number,
  lonDeg: number,
  rotation: number,
  tilt: number,
  R: number,
  cx: number,
  cy: number,
): Projected {
  const la = (latDeg * Math.PI) / 180
  const lo = (lonDeg * Math.PI) / 180 + rotation
  const x = Math.cos(la) * Math.sin(lo)
  const y = Math.sin(la)
  const z = Math.cos(la) * Math.cos(lo)
  const cosT = Math.cos(tilt)
  const sinT = Math.sin(tilt)
  const y2 = y * cosT - z * sinT
  const z2 = y * sinT + z * cosT
  return { sx: cx + x * R, sy: cy - y2 * R, visible: z2 > 0 }
}

export function DataGlobe({ points, height = 380 }: { points: GlobePoint[]; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef({ rotation: 0, tilt: 0.35, dragging: false, lastX: 0, lastY: 0, autospin: true })
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null)
  const hoverRef = useRef(hover)
  hoverRef.current = hover

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

    const maxWeight = Math.max(1, ...points.map((p) => p.weight))

    const draw = () => {
      const w = canvas.clientWidth
      const h = height
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) / 2 - 18
      const st = stateRef.current

      // Atmosphere glow
      const glow = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.18)
      glow.addColorStop(0, 'rgba(56,189,248,0.16)')
      glow.addColorStop(1, 'rgba(56,189,248,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.18, 0, Math.PI * 2)
      ctx.fill()

      // Sphere body
      const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R)
      body.addColorStop(0, '#0b1f33')
      body.addColorStop(1, '#050b14')
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()

      // Graticule
      ctx.strokeStyle = 'rgba(56,189,248,0.22)'
      ctx.lineWidth = 1
      const drawArc = (samples: Array<[number, number]>) => {
        let started = false
        ctx.beginPath()
        for (const [lat, lon] of samples) {
          const p = project(lat, lon, st.rotation, st.tilt, R, cx, cy)
          if (!p.visible) {
            started = false
            continue
          }
          if (!started) {
            ctx.moveTo(p.sx, p.sy)
            started = true
          } else ctx.lineTo(p.sx, p.sy)
        }
        ctx.stroke()
      }
      for (let lon = -180; lon < 180; lon += 30) {
        const s: Array<[number, number]> = []
        for (let lat = -90; lat <= 90; lat += 4) s.push([lat, lon])
        drawArc(s)
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const s: Array<[number, number]> = []
        for (let lon = -180; lon <= 180; lon += 4) s.push([lat, lon])
        drawArc(s)
      }

      // Data points
      let nearest: { x: number; y: number; label: string; d: number } | null = null
      for (const pt of points) {
        const p = project(pt.lat, pt.lon, st.rotation, st.tilt, R, cx, cy)
        if (!p.visible) continue
        const size = 2.5 + (pt.weight / maxWeight) * 6
        const halo = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, size * 3)
        halo.addColorStop(0, 'rgba(16,185,129,0.55)')
        halo.addColorStop(1, 'rgba(16,185,129,0)')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, size * 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#34d399'
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, size, 0, Math.PI * 2)
        ctx.fill()
        // track for tooltip via last pointer pos
        const hp = pointerRef.current
        if (hp) {
          const d = Math.hypot(hp.x - p.sx, hp.y - p.sy)
          if (d < 14 && (!nearest || d < nearest.d)) nearest = { x: p.sx, y: p.sy, label: `${pt.label} · ${pt.weight}`, d }
        }
      }
      if (nearest) {
        if (!hoverRef.current || hoverRef.current.label !== nearest.label) setHover({ x: nearest.x, y: nearest.y, label: nearest.label })
      } else if (hoverRef.current) setHover(null)

      if (st.autospin && !st.dragging) st.rotation += 0.0022
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [points, height])

  // Pointer interaction
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    const st = stateRef.current
    st.dragging = true
    st.autospin = false
    st.lastX = e.clientX
    st.lastY = e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const st = stateRef.current
    if (st.dragging) {
      st.rotation += (e.clientX - st.lastX) * 0.006
      st.tilt = Math.max(-1.2, Math.min(1.2, st.tilt + (e.clientY - st.lastY) * 0.006))
      st.lastX = e.clientX
      st.lastY = e.clientY
    }
  }
  const endDrag = () => {
    stateRef.current.dragging = false
    // resume gentle autospin shortly after release
    window.setTimeout(() => (stateRef.current.autospin = true), 2500)
  }

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={() => {
          pointerRef.current = null
          endDrag()
        }}
      />
      {hover ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium shadow ring-1 ring-border"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          {hover.label}
        </div>
      ) : null}
    </div>
  )
}
