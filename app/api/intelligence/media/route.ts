import { NextResponse } from 'next/server'
import { analyzeMedia } from '@/lib/modules/media'

/**
 * POST /api/intelligence/media  { imageBase64?, imageUrl? }
 * EXIF is parsed from the bytes locally (never uploaded anywhere); reverse-image
 * links are generated from imageUrl. Passive and keyless.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 15 * 1024 * 1024

export async function POST(request: Request) {
  let body: { imageBase64?: unknown; imageUrl?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let bytes: Uint8Array | undefined
  if (typeof body.imageBase64 === 'string' && body.imageBase64.length > 0) {
    const b64 = body.imageBase64.replace(/^data:[^;]+;base64,/, '')
    const buf = Buffer.from(b64, 'base64')
    if (buf.length === 0) return NextResponse.json({ error: 'Could not decode image' }, { status: 400 })
    if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'Image too large (max 15MB)' }, { status: 413 })
    bytes = new Uint8Array(buf)
  }
  const imageUrl =
    typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : undefined

  if (!bytes && !imageUrl) {
    return NextResponse.json({ error: 'Provide an image file or an image URL.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await analyzeMedia({ bytes, imageUrl }))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 400 },
    )
  }
}
