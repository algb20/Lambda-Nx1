import { NextResponse } from 'next/server'
import { getStorageProvider } from '@/lib/storage'
import { keyFromAvatarPath } from '@/lib/modules/avatar'

/**
 * GET /api/avatar/<user>/<version>.<ext> — serve a stored profile picture.
 *
 * The path is validated back into a storage key rather than concatenated into
 * one, so a request cannot climb out of the avatars prefix and read something
 * else. Content-Type is set from the extension we ourselves wrote, never from
 * the request, and `nosniff` stops a browser from second-guessing it.
 */
export const runtime = 'nodejs'

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const key = keyFromAvatarPath((path ?? []).join('/'))
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const bytes = await getStorageProvider()
    .get(key)
    .catch(() => null)
  if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ext = key.split('.').pop() ?? ''
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      // The key carries a version, so a replaced picture is a different URL and
      // this can be cached hard.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
