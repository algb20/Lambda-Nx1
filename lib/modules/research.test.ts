import { describe, it, expect, vi, afterEach } from 'vitest'
import { investigateResearch } from './research'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/xml' } })
}

const ARXIV_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/1706.03762v5</id>
    <published>2017-06-12T00:00:00Z</published>
    <title>Attention Is All You Need &amp; More</title>
    <summary>The dominant sequence transduction models...</summary>
    <author><name>Ashish Vaswani</name></author>
    <author><name>Noam Shazeer</name></author>
  </entry>
</feed>`

afterEach(() => vi.unstubAllGlobals())

describe('investigateResearch', () => {
  it('gathers papers from OpenAlex + Crossref + arXiv, most-cited first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'api.openalex.org')
          return Promise.resolve(
            json({
              results: [
                { id: 'https://openalex.org/W1', title: 'Attention is all you need', publication_year: 2017, cited_by_count: 100000, authorships: [{ author: { display_name: 'A. Vaswani' } }] },
              ],
            }),
          )
        if (host === 'api.crossref.org')
          return Promise.resolve(
            json({
              message: {
                items: [
                  { title: ['A smaller study'], 'is-referenced-by-count': 12, DOI: '10.1/x', published: { 'date-parts': [[2020]] }, author: [{ given: 'J', family: 'Doe' }] },
                ],
              },
            }),
          )
        if (host === 'api.github.com')
          return Promise.resolve(
            json({ items: [{ full_name: 'huggingface/transformers', description: 'SOTA models', stargazers_count: 120000, html_url: 'https://github.com/huggingface/transformers', language: 'Python' }] }),
          )
        if (host === 'export.arxiv.org') return Promise.resolve(text(ARXIV_ATOM))
        if (host === 'hn.algolia.com')
          return Promise.resolve(
            json({
              hits: [
                { objectID: '42', title: 'Show HN: a transformer in 100 lines', url: '', points: 350, num_comments: 88, created_at: '2026-07-30T10:00:00Z' },
              ],
            }),
          )
        return Promise.resolve(json({}, 404))
      }),
    )
    const r = await investigateResearch('transformers')
    expect(r.summary.papers).toBe(5)
    // HN: external url empty → links to the HN thread; points+comments in claim.
    const hn = r.findings.find((f) => f.sourceKey === 'hackernews')
    expect(hn).toBeDefined()
    expect(hn!.claim).toMatch(/Discussion: Show HN: a transformer in 100 lines · 350 pts · 88 comments/)
    expect(hn!.sourceUrl).toBe('https://news.ycombinator.com/item?id=42')
    expect(r.findings.some((f) => /Tool: huggingface\/transformers .* · 120,000★ \[Python\]/.test(f.claim))).toBe(true)
    // Most-cited first: the OpenAlex paper (100000) leads.
    expect(r.findings[0].claim).toMatch(/Attention is all you need \(2017\) — A\. Vaswani · 100000 citations/)
    expect(r.findings[1].claim).toMatch(/A smaller study \(2020\)/)
    // arXiv: XML parsed, entity decoded, marked [preprint], authors joined, year from <published>.
    const pre = r.findings.find((f) => f.sourceKey === 'arxiv')
    expect(pre).toBeDefined()
    expect(pre!.claim).toMatch(/Attention Is All You Need & More \[preprint\] \(2017\) — Ashish Vaswani, Noam Shazeer/)
    expect(pre!.sourceUrl).toBe('http://arxiv.org/abs/1706.03762v5')
    expect((pre!.data as { preprint?: boolean }).preprint).toBe(true)
  })

  it('rejects too-short input', async () => {
    await expect(investigateResearch('x')).rejects.toThrow(/topic, technology or research/)
  })
})
