/**
 * Daily global trending — what the world actually looked up today.
 *
 * This is a *real* signal, not a fabricated ranking: Wikipedia publishes the
 * most-read articles with true view counts, which is one of the few open,
 * global, per-day proxies for "what people searched for" that exists without a
 * key. We surface it with attribution and link every item back to its page.
 *
 * Two independent endpoints give redundancy (charter §6 — the gateway must not
 * go dark if one is down):
 *
 *  - Wikipedia "featured / mostread" (en.wikipedia.org) — today's most-read set,
 *    curated per day, with real view counts and short descriptions.
 *  - Wikimedia pageviews REST (wikimedia.org) — the raw top-viewed ranking for a
 *    completed day; an independent corroboration and a backfill when the
 *    featured feed for "today" is not yet populated.
 *
 * Both carry the view count in `data.views` so our own scoring (lib/modules/
 * trending.ts) can merge and rank them — corroboration across the two raises a
 * topic's weight. Passive, read-only, no key.
 */
import type { Evidence, Source, SourceContext } from '../types'

const WIKI_HEADERS = {
  Accept: 'application/json',
}

/** Wikipedia pages that are navigation/artefacts, not real trending subjects. */
const NON_SUBJECT =
  /^(Main[_ ]Page|-)$|^(Special|Wikipedia|Portal|Help|Category|Template|File|Talk|Draft):/i

function isSubject(title: string | undefined): title is string {
  return Boolean(title && !NON_SUBJECT.test(title.trim()))
}

/** UTC Y/M/D parts for a date, defaulting to now. */
function ymd(d: Date = new Date()): { y: string; m: string; d: string } {
  return {
    y: String(d.getUTCFullYear()),
    m: String(d.getUTCMonth() + 1).padStart(2, '0'),
    d: String(d.getUTCDate()).padStart(2, '0'),
  }
}

// ── Wikipedia featured / mostread (primary) ──────────────────────────────────
interface WikiMostReadArticle {
  views?: number
  rank?: number
  normalizedtitle?: string
  titles?: { normalized?: string; canonical?: string }
  description?: string
  content_urls?: { desktop?: { page?: string } }
}
interface WikiFeatured {
  mostread?: { date?: string; articles?: WikiMostReadArticle[] }
}

export const wikipediaTrending: Source = {
  key: 'wikipedia_trending',
  capability: 'trending',
  passive: true,
  hosts: ['en.wikipedia.org'],
  minIntervalMs: 1000,
  async run(_input, ctx) {
    const { y, m, d } = ymd()
    const url = `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`
    const res = await ctx.fetch(url, { headers: WIKI_HEADERS })
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as WikiFeatured | null
    const articles = j?.mostread?.articles ?? []
    const date = j?.mostread?.date ?? `${y}-${m}-${d}`
    return articles
      .map((a) => ({ ...a, title: a.normalizedtitle ?? a.titles?.normalized }))
      .filter((a) => isSubject(a.title) && typeof a.views === 'number')
      .slice(0, 20)
      .map<Evidence>((a) => ({
        claim: a.title!.trim(),
        entity: { type: 'other', value: a.title!.trim() },
        sourceKey: 'wikipedia_trending',
        sourceUrl: a.content_urls?.desktop?.page,
        retrievedAt: new Date().toISOString(),
        // A real, measured view count from an authoritative host — reliable data,
        // though "most-read" is an interest signal, not a verified claim.
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: {
          kind: 'trending',
          views: a.views,
          rank: a.rank,
          description: a.description ?? null,
          date,
        },
      }))
  },
}

// ── Wikimedia pageviews REST (independent corroboration / backfill) ──────────
interface PageviewsArticle {
  article?: string
  views?: number
  rank?: number
}
interface PageviewsResponse {
  items?: Array<{ articles?: PageviewsArticle[] }>
}

/** Title case from a wiki underscore slug, for display + cross-source matching. */
function unslug(article: string): string {
  return article.replace(/_/g, ' ').trim()
}

export const wikimediaPageviews: Source = {
  key: 'wikimedia_pageviews',
  capability: 'trending',
  passive: true,
  hosts: ['wikimedia.org'],
  minIntervalMs: 1000,
  async run(_input: unknown, ctx: SourceContext) {
    // The pageviews API publishes *completed* days; "yesterday" is the freshest.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const { y, m, d } = ymd(yesterday)
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${d}`
    const res = await ctx.fetch(url, { headers: WIKI_HEADERS })
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as PageviewsResponse | null
    const articles = j?.items?.[0]?.articles ?? []
    return articles
      .map((a) => ({ ...a, title: a.article ? unslug(a.article) : undefined }))
      .filter((a) => isSubject(a.title) && typeof a.views === 'number')
      .slice(0, 25)
      .map<Evidence>((a) => ({
        claim: a.title!,
        entity: { type: 'other', value: a.title! },
        sourceKey: 'wikimedia_pageviews',
        sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(a.article!)}`,
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: { kind: 'trending', views: a.views, rank: a.rank, date: `${y}-${m}-${d}` },
      }))
  },
}

export const trendingSources: Source[] = [wikipediaTrending, wikimediaPageviews]
