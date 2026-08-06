/**
 * Watch sources (capability: `watch`) — the standing feeds the internal Radar
 * reads on a schedule to keep us ahead (charter §2 rule 2, docs/TECH_RADAR.md).
 *
 * These differ from every other source in *input shape*: the rest of the engine
 * answers "what do you know about this subject?", while a watch source answers
 * "what is new on this feed?". So `input.value` is a **feed key** from the
 * curated watchlist (`lib/radar/watchlist.ts`), not a subject. Each source
 * serves only the feed keys it owns and returns `[]` for anything else, so the
 * orchestrator's normal first-match fallback routes a key to its owner.
 *
 * All of them are public, keyless and read-only, and every host is declared for
 * the guardrail allowlist — the passive guarantee is unchanged: we read
 * publishers, we never touch a target.
 */
import type { Evidence, Source } from '../types'
import { parseFeed, truncate } from '../feedxml'

/** Feed keys, one per curated ⭐ feed. Owned here so sources and the watchlist agree. */
export const WATCH_FEEDS = {
  cisaKev: 'security.cisa-kev',
  cisaAdvisories: 'security.cisa-advisories',
  hfDailyPapers: 'ai.hf-daily-papers',
  arxivAi: 'papers.arxiv.cs.AI',
  arxivSecurity: 'papers.arxiv.cs.CR',
  arxivDistributed: 'papers.arxiv.cs.DC',
  arxivLearning: 'papers.arxiv.cs.LG',
} as const

export type WatchFeedKey = (typeof WATCH_FEEDS)[keyof typeof WATCH_FEEDS]

/** How many items we take from one feed per sweep (de-dup makes re-reads cheap). */
const PER_FEED_LIMIT = 25

/**
 * A standing feed must not fail quietly. Elsewhere in the engine a source that
 * gets an error status returns no evidence and a sibling source answers instead;
 * a watch feed has no sibling, and "the publisher returned an error" is a
 * different fact from "the publisher had nothing new" — only the first is a
 * problem an operator should see. So we throw, and the orchestrator records it
 * as a source failure that the sweep reports (`lib/radar/watch.ts`).
 */
function assertReadable(res: Response, feed: string): void {
  if (!res.ok) throw new Error(`${feed} unavailable: provider returned HTTP ${res.status}`)
}

// ── CISA Known Exploited Vulnerabilities (capability: watch — security ⭐) ────
// The authoritative US catalogue of vulnerabilities *confirmed exploited in the
// wild*. This is the single highest-signal security feed we can read: not "a CVE
// exists" but "this one is being used against real systems right now".
interface KevVulnerability {
  cveID?: string
  vendorProject?: string
  product?: string
  vulnerabilityName?: string
  shortDescription?: string
  dateAdded?: string
  dueDate?: string
  knownRansomwareCampaignUse?: string
  requiredAction?: string
}
interface KevCatalog {
  catalogVersion?: string
  dateReleased?: string
  vulnerabilities?: KevVulnerability[]
}

const KEV_CATALOG_URL = 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'

/** Newest first by `dateAdded`; entries without a usable date sort last. */
function byDateAddedDesc(a: KevVulnerability, b: KevVulnerability): number {
  const at = Date.parse(a.dateAdded ?? '')
  const bt = Date.parse(b.dateAdded ?? '')
  if (Number.isNaN(at) && Number.isNaN(bt)) return 0
  if (Number.isNaN(at)) return 1
  if (Number.isNaN(bt)) return -1
  return bt - at
}

export const cisaKev: Source = {
  key: 'cisa_kev',
  capability: 'watch',
  passive: true,
  hosts: ['www.cisa.gov'],
  minIntervalMs: 2000,
  async run(input, ctx) {
    if (input.value !== WATCH_FEEDS.cisaKev) return []
    const res = await ctx.fetch(
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    )
    assertReadable(res, 'CISA KEV catalogue')
    const j = (await res.json().catch(() => null)) as KevCatalog | null
    const vulns = j?.vulnerabilities ?? []
    return [...vulns]
      .sort(byDateAddedDesc)
      .slice(0, PER_FEED_LIMIT)
      .filter((v) => v.cveID)
      .map<Evidence>((v) => {
        const product = [v.vendorProject, v.product].filter(Boolean).join(' ')
        const ransomware = v.knownRansomwareCampaignUse?.toLowerCase() === 'known'
        return {
          claim:
            `Exploited in the wild: ${v.cveID}` +
            (product ? ` — ${product}` : '') +
            (v.vulnerabilityName ? ` · ${v.vulnerabilityName}` : '') +
            (ransomware ? ' · known ransomware use' : ''),
          entity: { type: 'other', value: v.cveID! },
          sourceKey: 'cisa_kev',
          sourceUrl: KEV_CATALOG_URL,
          retrievedAt: v.dateAdded ? new Date(v.dateAdded).toISOString() : new Date().toISOString(),
          // Authoritative government catalogue reporting an observed fact.
          admiralty: { source: 'A', info: 1 },
          confidence: 'confirmed',
          data: {
            cve: v.cveID,
            vendor: v.vendorProject,
            product: v.product,
            dateAdded: v.dateAdded,
            dueDate: v.dueDate,
            ransomware,
            summary: v.shortDescription ? truncate(v.shortDescription, 300) : undefined,
          },
        }
      })
  },
}

