/**
 * News & Signals sources — passive, keyless, primary-leaning. We do NOT
 * republish articles; we surface the top signals with attribution and link to
 * the origin. Two complementary sources give redundancy ("non-stop"):
 *
 *  - GDELT DOC 2.0 : global coverage for a *topic*. Article volume across outlets
 *    is a real proxy for how widely a story is "traded"; each item links to the
 *    original outlet (the origin).
 *  - Wikipedia "In the news" : the neutral, NPOV, sourced set of *top world
 *    events right now* (used when no topic is given).
 *
 * They are complementary by input shape: GDELT needs a topic; Wikipedia serves
 * the topic-less "top events" case. Each is graded honestly (news is rarely
 * "confirmed" from one outlet).
 */
import type { Evidence, Source } from '../types'

// ── GDELT DOC 2.0 (capability: news — topic coverage) ────────────────────────
interface GdeltArticle {
  url?: string
  title?: string
  seendate?: string
  domain?: string
  language?: string
  sourcecountry?: string
}
interface GdeltResponse {
  articles?: GdeltArticle[]
}

/** GDELT stamps look like "20260731T120000Z"; normalize to ISO. */
function gdeltDate(s?: string): string {
  const m = s ? /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s) : null
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : new Date().toISOString()
}

export const gdeltNews: Source = {
  key: 'gdelt',
  capability: 'news',
  passive: true,
  hosts: ['api.gdeltproject.org'],
  minIntervalMs: 1500,
  async run(input, ctx) {
    const topic = input.value.trim()
    if (topic.length < 2) return [] // topic-less "top news" is served by Wikipedia
    const url =
      `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(topic)}` +
      `&mode=artlist&format=json&maxrecords=25&timespan=48h&sort=hybridrel`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as GdeltResponse | null
    const articles = j?.articles ?? []
    return articles
      .filter((a) => a.title && a.url)
      .slice(0, 15)
      .map<Evidence>((a) => ({
        claim: a.title!.trim(),
        entity: a.domain ? { type: 'other', value: a.domain } : undefined,
        sourceKey: 'gdelt',
        sourceUrl: a.url,
        retrievedAt: gdeltDate(a.seendate),
        // Aggregated media: reports, not confirmation. Corroboration raises this.
        admiralty: { source: 'C', info: 3 },
        confidence: 'possible',
        data: { domain: a.domain, country: a.sourcecountry, language: a.language },
      }))
  },
}

// ── Wikipedia "In the news" (capability: news — top world events) ────────────
interface WikiLink {
  normalizedtitle?: string
  content_urls?: { desktop?: { page?: string } }
}
interface WikiNewsItem {
  story?: string
  links?: WikiLink[]
}
interface WikiFeatured {
  news?: WikiNewsItem[]
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const WIKI_HEADERS = {
  'User-Agent': 'Lambda NX OSINT (research; contact via app)',
  Accept: 'application/json',
}

export const wikiInTheNews: Source = {
  key: 'wikipedia_itn',
  capability: 'news',
  passive: true,
  hosts: ['en.wikipedia.org'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    if (input.value.trim().length > 0) return [] // topic queries go to GDELT
    const now = new Date()
    const yyyy = now.getUTCFullYear()
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(now.getUTCDate()).padStart(2, '0')
    const url = `https://en.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}`
    const res = await ctx.fetch(url, { headers: WIKI_HEADERS })
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as WikiFeatured | null
    const items = j?.news ?? []
    return items
      .slice(0, 12)
      .map<Evidence>((it) => {
        const text = stripHtml(it.story ?? '')
        const link = it.links?.find((l) => l.content_urls?.desktop?.page)
        return {
          claim: text,
          sourceKey: 'wikipedia_itn',
          sourceUrl: link?.content_urls?.desktop?.page,
          retrievedAt: now.toISOString(),
          // Curated, NPOV, sourced — stronger than a single outlet, still secondary.
          admiralty: { source: 'B', info: 2 },
          confidence: 'probable',
          data: { kind: 'in-the-news' },
        }
      })
      .filter((e) => e.claim.length > 0)
  },
}
