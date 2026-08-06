/**
 * The curated ⭐ watchlist — which standing feeds the internal Radar reads, and
 * *why* each one earns its place (docs/TECH_RADAR.md, "Source library").
 *
 * This is the automation of the weekly review's step 1 ("scan the ⭐ feeds"):
 * instead of a human opening tabs, the Radar reads these on a schedule and files
 * deduped, graded findings into the knowledge base.
 *
 * It is a list, not a wishlist: every entry here is backed by a registered watch
 * source (`lib/engine/sources/watch.ts`), and a test asserts that correspondence
 * so the two can never drift apart. Feeds we want but cannot lawfully or
 * reliably automate yet are documented in docs/RADAR.md, not stubbed here.
 */
import { WATCH_FEEDS, type WatchFeedKey } from '../engine/sources/watch'

/** The three ⭐ groups the Technology Radar prioritized, in reading order. */
export type WatchGroup = 'security' | 'ai_research' | 'papers'

export interface WatchFeed {
  /** Feed key handed to the `watch` capability; owned by the source that serves it. */
  key: WatchFeedKey
  label: string
  group: WatchGroup
  /** Why this feed is on the ⭐ list — the rationale is part of the record. */
  why: string
}

export const WATCHLIST: WatchFeed[] = [
  {
    key: WATCH_FEEDS.cisaKev,
    label: 'CISA Known Exploited Vulnerabilities',
    group: 'security',
    why: 'Vulnerabilities confirmed exploited in the wild — the highest-signal security feed we can read, and directly relevant to the CTI gateway.',
  },
  {
    key: WATCH_FEEDS.cisaAdvisories,
    label: 'CISA cybersecurity advisories',
    group: 'security',
    why: 'Authoritative advisory stream (ICS, joint alerts, analysis reports) — early warning before a technique becomes common.',
  },
  {
    key: WATCH_FEEDS.hfDailyPapers,
    label: 'Hugging Face daily papers',
    group: 'ai_research',
    why: 'Curated daily AI selection with community attention weighting — the fastest read on what the AI field is reacting to.',
  },
  {
    key: WATCH_FEEDS.arxivSecurity,
    label: 'arXiv cs.CR (cryptography & security)',
    group: 'papers',
    why: 'The security research frontier; feeds both the engine and the CTI gateway.',
  },
  {
    key: WATCH_FEEDS.arxivAi,
    label: 'arXiv cs.AI (artificial intelligence)',
    group: 'papers',
    why: 'Method-level AI research that could strengthen the analyst layer.',
  },
  {
    key: WATCH_FEEDS.arxivLearning,
    label: 'arXiv cs.LG (machine learning)',
    group: 'papers',
    why: 'Where analysis/ranking techniques we might adopt are published first.',
  },
  {
    key: WATCH_FEEDS.arxivDistributed,
    label: 'arXiv cs.DC (distributed computing)',
    group: 'papers',
    why: 'Systems research behind the engine: scheduling, caching, distributed collection.',
  },
]

export const WATCH_GROUPS: WatchGroup[] = ['security', 'ai_research', 'papers']

export const WATCH_GROUP_LABELS: Record<WatchGroup, string> = {
  security: 'Security',
  ai_research: 'AI research',
  papers: 'Papers & venues',
}

export function feedsInGroup(group: WatchGroup, feeds: WatchFeed[] = WATCHLIST): WatchFeed[] {
  return feeds.filter((f) => f.group === group)
}

export function findFeed(key: string, feeds: WatchFeed[] = WATCHLIST): WatchFeed | undefined {
  return feeds.find((f) => f.key === key)
}
