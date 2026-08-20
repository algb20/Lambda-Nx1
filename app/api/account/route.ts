import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { SESSION_COOKIE } from '@/lib/auth/session'
import { isDbConfigured, repo } from '@/lib/db'
import { getStorageProvider, deleteByPrefix } from '@/lib/storage'
import { keyFromAvatarPath } from '@/lib/modules/avatar'
import { normalizeFullName } from '@/lib/auth/standalone'

/**
 * DELETE /api/account — erase the signed-in account.
 *
 * A product that collects a person's identity has to be able to give it back,
 * and "email us and we'll do it" is not that (GDPR art. 17: without undue delay,
 * and by a route the person controls). This is the route.
 *
 * Three things happen, in an order chosen so a failure at any point leaves a
 * recoverable state rather than a half-deleted one:
 *
 *  1. The avatar is removed from object storage **first**. Storage has no
 *     foreign keys, so the only handle on that file is the row about to be
 *     deleted — dropping the row first would orphan the image permanently. A
 *     failure here is logged and does not stop the deletion, because a stale
 *     image is a smaller harm than an account the person cannot get rid of.
 *  2. The user row is deleted, and the schema's cascades take everything that
 *     belongs to it with it (see repo.users.remove).
 *  3. The session cookie is cleared, so the browser is not left holding a token
 *     for a user id that no longer resolves.
 *
 * There is no soft delete and no grace period. A deletion the user is told
 * happened must have happened.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Body must confirm intent, so a stray fetch cannot erase an account. */
const CONFIRMATION = 'DELETE'

/**
 * PATCH /api/account { fullName?, showRealName? } — the profile switch.
 *
 * `showRealName` is one visibility state for everybody, not a per-viewer
 * preference: the eye control in the interface asks "can other people see my
 * name", and an answer that varied by who was looking would be a different,
 * much more complicated promise than the one the control makes.
 *
 * Sending `fullName: ""` erases the name. That has to be possible — a person who
 * gave a real name and regrets it needs a way back that is not deleting the
 * whole account.
 */
export async function PATCH(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }

  let body: { fullName?: unknown; showRealName?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patch: { fullName?: string | null; showRealName?: boolean } = {}
  if (typeof body.fullName === 'string') {
    try {
      patch.fullName = normalizeFullName(body.fullName)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid name' },
        { status: 400 },
      )
    }
  }
  if (typeof body.showRealName === 'boolean') patch.showRealName = body.showRealName

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  }

  const user = await repo.users.setProfile(userId, patch)
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  return NextResponse.json({ fullName: user.fullName, showRealName: user.showRealName })
}

export async function DELETE(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }

  let body: { confirm?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    /* handled by the check below */
  }
  if (body.confirm !== CONFIRMATION) {
    return NextResponse.json(
      { error: `Send {"confirm":"${CONFIRMATION}"} to erase this account. This cannot be undone.` },
      { status: 400 },
    )
  }

  const user = await repo.users.getById(userId)
  if (!user) {
    // Already gone. Still clear the cookie: a token for a missing user is worse
    // than no token.
    return clearedResponse({ deleted: false })
  }

  // Every version, not just the current one. Avatar keys carry a version
  // segment so a replaced picture gets a fresh URL past every cache — which
  // means a user who changed their picture five times owns five objects.
  // Deleting only the one the `users` row points at would leave the rest
  // behind forever: orphaned images of somebody who asked to be erased.
  try {
    const removed = await deleteByPrefix(`avatars/${userId}/`)
    if (removed > 0) console.info(`[account] removed ${removed} stored image(s)`)
  } catch (err) {
    // A stale image is a smaller harm than an account nobody can get rid of,
    // so this is logged and the deletion continues.
    console.error('[account] image cleanup failed, continuing with account deletion:', err)
  }

  // Older accounts may hold an avatar written before blobs moved into the
  // database; that one lives under a key the prefix sweep does not reach.
  if (user.avatarUrl) {
    const key = keyFromAvatarPath(user.avatarUrl.replace(/^\/api\/avatar\//, ''))
    if (key) {
      try {
        await getStorageProvider().delete(key)
      } catch (err) {
        console.error('[account] avatar delete failed, continuing with account deletion:', err)
      }
    }
  }

  await repo.users.remove(userId)
  return clearedResponse({ deleted: true })
}

/** A response that also revokes the session cookie. */
function clearedResponse(payload: Record<string, unknown>): NextResponse {
  const res = NextResponse.json(payload)
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
