/**
 * The publishing job itself, separated from any one way of triggering it.
 *
 * It used to live inside the admin route, which meant the only way to publish
 * was for an operator to hold ADMIN_SECRET and send a request by hand — a
 * platform that publishes "automatically" only when a human remembers to ask.
 * The job belongs here so two callers can share one implementation:
 *
 *  - the scheduler (`GET /api/cron/publish`), which is how it actually runs;
 *  - the admin route (`POST /api/publish/run`), kept for a manual or dry run.
 *
 * Both produce the same result and the same guarantees: nothing is published
 * twice, nothing below the bar is published at all, and one failing feed costs
 * only its own candidates.
 */
import { repo, isDbConfigured } from '@/lib/db'
import { getWorldEvents } from './world-events'
import { rankEvents } from './world-events-shared'
import { diversify } from '../analysis/significance'
import { investigateTrending } from './trending'
import {
  AUTO_REF_TYPE,
  PLATFORM_AUTHOR,
  eventToCandidate,
  radarToCandidate,
  runAutoPublish,
  trendingToCandidate,
  type AutoPublishResult,
  type PublishCandidate,
} from './autopublish'
import { broadcast, channelsForAutoPublish } from '@/lib/social/broadcast'
import { postPermalink } from '@/lib/posts'
import { originOf } from '@/lib/engine/catalog'

export interface PublishJobOptions {
  /** Decide and report, but write nothing. How thresholds get checked safely. */
  dryRun?: boolean
  /** Origin used to build permalinks for the social broadcast. */
  origin?: string
}

export interface PublishJobResult extends AutoPublishResult {
  dryRun: boolean
  /** Which feeds answered this run — a run that published nothing is not the
   *  same event as a run whose sources were all down. */
  feeds: Record<'world' | 'trending' | 'radar', 'fulfilled' | 'rejected'>
}

/** Raised when the job cannot run at all, as opposed to running and publishing nothing. */
export class PublishJobUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublishJobUnavailableError'
  }
}

export async function runPublishJob(options: PublishJobOptions = {}): Promise<PublishJobResult> {
  const { dryRun = false, origin = '' } = options
  if (!isDbConfigured()) {
    throw new PublishJobUnavailableError('Database is not configured')
  }

  // Gather in parallel; a failing feed costs its own candidates, not the run.
  const [world, trending, radar] = await Promise.allSettled([
    getWorldEvents(),
    investigateTrending(),
    repo.radar.listRecent(undefined, 20),
  ])

  const candidates: Array<PublishCandidate | null> = []

  if (world.status === 'fulfilled') {
    /**
     * Ranked and capped, not the first thirty that happened to arrive.
     *
     * This was `events.slice(0, 30)` — arrival order, no ranking, no cap — and
     * the result was measured on the live front page: **six consecutive
     * auto-published posts, all of them NWS county weather warnings**. NWS
     * issues those continuously and each grades to the same severity, so an
     * unranked slice is simply whichever publisher is chattiest.
     *
     * This is the third surface where the same failure appeared. The board had
     * it (17 of the top 20 rows were one weather service), the MCP tool had it
     * (11 of the first 14), and the auto-publisher had it here — the worst of
     * the three, because these rows are *written to the database as posts* and
     * become the permanent public record of what the platform noticed.
     *
     * So it uses the same two functions the other two now use: `rankEvents` for
     * significance, `diversify` for the hard stop behind it.
     */
    const ranked = rankEvents(world.value.events)
    const board = diversify(
      ranked.map((r) => ({
        ...r,
        sourceKey: r.event.sourceKey,
        // The publisher, not just the feed — see Rankable.origin.
        origin: originOf(r.event.sourceKey),
        category: r.event.category as string,
        severity: r.event.severity,
      })),
      30,
    )
    /**
     * Only the rows that earned their place — never the backfill.
     *
     * `diversify` fills any remaining slots from the overflow once the caps are
     * met, which is right for a *screen*: the rows are visible, labelled, and a
     * reader can see they are there for completeness. It is wrong here. These
     * become posts in the database and the permanent public record of what the
     * platform noticed, and a backfill of twenty-nine county weather warnings
     * is exactly the record we must not leave. Better to publish six real
     * events than thirty of which twenty-nine are one publisher.
     */
    for (const row of board.taken.slice(0, board.diversified)) {
      candidates.push(eventToCandidate(row.event))
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
              source && Number.isFinite(Number(info)) ? { source, info: Number(info) } : null,
            summary: f.summary,
          }
        }),
      ),
    )
  }

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
      if (!origin) return
      try {
        const channels = channelsForAutoPublish(await repo.socialChannels.list(), post.kind)
        if (channels.length === 0) return
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
      } catch {
        /* broadcasting must never undo a successful publish */
      }
    },
  })

  return {
    ...result,
    dryRun,
    feeds: { world: world.status, trending: trending.status, radar: radar.status },
  }
}
