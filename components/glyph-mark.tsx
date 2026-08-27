'use client'

import { useEffect, useRef } from 'react'
import { glyphFor } from '@/lib/geo/glyphs'

/**
 * One category's mark, drawn at chip size — so the legend *is* the map's key.
 *
 * The chips that show and hide categories used to carry a coloured dot. A dot
 * is not a key: it tells a reader which hue a category owns and nothing about
 * the shape that will actually appear on the map, which means the map has to be
 * decoded against a legend the reader has to go and find.
 *
 * Drawing the same glyph here, in the same colour, with the same motion, closes
 * that loop: the reader learns the vocabulary in the row they are already using
 * to filter, and every shape on the map is one they have seen named.
 *
 * ## One clock for every mark on the page
 *
 * Each chip animating on its own `requestAnimationFrame` would put twenty-five
 * loops on a page that needs one, and they would drift out of step — which
 * looks like a fault. The phase comes from wall-clock time instead, so every
 * mark on the screen, in the chips and on the map alike, is at the same point
 * in its cycle without any of them talking to each other.
 */

/** The cycle length, shared with the surface renderer's own pulse. */
const CYCLE_MS = 2600

export function GlyphMark({
  category,
  color,
  size = 14,
  dim = false,
}: {
  category: string
  color: string
  /** Drawn size in CSS pixels. The glyph fills a circle of half this. */
  size?: number
  /** Muted categories are drawn faintly rather than removed — the chip stays legible. */
  dim?: boolean
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const spec = glyphFor(category)
    let frame = 0
    let stopped = false

    const paint = () => {
      if (stopped) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (canvas.width !== Math.round(size * dpr)) {
        canvas.width = Math.round(size * dpr)
        canvas.height = Math.round(size * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      ctx.globalAlpha = dim ? 0.35 : 1
      ctx.fillStyle = color
      ctx.strokeStyle = color
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const phase = spec.animated ? ((Date.now() % CYCLE_MS) / CYCLE_MS) : 0
      // 0.42 rather than 0.5: the bounds test allows a glyph to reach a little
      // past its stated radius, and a chip has no room to spare.
      spec.draw(ctx, size / 2, size / 2, size * 0.42, phase)
      ctx.globalAlpha = 1
      // A still mark is painted once. Twenty-five idle loops for shapes that
      // never change is a cost with nothing on the other side of it.
      if (spec.animated) frame = requestAnimationFrame(paint)
    }

    frame = requestAnimationFrame(paint)
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
    }
  }, [category, color, size, dim])

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0"
      aria-hidden
    />
  )
}
