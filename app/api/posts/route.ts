import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getSessionUserId } from '@/lib/auth/server'
import { repo, isDbConfigured, type Post } from '@/lib/db'
import { validatePostInput, postPermalink } from '@/lib/posts'
import { toPublicPost } from '@/lib/post-mapper'
import { broadcast, channelsForAutoPublish } from '@/lib/social/broadcast'

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
  // One lookup for every author on the page rather than one per post.
  const avatars = await repo.users.avatarsByIds(
    rows.map((r) => r.authorUserId).filter((id): id is string => Boolean(id)),
  )
  return NextResponse.json({
    posts: rows.map((row) => toPublicPost(row, row.authorUserId ? (avatars.get(row.authorUserId) ?? null) : null)),
  })
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

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? 'https'

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

  // Broadcast after the post is safely stored, and only to channels that were
  // explicitly switched on. An unlisted post is never broadcast — publishing it
  // to a channel would defeat the only thing "unlisted" means.
  if (created.visibility === 'public' && host) {
    await broadcastPost(created, `${proto}://${host}`)
  }

  return NextResponse.json({ post: toPublicPost(created) }, { status: 201 })
}

/**
 * Fan a new post out to the auto-publish channels. Deliberately swallows every
 * failure: the author's post is already saved, and a dead Slack webhook must not
 * turn a successful publish into an error on their screen. Failures are recorded
 * against the channel, where an operator will see them.
 */
async function broadcastPost(post: Post, origin: string): Promise<void> {
  try {
    const channels = await repo.socialChannels.list()
    const targets = channelsForAutoPublish(channels, post.kind)
    if (targets.length === 0) return
    const outcomes = await broadcast(targets, {
      title: post.title,
      body: post.body,
      url: postPermalink(origin, post.id),
      kind: post.kind,
      author: post.authorName,
      publishedAt: post.createdAt.toISOString(),
    })
    await Promise.all(
      outcomes.map((o) =>
        repo.socialChannels.recordDelivery(o.channelId, o.result.ok, o.result.error ?? null),
      ),
    )
  } catch {
    /* never let broadcasting break publishing */
  }
}
