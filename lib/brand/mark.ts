/**
 * The Lambda NX signature — the lambda symbol (λ) alone, no text.
 *
 * This is the single source of truth for the mark's geometry, so the on-screen
 * logo, the SVG we embed, and the watermark stamped onto exported research,
 * posts and images are all *the same shape*. Drawn as two rounded strokes on a
 * 100×100 canvas — font-independent (no glyph dependency, renders identically on
 * every host) and crisp at any size.
 */

/** The two strokes that form the λ, in a 0..100 unit square. */
export const LAMBDA_STROKES: ReadonlyArray<{ x1: number; y1: number; x2: number; y2: number }> = [
  // Main leg: upper-left down to lower-right.
  { x1: 32, y1: 16, x2: 74, y2: 86 },
  // Branch: from the junction down to lower-left.
  { x1: 53, y1: 48, x2: 24, y2: 86 },
]

/** Default stroke thickness in the 100-unit space. */
export const LAMBDA_STROKE_WIDTH = 13
/** The coordinate space the strokes are defined in. */
export const LAMBDA_VIEWBOX = 100

export interface MarkOptions {
  /** Rendered size in px (width = height). Default 100. */
  size?: number
  /** Stroke colour. Default 'currentColor' so CSS can drive it. */
  color?: string
  /** 0..1 opacity for watermark use. Default 1. */
  opacity?: number
  /** Stroke width in the 100-unit space. Default LAMBDA_STROKE_WIDTH. */
  strokeWidth?: number
  /** Optional accessible title; omit for a decorative mark. */
  title?: string
}

/**
 * The λ mark as a standalone SVG string — for embedding in exported HTML/PDF,
 * data-URI watermarks, or anywhere a component can't be used.
 */
export function lambdaMarkSvg(opts: MarkOptions = {}): string {
  const size = opts.size ?? LAMBDA_VIEWBOX
  const color = opts.color ?? 'currentColor'
  const opacity = opts.opacity ?? 1
  const sw = opts.strokeWidth ?? LAMBDA_STROKE_WIDTH
  const title = opts.title
  const strokes = LAMBDA_STROKES.map(
    (s) => `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`,
  ).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${LAMBDA_VIEWBOX} ${LAMBDA_VIEWBOX}" fill="none" ` +
    `role="${title ? 'img' : 'presentation'}"${title ? ` aria-label="${escapeXml(title)}"` : ' aria-hidden="true"'}>` +
    (title ? `<title>${escapeXml(title)}</title>` : '') +
    `<g stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">` +
    strokes +
    `</g></svg>`
  )
}

/** A base64 `data:` URI of the mark, e.g. for a CSS background or an <img> src. */
export function lambdaMarkDataUri(opts: MarkOptions = {}): string {
  const svg = lambdaMarkSvg(opts)
  const b64 = typeof btoa === 'function' ? btoa(svg) : Buffer.from(svg, 'utf8').toString('base64')
  return `data:image/svg+xml;base64,${b64}`
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;',
  )
}
