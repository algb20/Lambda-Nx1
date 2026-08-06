import { describe, it, expect } from 'vitest'
import {
  WATCH_FEEDS,
  cisaKev,
  cisaAdvisories,
  huggingfacePapers,
  arxivWatch,
  watchSources,
} from './watch'
import type { Source, SourceContext } from '../types'

/** A context whose fetch returns a canned response and records the URL asked for. */
function ctxFor(body: string | object, init: { ok?: boolean } = {}) {
  const urls: string[] = []
  const ctx: SourceContext = {
    fetch: async (url: string) => {
      urls.push(url)
      const text = typeof body === 'string' ? body : JSON.stringify(body)
      return new Response(text, { status: init.ok === false ? 500 : 200 })
    },
  }
  return { ctx, urls }
}

function run(source: Source, feedKey: string, body: string | object, init?: { ok?: boolean }) {
  const { ctx, urls } = ctxFor(body, init ?? {})
  return source.run({ capability: 'watch', value: feedKey }, ctx).then((evidence) => ({ evidence, urls }))
}

const KEV = {
  catalogVersion: '2026.08.03',
  vulnerabilities: [
    {
      cveID: 'CVE-2026-0002',
      vendorProject: 'Vendor',
      product: 'Gateway',
      vulnerabilityName: 'Auth bypass',
      shortDescription: 'An authentication bypass in the admin console.',
      dateAdded: '2026-08-03',
      dueDate: '2026-08-24',
      knownRansomwareCampaignUse: 'Known',
    },
    {
      cveID: 'CVE-2026-0001',
      vendorProject: 'Other',
      product: 'Router',
      vulnerabilityName: 'RCE',
      dateAdded: '2026-07-01',
      knownRansomwareCampaignUse: 'Unknown',
    },
    { vendorProject: 'Nameless', dateAdded: '2026-08-04' }, // no CVE id → unusable
  ],
}

const CISA_RSS = `<rss version="2.0"><channel>
  <title>Advisories</title>
  <item>
    <title>ICS Advisory: Vendor X</title>
    <link>https://www.cisa.gov/advisories/icsa-26-001</link>
    <description>Summary of the advisory.</description>
    <pubDate>Mon, 03 Aug 2026 14:00:00 +0000</pubDate>
  </item>
</channel></rss>`

const ARXIV_ATOM = `<feed xmlns="http://www.w3.org/2005/Atom">
  <title>arXiv Query</title>
  <entry>
    <id>http://arxiv.org/abs/2608.00001v1</id>
    <published>2026-08-04T00:00:00Z</published>
    <title>Graded Evidence at Scale</title>
    <summary>We study corroboration.</summary>
    <link href="http://arxiv.org/abs/2608.00001v1" rel="alternate" type="text/html"/>
    <author><name>A. Researcher</name></author>
    <author><name>B. Researcher</name></author>
  </entry>
</feed>`

const HF = [
  {
    paper: {
      id: '2608.00002',
      title: 'A Better Analyst',
      summary: 'We propose an approach.',
      upvotes: 42,
      publishedAt: '2026-08-04T00:00:00.000Z',
    },
    numComments: 7,
  },
  { paper: { id: '2608.00003' } }, // no title → unusable
]

describe('watch sources — feed ownership', () => {
  it('every source ignores feed keys it does not own', async () => {
    for (const source of watchSources) {
      const { evidence } = await run(source, 'security.not-a-real-feed', {})
      expect(evidence).toEqual([])
    }
  })

  it('every watchlist feed key is served by exactly one source', async () => {
    for (const key of Object.values(WATCH_FEEDS)) {
      const owners: string[] = []
      for (const source of watchSources) {
        // A source that owns the key will call fetch; one that does not returns early.
        const { urls } = await run(source, key, '{}')
        if (urls.length > 0) owners.push(source.key)
      }
      expect(owners, `feed ${key}`).toHaveLength(1)
    }
  })

  it('every source reports an error status instead of swallowing it', async () => {
    for (const [source, key] of [
      [cisaKev, WATCH_FEEDS.cisaKev],
      [cisaAdvisories, WATCH_FEEDS.cisaAdvisories],
      [huggingfacePapers, WATCH_FEEDS.hfDailyPapers],
      [arxivWatch, WATCH_FEEDS.arxivSecurity],
    ] as const) {
      await expect(run(source, key, '{}', { ok: false }), source.key).rejects.toThrow(/HTTP 500/)
    }
  })

  it('declares every source passive with provider hosts', () => {
    for (const source of watchSources) {
      expect(source.passive).toBe(true)
      expect(source.hosts.length).toBeGreaterThan(0)
      expect(source.capability).toBe('watch')
    }
  })
})

