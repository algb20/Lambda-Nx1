/**
 * Module 3 — Media / content verification. Fully passive and keyless: EXIF is
 * parsed from the image bytes locally (no upload to any third party), reverse-
 * image search is offered as deep links, and AI-generation indicators are simple
 * honest heuristics (never asserted as proof).
 */
import exifr from 'exifr'

export interface MediaMetadata {
  make?: string
  model?: string
  lens?: string
  software?: string
  dateTaken?: string
  gps?: { latitude: number; longitude: number }
  width?: number
  height?: number
}

export interface ReverseLink {
  engine: string
  url: string
}

export interface MediaReport {
  generatedAt: string
  hasExif: boolean
  metadata: MediaMetadata
  aiIndicators: string[]
  gpsMapUrl?: string
  reverseLinks: ReverseLink[]
}

const AI_SOFTWARE =
  /stable diffusion|dall-?e|midjourney|firefly|automatic1111|comfyui|invokeai|novelai|leonardo|gpt-4o|imagen/i

function str(v: unknown): string | undefined {
  if (v == null) return undefined
  if (v instanceof Date) return v.toISOString()
  const s = String(v).trim()
  return s.length ? s : undefined
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

export function reverseImageLinks(imageUrl: string): ReverseLink[] {
  const u = encodeURIComponent(imageUrl)
  return [
    { engine: 'Yandex', url: `https://yandex.com/images/search?rpt=imageview&url=${u}` },
    { engine: 'Google Lens', url: `https://lens.google.com/uploadbyurl?url=${u}` },
    { engine: 'Bing', url: `https://www.bing.com/images/search?q=imgurl:${u}&view=detailv2&iss=sbi` },
    { engine: 'TinEye', url: `https://tineye.com/search?url=${u}` },
  ]
}

export function computeAiIndicators(meta: MediaMetadata, hasExif: boolean): string[] {
  const out: string[] = []
  if (meta.software && AI_SOFTWARE.test(meta.software)) {
    out.push(`Software tag indicates AI generation: ${meta.software}`)
  }
  if (!hasExif) {
    out.push('No EXIF metadata — common for AI-generated or metadata-stripped images (not conclusive)')
  } else if (!meta.make && !meta.model) {
    out.push('Metadata present but no camera make/model (possible edit or export)')
  }
  return out
}

export async function analyzeImageBytes(
  bytes: Uint8Array,
): Promise<Pick<MediaReport, 'hasExif' | 'metadata' | 'aiIndicators' | 'gpsMapUrl'>> {
  let raw: Record<string, unknown> | undefined
  try {
    // Defaults parse ifd0 + exif (Make/Model/Software/DateTimeOriginal); gps:true adds lat/lon.
    raw = (await exifr.parse(bytes, { gps: true })) as Record<string, unknown> | undefined
  } catch {
    raw = undefined
  }

  const hasExif = Boolean(raw && Object.keys(raw).length > 0)
  const lat = num(raw?.latitude)
  const lon = num(raw?.longitude)
  const gps = lat !== undefined && lon !== undefined ? { latitude: lat, longitude: lon } : undefined

  const metadata: MediaMetadata = {
    make: str(raw?.Make),
    model: str(raw?.Model),
    lens: str(raw?.LensModel),
    software: str(raw?.Software),
    dateTaken: str(raw?.DateTimeOriginal ?? raw?.CreateDate),
    gps,
    width: num(raw?.ExifImageWidth ?? raw?.ImageWidth),
    height: num(raw?.ExifImageHeight ?? raw?.ImageHeight),
  }

  return {
    hasExif,
    metadata,
    aiIndicators: computeAiIndicators(metadata, hasExif),
    gpsMapUrl: gps
      ? `https://www.openstreetmap.org/?mlat=${gps.latitude}&mlon=${gps.longitude}#map=15/${gps.latitude}/${gps.longitude}`
      : undefined,
  }
}

/** Combine local EXIF analysis (from bytes) with reverse-search links (from a URL). */
export async function analyzeMedia(input: {
  bytes?: Uint8Array
  imageUrl?: string
}): Promise<MediaReport> {
  const generatedAt = new Date().toISOString()
  const analysis = input.bytes
    ? await analyzeImageBytes(input.bytes)
    : { hasExif: false, metadata: {}, aiIndicators: [], gpsMapUrl: undefined }
  return {
    generatedAt,
    ...analysis,
    reverseLinks: input.imageUrl ? reverseImageLinks(input.imageUrl) : [],
  }
}
