import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured, repo } from '@/lib/db'
import { getStorageProvider } from '@/lib/storage'
import { MAX_AVATAR_BYTES, avatarKey, avatarUrl, inspectAvatar } from '@/lib/modules/avatar'

/**
 * POST /api/avatar — upload or replace the signed-in user's picture.
 * DELETE /api/avatar — remove it and fall back to initials.
 *
 * The bytes are inspected rather than trusted: the declared content type and the
 * file name are both attacker-controlled, so neither decides anything. Stored
 * through lib/storage, so the backend stays swappable and no vendor URL ever
 * reaches the database.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }

  let bytes: Uint8Array
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Attach an image as "file"' }, { status: 400 })
    }
    // Read at most one byte over the limit: enough to reject, not enough to
    // let an enormous upload occupy memory.
    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: `Images must be under ${Math.round(MAX_AVATAR_BYTES / 1024 / 1024)} MB` },
        { status: 413 },
      )
    }
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Could not read the upload' }, { status: 400 })
  }

  const check = inspectAvatar(bytes)
  if (!check.ok || !check.format || !check.contentType) {
    return NextResponse.json({ error: check.error ?? 'Unsupported image' }, { status: 415 })
  }

  const key = avatarKey(userId, check.format)
  try {
    await getStorageProvider().put(key, bytes, check.contentType)
  } catch {
    return NextResponse.json({ error: 'Could not store the image' }, { status: 502 })
  }

  const url = avatarUrl(key)
  await repo.users.setAvatar(userId, url)
  return NextResponse.json({ avatarUrl: url })
}

export async function DELETE() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }
  await repo.users.setAvatar(userId, null)
  return NextResponse.json({ avatarUrl: null })
}
