import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { repo, isDbConfigured } from '@/lib/db'
import { validatePostInput } from '@/lib/posts'
import { toPublicPost } from '@/lib/post-mapper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/posts — the public feed, newest first. */
export async function GET(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ posts: [] })
  const url = new URL(request.url)
  const limitRaw = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50
  const beforeRaw = url.searchParams.get('before')
  const before = beforeRaw ? new Date(beforeRaw) : undefined
  const rows = await repo.posts.listPublic(limit, before && !isNaN(before.getTime()) ? before : undefined)
  return NextResponse.json({ posts: rows.map(toPublicPost) })
}

/** POST /api/posts — publish. Requires a signed-in user. */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Publishing requires the database' }, { status: 503 })
  }
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to publish' }, { status: 401 })
  }
  const user = await repo.users.getById(userId)
  if (!user) return NextResponse.json({ error: 'Unknown user' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = validatePostInput(body as Record<string, unknown>)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const created = await repo.posts.create({
    authorUserId: user.id,
    authorName: user.displayName ?? user.externalId,
    kind: parsed.value.kind,
    title: parsed.value.title,
    body: parsed.value.body,
    sourceUrl: parsed.value.sourceUrl,
    refType: parsed.value.refType,
    refValue: parsed.value.refValue,
    locale: parsed.value.locale,
    visibility: parsed.value.visibility,
  })
  return NextResponse.json({ post: toPublicPost(created) }, { status: 201 })
}
