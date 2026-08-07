/**
 * Client-side image watermarking — stamp the λ signature onto an image the user
 * downloads or shares, so shared visuals carry the app mark. Browser-only (uses
 * canvas); guarded so importing it server-side is harmless.
 */
import { drawLambdaWatermark, type CanvasWatermarkOptions } from './watermark'

/**
 * Load an image (URL, object URL or data URI), stamp the λ, and return a PNG
 * blob. Rejects if run without a DOM or if the image fails to load (e.g. a
 * cross-origin image without CORS, which would taint the canvas).
 */
export async function watermarkImage(
  src: string,
  opts: CanvasWatermarkOptions = {},
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('watermarkImage requires a browser environment')
  }
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not obtain a 2D canvas context')

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  // Auto-pick a legible stroke colour if the caller didn't specify one.
  const withColor: CanvasWatermarkOptions =
    opts.color != null ? opts : { ...opts, color: pickStrokeColor(ctx, canvas.width, canvas.height) }
  drawLambdaWatermark(ctx, canvas.width, canvas.height, withColor)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      'image/png',
    )
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // allow same-origin/CORS images to be exported
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image for watermarking'))
    img.src = src
  })
}

/**
 * Sample the corner the mark will sit in and choose black or white for contrast,
 * so the signature stays legible on both light and dark images.
 */
function pickStrokeColor(ctx: CanvasRenderingContext2D, width: number, height: number): string {
  try {
    const s = Math.max(8, Math.floor(Math.min(width, height) * 0.15))
    const data = ctx.getImageData(width - s, height - s, s, s).data
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      // Perceived luminance (Rec. 601).
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    const avg = sum / (data.length / 4)
    return avg > 140 ? '#111111' : '#ffffff'
  } catch {
    return '#ffffff' // getImageData can throw on a tainted canvas; default to white
  }
}
