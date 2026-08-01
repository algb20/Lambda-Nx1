/**
 * Research & tech-trend sources — passive, keyless open scholarship.
 *  - OpenAlex: works (papers) matching a query, with citations.
 *  - Crossref: registered scholarly records, with citation counts.
 * Both are public JSON APIs; we send a polite `mailto` per their usage policy.
 *
 * Papers are *claims*, not settled fact — graded accordingly.
 */
import type { Evidence, Source } from '../types'

const MAILTO = 'mailto=research@lambda-nx.app'

// ── OpenAlex (capability: research) ──────────────────────────────────────────
interface OpenAlexWork {
  id?: string
  doi?: string
  title?: string
  display_name?: string
  publication_year?: number
  cited_by_count?: number
  authorships?: Array<{ author?: { display_name?: string } }>
}
interface OpenAlexResponse {
  results?: OpenAlexWork[]
}

function paperClaim(title: string, year: number | null, authors: string, citations: number | null): string {
  return (
    `Paper: ${title}` +
    (year ? ` (${year})` : '') +
    (authors ? ` — ${authors}` : '') +
    (citations !== null ? ` · ${citations} citations` : '')
  )
}

export const openalex: Source = {
  key: 'openalex',
  capability: 'research',
  passive: true,
  hosts: ['api.openalex.org'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 2) return []
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=5&${MAILTO}`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as OpenAlexResponse | null
    const works = j?.results ?? []
    return works.slice(0, 5).map<Evidence>((w) => {
      const title = w.title ?? w.display_name ?? q
      const authors = (w.authorships ?? [])
        .slice(0, 3)
        .map((a) => a.author?.display_name)
        .filter(Boolean)
        .join(', ')
      const citations = typeof w.cited_by_count === 'number' ? w.cited_by_count : null
      return {
        claim: paperClaim(title, w.publication_year ?? null, authors, citations),
        entity: { type: 'other', value: title },
        sourceKey: 'openalex',
        sourceUrl: w.doi ?? w.id,
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: { year: w.publication_year, citations, doi: w.doi },
      }
    })
  },
}

// ── Crossref (capability: research) ──────────────────────────────────────────
interface CrossrefItem {
  title?: string[]
  author?: Array<{ given?: string; family?: string }>
  published?: { 'date-parts'?: number[][] }
  created?: { 'date-parts'?: number[][] }
  DOI?: string
  URL?: string
  'is-referenced-by-count'?: number
}
interface CrossrefResponse {
  message?: { items?: CrossrefItem[] }
}

// ── GitHub (capability: research — tech-trend signal) ────────────────────────
interface GithubRepo {
  full_name?: string
  description?: string | null
  stargazers_count?: number
  html_url?: string
  language?: string | null
}
interface GithubSearchResponse {
  items?: GithubRepo[]
}

const GITHUB_HEADERS = {
  'User-Agent': 'Lambda-NX-OSINT',
  Accept: 'application/vnd.github+json',
}

export const githubTrend: Source = {
  key: 'github',
  capability: 'research',
  passive: true,
  hosts: ['api.github.com'],
  minIntervalMs: 2000, // unauthenticated search is rate-limited
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 2) return []
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=5`
    const res = await ctx.fetch(url, { headers: GITHUB_HEADERS })
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as GithubSearchResponse | null
    const items = j?.items ?? []
    return items
      .filter((r) => r.full_name)
      .slice(0, 5)
      .map<Evidence>((r) => {
        const stars = typeof r.stargazers_count === 'number' ? r.stargazers_count : 0
        return {
          claim:
            `Tool: ${r.full_name}` +
            (r.description ? ` — ${r.description.slice(0, 140)}` : '') +
            ` · ${stars.toLocaleString('en-US')}★` +
            (r.language ? ` [${r.language}]` : ''),
          entity: { type: 'other', value: r.full_name! },
          sourceKey: 'github',
          sourceUrl: r.html_url,
          retrievedAt: new Date().toISOString(),
          admiralty: { source: 'C', info: 3 },
          confidence: 'possible',
          data: { stars, language: r.language },
        }
      })
  },
}

