import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getSessionUserId } from '@/lib/auth/server'
import { repo, isDbConfigured, describeDatabaseError, type Post } from '@/lib/db'
import { validatePostInput, postPermalink } from '@/lib/posts'
import { toPublicPost } from '@/lib/post-mapper'
import { broadcast, channelsForAutoPublish } from '@/lib/social/broadcast'
import { publicNameFor } from '@/lib/users/public-name'
import { considerPublishing } from '@/lib/modules/self-drive'
import { runPublishJob } from '@/lib/modules/publish-job'

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

  /**
   * A feed that cannot be read is an empty feed, not a crashed page.
   *
   * This threw a bare 500 when the database was unreachable, and the home page
   * — which fetches it on load — showed nothing and said nothing. The rest of
   * the product does not need the database at all: the gateways, the board, the
   * globe are all live public sources. Taking the whole front page down over
   * the one component that does need it is the wrong trade.
   *
   * `degraded` is in the body so the surface can say *why* it is empty. An
   * empty list with no explanation is the failure mode this project exists to
   * avoid — it looks exactly like "nothing has been published".
   */
  let rows: Post[]
  try {
    rows = await repo.posts.listPublic(limit, before && !isNaN(before.getTime()) ? before : undefined)
  } catch (err) {
    console.error(`[api/posts] feed unavailable — ${describeDatabaseError(err)}`)
    return NextResponse.json(
      {
        posts: [],
        degraded: true,
        detail: 'The feed is temporarily unavailable — this deployment cannot reach its database.',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // One lookup for every author on the page rather than one per post.
  // Never fatal: a feed with no avatars is a feed; a feed that 500s is not.
  const avatars = await repo.users
    .avatarsByIds(rows.map((r) => r.authorUserId).filter((id): id is string => Boolean(id)))
    .catch(() => new Map<string, string | null>())
  /**
   * Keep the feed current without depending on a scheduler.
   *
   * Publishing used to run once a day on one host and every six hours on the
   * other, and only when an operator had configured a cron secret the right
   * way. When any of that was missing the front page simply stayed empty and
   * said nothing. Reading the feed now starts a publish run when the newest
   * automatic post has gone stale — bounded, single-flight, and never awaited,
   * so this reader gets the feed exactly as fast as before and the next reader
   * gets a newer one. Where a scheduler *is* configured it fires first and this
   * never triggers, because the posts are already fresh.
   */
  const newestAuto = rows.find((row) => row.authorUserId === null)?.createdAt ?? null
  considerPublishing({
    newestAt: newestAuto,
    run: () => runPublishJob({ origin: new URL(request.url).origin }),
  })

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
    authorName: publicNameFor(user),
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
