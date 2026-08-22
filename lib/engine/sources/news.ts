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

/**
 * GDELT stamps look like "20260731T120000Z"; normalize to ISO.
 *
 * Returns null rather than "now" when the stamp is missing or malformed. The
 * old fallback made every undated article look like it had just been published,
 * which is exactly backwards: an article GDELT could not date is one we know
 * *less* about, not one that is fresher.
 */
function gdeltDate(s?: string): string | null {
  const m = s ? /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s) : null
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null
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
    const retrievedAt = new Date().toISOString()
    return articles
      .filter((a) => a.title && a.url)
      .slice(0, 15)
      .map<Evidence>((a) => ({
        claim: a.title!.trim(),
        entity: a.domain ? { type: 'other', value: a.domain } : undefined,
        sourceKey: 'gdelt',
        sourceUrl: a.url,
        retrievedAt,
        publishedAt: gdeltDate(a.seendate),
        // Aggregated media: reports, not confirmation. Corroboration raises this.
        admiralty: { source: 'C', info: 3 },
        confidence: 'possible',
        data: { domain: a.domain, country: a.sourcecountry, language: a.language },
      }))
  },
}

// ── USGS earthquakes (capability: news — real-time geolocated world events) ──
// Authoritative primary sensor data (not a claim): significant quakes in the
// past week, with exact epicentre coordinates so they plot precisely on the
// globe. Keyless GeoJSON feed. Served on the topic-less "top events" path.
interface UsgsFeature {
  properties?: { mag?: number; place?: string; time?: number; url?: string; title?: string; tsunami?: number }
  geometry?: { coordinates?: number[] } // [lon, lat, depth]
}
interface UsgsResponse {
  features?: UsgsFeature[]
}

export const usgsQuakes: Source = {
  key: 'usgs_quakes',
  capability: 'news',
  passive: true,
  hosts: ['earthquake.usgs.gov'],
  minIntervalMs: 2000,
  async run(input, ctx) {
    if (input.value.trim().length > 0) return [] // topic queries go to GDELT
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson'
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as UsgsResponse | null
    const features = j?.features ?? []
    const retrievedAt = new Date().toISOString()
    return features
      .filter((f) => f.properties?.title && Array.isArray(f.geometry?.coordinates))
      .slice(0, 12)
      .map<Evidence>((f) => {
        const p = f.properties!
        const [lon, lat] = f.geometry!.coordinates as number[]
        return {
          claim: (p.title ?? `M ${p.mag} — ${p.place}`).trim() + (p.tsunami ? ' · tsunami alert' : ''),
          entity: p.place ? { type: 'other', value: p.place } : undefined,
          sourceKey: 'usgs_quakes',
          sourceUrl: p.url,
          retrievedAt,
          // The instrument's own origin time — the moment the ground moved.
          publishedAt: typeof p.time === 'number' ? new Date(p.time).toISOString() : null,
          // Instrument-measured by an authoritative agency — reliable, confirmed.
          admiralty: { source: 'A', info: 1 },
          confidence: 'confirmed',
          data: { lat, lon, magnitude: p.mag, place: p.place, kind: 'earthquake' },
        }
      })
  },
}

// ── ReliefWeb / UN OCHA (capability: news — humanitarian world events) ───────
// Keyless official feed of humanitarian situation reports from UN agencies, NGOs
// and governments. Complements GDELT/Wikipedia/USGS: crises and disasters from
// primary responders, each country-tagged (so it plots on the globe) and linked
// to the origin report. Serves both a topic query and the topic-less "latest".
interface ReliefWebItem {
  fields?: {
    title?: string
    url?: string
    date?: { created?: string }
    primary_country?: { name?: string }
  }
}
interface ReliefWebResponse {
  data?: ReliefWebItem[]
}

export const reliefWeb: Source = {
  key: 'reliefweb',
  capability: 'news',
  passive: true,
  hosts: ['api.reliefweb.int'],
  minIntervalMs: 1500,
  async run(input, ctx) {
    const topic = input.value.trim()
    const params = new URLSearchParams({ appname: 'lambda-nx', limit: '10' })
    params.append('sort[]', 'date:desc')
    for (const f of ['title', 'url', 'date', 'primary_country']) params.append('fields[include][]', f)
    if (topic.length >= 2) params.append('query[value]', topic)
    const url = `https://api.reliefweb.int/v1/reports?${params.toString()}`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as ReliefWebResponse | null
    const items = j?.data ?? []
    const retrievedAt = new Date().toISOString()
    return items
      .filter((it) => it.fields?.title && it.fields?.url)
      .slice(0, 10)
      .map<Evidence>((it) => {
        const f = it.fields!
        const country = f.primary_country?.name
        return {
          claim: f.title!.trim(),
          entity: country ? { type: 'other', value: country } : undefined,
          sourceKey: 'reliefweb',
          sourceUrl: f.url,
          retrievedAt,
          publishedAt: f.date?.created ?? null,
          // Official responders, curated — stronger than a single outlet, secondary.
          admiralty: { source: 'B', info: 2 },
          confidence: 'probable',
          data: { country, kind: 'humanitarian' },
        }
      })
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
          // "In the news" is a rolling section with no per-item timestamp. Saying
          // so is more useful than stamping it with the moment we happened to
          // look, which would make a week-old entry read as breaking.
          publishedAt: null,
          // Curated, NPOV, sourced — stronger than a single outlet, still secondary.
          admiralty: { source: 'B', info: 2 },
          confidence: 'probable',
          data: { kind: 'in-the-news' },
        }
      })
      .filter((e) => e.claim.length > 0)
  },
}