describe('cisaKev', () => {
  it('grades exploited vulnerabilities as confirmed, newest first', async () => {
    const { evidence } = await run(cisaKev, WATCH_FEEDS.cisaKev, KEV)
    expect(evidence).toHaveLength(2) // the entry without a CVE id is dropped
    expect(evidence[0].claim).toBe(
      'Exploited in the wild: CVE-2026-0002 — Vendor Gateway · Auth bypass · known ransomware use',
    )
    expect(evidence[0].admiralty).toEqual({ source: 'A', info: 1 })
    expect(evidence[0].confidence).toBe('confirmed')
    expect(evidence[0].retrievedAt).toBe('2026-08-03T00:00:00.000Z')
    // Newest dateAdded leads; the older CVE follows.
    expect(evidence[1].claim).toContain('CVE-2026-0001')
    expect(evidence[1].claim).not.toContain('ransomware')
    expect((evidence[0].data as { ransomware: boolean }).ransomware).toBe(true)
  })

  it('fails loudly when the catalogue is unavailable', async () => {
    // A standing feed has no sibling source to fall back to, so an error status
    // must not be reported as "the publisher had nothing new".
    await expect(run(cisaKev, WATCH_FEEDS.cisaKev, KEV, { ok: false })).rejects.toThrow(
      /CISA KEV catalogue unavailable: provider returned HTTP 500/,
    )
  })
})

describe('cisaAdvisories', () => {
  it('reads the advisory feed and grades it below the KEV catalogue', async () => {
    const { evidence } = await run(cisaAdvisories, WATCH_FEEDS.cisaAdvisories, CISA_RSS)
    expect(evidence).toHaveLength(1)
    expect(evidence[0].claim).toBe('Advisory: ICS Advisory: Vendor X')
    expect(evidence[0].sourceUrl).toBe('https://www.cisa.gov/advisories/icsa-26-001')
    expect(evidence[0].retrievedAt).toBe('2026-08-03T14:00:00.000Z')
    expect(evidence[0].admiralty).toEqual({ source: 'A', info: 2 })
    expect(evidence[0].confidence).toBe('probable')
  })
})

describe('huggingfacePapers', () => {
  it('carries attention (upvotes) and marks the work as a preprint', async () => {
    const { evidence } = await run(huggingfacePapers, WATCH_FEEDS.hfDailyPapers, HF)
    expect(evidence).toHaveLength(1) // titleless row dropped
    expect(evidence[0].claim).toBe('AI paper: A Better Analyst [preprint] · 42 upvotes')
    expect(evidence[0].sourceUrl).toBe('https://huggingface.co/papers/2608.00002')
    expect(evidence[0].confidence).toBe('possible')
    expect((evidence[0].data as { comments: number }).comments).toBe(7)
  })

  it('tolerates an unexpected payload shape', async () => {
    const { evidence } = await run(huggingfacePapers, WATCH_FEEDS.hfDailyPapers, { error: 'nope' })
    expect(evidence).toEqual([])
  })
})

describe('arxivWatch', () => {
  it('queries the category newest-first and labels the category', async () => {
    const { evidence, urls } = await run(arxivWatch, WATCH_FEEDS.arxivSecurity, ARXIV_ATOM)
    expect(urls[0]).toContain('search_query=cat:cs.CR')
    expect(urls[0]).toContain('sortBy=submittedDate&sortOrder=descending')
    expect(evidence).toHaveLength(1)
    expect(evidence[0].claim).toBe(
      'Preprint [cs.CR]: Graded Evidence at Scale — A. Researcher, B. Researcher',
    )
    expect(evidence[0].sourceUrl).toBe('http://arxiv.org/abs/2608.00001v1')
    expect(evidence[0].retrievedAt).toBe('2026-08-04T00:00:00.000Z')
    expect(evidence[0].confidence).toBe('possible')
  })

  it('serves each watched category from the same source', async () => {
    for (const [key, expected] of [
      [WATCH_FEEDS.arxivAi, 'cs.AI'],
      [WATCH_FEEDS.arxivDistributed, 'cs.DC'],
      [WATCH_FEEDS.arxivLearning, 'cs.LG'],
    ] as const) {
      const { urls } = await run(arxivWatch, key, ARXIV_ATOM)
      expect(urls[0]).toContain(`cat:${expected}`)
    }
  })

  it('never puts an unrecognized feed key into the query', async () => {
    const { urls } = await run(arxivWatch, 'papers.arxiv.cs.EVIL', ARXIV_ATOM)
    expect(urls).toEqual([])
  })
})
