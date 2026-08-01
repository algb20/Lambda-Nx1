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