// ── arXiv (capability: research — preprint frontier) ─────────────────────────
// arXiv's public API is keyless and returns Atom XML (not JSON). We extract the
// fields we need with a small, dependency-free reader over arXiv's stable format.
// Preprints are the leading edge of a field — and were explicitly on our source
// wishlist — but they are un-peer-reviewed claims, so we grade them cautiously.

/** Decode the handful of XML entities arXiv emits in text fields. */
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** First inner text of `<tag>…</tag>` within a fragment, whitespace-collapsed. */
function tagText(fragment: string, tag: string): string | null {
  const m = fragment.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  return m ? decodeXml(m[1].replace(/\s+/g, ' ').trim()) : null
}

/** All `<entry>…</entry>` blocks in an arXiv Atom feed. */
function atomEntries(xml: string): string[] {
  return xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []
}

export const arxiv: Source = {
  key: 'arxiv',
  capability: 'research',
  passive: true,
  hosts: ['export.arxiv.org'],
  minIntervalMs: 3000, // arXiv asks callers to be gentle (~1 req / 3s)
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 2) return []
    const url =
      `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}` +
      `&start=0&max_results=5&sortBy=relevance`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const xml = await res.text().catch(() => '')
    if (!xml) return []
    return atomEntries(xml)
      .slice(0, 5)
      .map<Evidence | null>((entry) => {
        const title = tagText(entry, 'title')
        if (!title) return null
        const absUrl = tagText(entry, 'id') // arXiv <id> is the abstract URL
        const published = tagText(entry, 'published')
        const year = published ? Number(published.slice(0, 4)) || null : null
        const authors = (entry.match(/<author>[\s\S]*?<\/author>/g) ?? [])
          .map((a) => tagText(a, 'name'))
          .filter((n): n is string => Boolean(n))
          .slice(0, 3)
          .join(', ')
        return {
          claim: paperClaim(`${title} [preprint]`, year, authors, null),
          entity: { type: 'other', value: title },
          sourceKey: 'arxiv',
          sourceUrl: absUrl ?? undefined,
          retrievedAt: new Date().toISOString(),
          // Reputable venue, but un-peer-reviewed → cautious grade.
          admiralty: { source: 'C', info: 3 },
          confidence: 'possible',
          data: { year, preprint: true },
        }
      })
      .filter((e): e is Evidence => e !== null)
  },
}

export const crossref: Source = {
  key: 'crossref',
  capability: 'research',
  passive: true,
  hosts: ['api.crossref.org'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 2) return []
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=5&${MAILTO}`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as CrossrefResponse | null
    const items = j?.message?.items ?? []
    return items
      .filter((it) => it.title?.[0])
      .slice(0, 5)
      .map<Evidence>((it) => {
        const title = it.title![0]
        const year = it.published?.['date-parts']?.[0]?.[0] ?? it.created?.['date-parts']?.[0]?.[0] ?? null
        const authors = (it.author ?? [])
          .slice(0, 3)
          .map((a) => `${a.given ?? ''} ${a.family ?? ''}`.trim())
          .filter(Boolean)
          .join(', ')
        const citations = typeof it['is-referenced-by-count'] === 'number' ? it['is-referenced-by-count'] : null
        return {
          claim: paperClaim(title, year, authors, citations),
          entity: { type: 'other', value: title },
          sourceKey: 'crossref',
          sourceUrl: it.URL ?? (it.DOI ? `https://doi.org/${it.DOI}` : undefined),
          retrievedAt: new Date().toISOString(),
          admiralty: { source: 'B', info: 2 },
          confidence: 'probable',
          data: { year, citations, doi: it.DOI },
        }
      })
  },
}
