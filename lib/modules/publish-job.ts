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
