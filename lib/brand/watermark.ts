/**
 * Stamping the λ signature onto exported artefacts.
 *
 * All of these draw the *same* λ from `mark.ts`, so a watermark is always the
 * real app mark — the lambda symbol alone, never text (the operator's explicit
 * choice). Two output paths:
 *
 *  - `drawLambdaWatermark(ctx, …)` — paints onto a 2D canvas, for images and
 *    exported/rendered video frames.
 *  - `lambdaWatermarkCss(…)` — a CSS background-image (data-URI) for the HTML
 *    overlay used on rendered research and posts (see components/watermark.tsx).
 */
import { LAMBDA_STROKES, LAMBDA_STROKE_WIDTH, LAMBDA_VIEWBOX, lambdaMarkDataUri } from './mark'

export type WatermarkCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export interface CanvasWatermarkOptions {
  /** Mark size as a fraction of the smaller image dimension. Default 0.12. */
  scale?: number
  /** Padding from the edge, as a fraction of the smaller dimension. Default 0.04. */
  margin?: number
  /** 0..1 opacity. Default 0.5 — visible but not obscuring. */
  opacity?: number
  /** Stroke colour. Default white; pass a dark colour for light images. */
  color?: string
  corner?: WatermarkCorner
}

/** Where the mark's top-left origin sits, given the image size and options. */
export function watermarkOrigin(
  width: number,
  height: number,
  markSize: number,
  margin: number,
  corner: WatermarkCorner,
): { x: number; y: number } {
  const right = width - markSize - margin
  const bottom = height - markSize - margin
  switch (corner) {
    case 'top-left':
      return { x: margin, y: margin }
    case 'top-right':
      return { x: right, y: margin }
    case 'bottom-left':
      return { x: margin, y: bottom }
    case 'bottom-right':
    default:
      return { x: right, y: bottom }
  }
}

/**
 * Draw the λ mark onto a canvas context. Works with the browser Canvas 2D API
 * and any compatible context (e.g. node-canvas), so the same code stamps images
 * client-side and, later, server-side.
 */
export function drawLambdaWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: CanvasWatermarkOptions = {},
): void {
  const scale = opts.scale ?? 0.12
  const marginFrac = opts.margin ?? 0.04
  const opacity = opts.opacity ?? 0.5
  const color = opts.color ?? '#ffffff'
  const corner = opts.corner ?? 'bottom-right'

  const minDim = Math.min(width, height)
  const markSize = Math.max(16, minDim * scale)
  const margin = minDim * marginFrac
  const { x, y } = watermarkOrigin(width, height, markSize, margin, corner)
  const unit = markSize / LAMBDA_VIEWBOX // 100-unit space → pixels

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = LAMBDA_STROKE_WIDTH * unit
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of LAMBDA_STROKES) {
    ctx.beginPath()
    ctx.moveTo(x + s.x1 * unit, y + s.y1 * unit)
    ctx.lineTo(x + s.x2 * unit, y + s.y2 * unit)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * CSS for an HTML watermark overlay: the λ as a fixed-size background in one
 * corner. Returned as inline style props for a React element.
 */
export function lambdaWatermarkCss(opts: {
  size?: number
  opacity?: number
  color?: string
  corner?: WatermarkCorner
} = {}): {
  backgroundImage: string
  backgroundRepeat: string
  backgroundPosition: string
  backgroundSize: string
  opacity: number
} {
  const size = opts.size ?? 40
  const opacity = opts.opacity ?? 0.5
  const color = opts.color ?? 'currentColor'
  const corner = opts.corner ?? 'bottom-right'
  const pos: Record<WatermarkCorner, string> = {
    'bottom-right': 'right 12px bottom 12px',
    'bottom-left': 'left 12px bottom 12px',
    'top-right': 'right 12px top 12px',
    'top-left': 'left 12px top 12px',
  }
  return {
    backgroundImage: `url("${lambdaMarkDataUri({ color, size })}")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: pos[corner],
    backgroundSize: `${size}px ${size}px`,
    opacity,
  }
}
