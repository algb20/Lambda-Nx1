import { NextResponse } from 'next/server'
import { repo, isDbConfigured } from '@/lib/db'
import { adminGate } from '@/lib/social/admin'
import { getWorldEvents } from '@/lib/modules/world-events'
import { investigateTrending } from '@/lib/modules/trending'
import {
  AUTO_REF_TYPE,
  PLATFORM_AUTHOR,
  eventToCandidate,
  radarToCandidate,
  runAutoPublish,
  trendingToCandidate,
  type PublishCandidate,
} from '@/lib/modules/autopublish'
import { broadcast, channelsForAutoPublish } from '@/lib/social/broadcast'
import { postPermalink } from '@/lib/posts'
import { headers } from 'next/headers'

/**
 * POST /api/publish/run — the scheduled job that puts the engine's own findings
 * on the front page.
 *
 * Guarded by ADMIN_SECRET, so a cron entry (Supabase pg_cron, Vercel Cron, or
 * anything that can send a header) can drive it and nobody else can. Safe to run
 * as often as you like: every candidate carries a stable identity and anything
 * already published is skipped.
 *
 * `?dry=1` returns what it *would* publish without writing anything, which is
 * how you check the thresholds before letting it loose on a real feed.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const denied = adminGate(request)
  if (denied) return denied
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dry') === '1'

  // Gather in parallel; a failing feed costs its own candidates, not the run.
  const [world, trending, radar] = await Promise.allSettled([
    getWorldEvents(),
    investigateTrending(),
    repo.radar.listRecent(undefined, 20),
  ])

  const candidates: Array<PublishCandidate | null> = []

  if (world.status === 'fulfilled') {
    for (const event of world.value.events.slice(0, 30)) {
      candidates.push(eventToCandidate(event))
    }
  }
  if (trending.status === 'fulfilled') {
    candidates.push(
      trendingToCandidate(
        trending.value.spotlight.map((s) => ({
          title: s.title,
          url: s.url,
          views: s.views,
          corroborated: s.corroborated,
          rank: s.rank,
        })),
      ),
    )
  }
  if (radar.status === 'fulfilled') {
    candidates.push(
      radarToCandidate(
        radar.value.map((f) => {
          // The schema stores the Admiralty rating as "A/1"; split it back into
          // its two components so the digest can print a grade per item.
          const [source, info] = (f.admiralty ?? '').split('/')
          return {
            title: f.title,
            url: f.sourceUrl,
            sourceKey: f.feed ?? f.kind,
            admiralty:
              source && Number.isFinite(Number(info))
                ? { source, info: Number(info) }
                : null,
            summary: f.summary,
          }
        }),
      ),
    )
  }

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const origin = host ? `${proto}://${host}` : ''

  const result = await runAutoPublish(candidates, {
    alreadyPublished: (refValue) => repo.posts.existsByRef(AUTO_REF_TYPE, refValue),
    publish: async (candidate) => {
      if (dryRun) return
      const post = await repo.posts.create({
        // No author row: the platform published this, not a person.
        authorUserId: null,
        authorName: PLATFORM_AUTHOR,
        kind: candidate.kind,
        title: candidate.title,
        body: candidate.body,
        sourceUrl: candidate.sourceUrl,
        refType: AUTO_REF_TYPE,
        refValue: candidate.refValue,
        locale: candidate.locale,
        visibility: 'public',
      })

      // An automatic post is a post: it goes out to the social channels that
      // asked for this kind, through exactly the same path as a human's.
      if (origin) {
        try {
          const channels = channelsForAutoPublish(await repo.socialChannels.list(), post.kind)
          if (channels.length > 0) {
            const outcomes = await broadcast(channels, {
              title: post.title,
              body: post.body,
              url: postPermalink(origin, post.id),
              kind: post.kind,
              author: PLATFORM_AUTHOR,
              publishedAt: post.createdAt.toISOString(),
            })
            await Promise.all(
              outcomes.map((o) =>
                repo.socialChannels.recordDelivery(o.channelId, o.result.ok, o.result.error ?? null),
              ),
            )
          }
        } catch {
          /* broadcasting must never undo a successful publish */
        }
      }
    },
  })

  return NextResponse.json({
    dryRun,
    considered: result.considered,
    publishedCount: result.published.length,
    skippedAsDuplicate: result.skippedAsDuplicate,
    skippedBelowBar: result.skippedBelowBar,
    published: result.published.map((c) => ({
      kind: c.kind,
      title: c.title,
      refValue: c.refValue,
      sourceUrl: c.sourceUrl,
    })),
    feeds: {
      world: world.status,
      trending: trending.status,
      radar: radar.status,
    },
  })
}