// ── CISA cybersecurity advisories (capability: watch — security ⭐) ───────────
// The advisory stream behind the catalogue: ICS advisories, joint alerts,
// analysis reports. Advisories are expert *assessments* of a situation, so they
// grade one step below the KEV catalogue's observed fact.
export const cisaAdvisories: Source = {
  key: 'cisa_advisories',
  capability: 'watch',
  passive: true,
  hosts: ['www.cisa.gov'],
  minIntervalMs: 2000,
  async run(input, ctx) {
    if (input.value !== WATCH_FEEDS.cisaAdvisories) return []
    const res = await ctx.fetch('https://www.cisa.gov/cybersecurity-advisories/all.xml')
    assertReadable(res, 'CISA advisories')
    const xml = await res.text().catch(() => '')
    if (!xml) return []
    return parseFeed(xml)
      .slice(0, PER_FEED_LIMIT)
      .map<Evidence>((e) => ({
        claim: `Advisory: ${e.title}`,
        entity: { type: 'other', value: e.title },
        sourceKey: 'cisa_advisories',
        sourceUrl: e.link,
        retrievedAt: e.published ?? new Date().toISOString(),
        admiralty: { source: 'A', info: 2 },
        confidence: 'probable',
        data: { summary: e.summary, published: e.published },
      }))
  },
}

// ── Hugging Face daily papers (capability: watch — AI research ⭐) ────────────
// A curated, community-upvoted daily selection of AI papers. It is a *signal of
// attention*, not a quality verdict, and it points at preprints — graded low and
// labelled as such, with the upvote count carried so the analyst can weigh it.
interface HfPaper {
  id?: string
  title?: string
  summary?: string
  upvotes?: number
  publishedAt?: string
}
interface HfDailyPaper {
  paper?: HfPaper
  title?: string
  publishedAt?: string
  numComments?: number
}

export const huggingfacePapers: Source = {
  key: 'hf_papers',
  capability: 'watch',
  passive: true,
  hosts: ['huggingface.co'],
  minIntervalMs: 2000,
  async run(input, ctx) {
    if (input.value !== WATCH_FEEDS.hfDailyPapers) return []
    const res = await ctx.fetch('https://huggingface.co/api/daily_papers')
    assertReadable(res, 'Hugging Face daily papers')
    const j = (await res.json().catch(() => null)) as HfDailyPaper[] | null
    if (!Array.isArray(j)) return []
    return j
      .slice(0, PER_FEED_LIMIT)
      .map<Evidence | null>((row) => {
        const title = (row.paper?.title ?? row.title)?.trim()
        if (!title) return null
        const upvotes = typeof row.paper?.upvotes === 'number' ? row.paper.upvotes : null
        const published = row.paper?.publishedAt ?? row.publishedAt
        return {
          claim:
            `AI paper: ${title} [preprint]` + (upvotes !== null ? ` · ${upvotes} upvotes` : ''),
          entity: { type: 'other', value: title },
          sourceKey: 'hf_papers',
          sourceUrl: row.paper?.id ? `https://huggingface.co/papers/${row.paper.id}` : undefined,
          retrievedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
          // Curated attention around un-peer-reviewed work.
          admiralty: { source: 'C', info: 3 },
          confidence: 'possible',
          data: {
            upvotes,
            comments: typeof row.numComments === 'number' ? row.numComments : null,
            arxivId: row.paper?.id,
            preprint: true,
            summary: row.paper?.summary ? truncate(row.paper.summary, 300) : undefined,
          },
        }
      })
      .filter((e): e is Evidence => e !== null)
  },
}

// ── arXiv category listings (capability: watch — papers ⭐) ───────────────────
// The submission frontier for the categories that matter to this platform.
// Unlike the query-driven arXiv research source, this watches whole categories
// newest-first, which is what a standing radar needs.

/** Categories we watch, keyed by feed. The map is the allowlist: no other value reaches the query. */
const ARXIV_CATEGORIES: Record<string, string> = {
  [WATCH_FEEDS.arxivAi]: 'cs.AI',
  [WATCH_FEEDS.arxivSecurity]: 'cs.CR',
  [WATCH_FEEDS.arxivDistributed]: 'cs.DC',
  [WATCH_FEEDS.arxivLearning]: 'cs.LG',
}

export const arxivWatch: Source = {
  key: 'arxiv_watch',
  capability: 'watch',
  passive: true,
  hosts: ['export.arxiv.org'],
  minIntervalMs: 3000, // arXiv asks callers to be gentle (~1 req / 3s)
  async run(input, ctx) {
    const category = ARXIV_CATEGORIES[input.value]
    if (!category) return []
    const url =
      `https://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(category)}` +
      `&start=0&max_results=${PER_FEED_LIMIT}&sortBy=submittedDate&sortOrder=descending`
    const res = await ctx.fetch(url)
    assertReadable(res, `arXiv ${category}`)
    const xml = await res.text().catch(() => '')
    if (!xml) return []
    return parseFeed(xml).map<Evidence>((e) => {
      const authors = e.authors.slice(0, 3).join(', ')
      return {
        claim:
          `Preprint [${category}]: ${e.title}` + (authors ? ` — ${authors}` : ''),
        entity: { type: 'other', value: e.title },
        sourceKey: 'arxiv_watch',
        sourceUrl: e.link ?? e.id,
        retrievedAt: e.published ?? new Date().toISOString(),
        // Reputable venue, but un-peer-reviewed → cautious grade.
        admiralty: { source: 'C', info: 3 },
        confidence: 'possible',
        data: { category, preprint: true, summary: e.summary, published: e.published },
      }
    })
  },
}

export const watchSources: Source[] = [cisaKev, cisaAdvisories, huggingfacePapers, arxivWatch]
