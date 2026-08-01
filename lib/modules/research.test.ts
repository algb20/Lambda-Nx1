import { describe, it, expect, vi, afterEach } from 'vitest'
import { investigateResearch } from './research'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('investigateResearch', () => {
  it('gathers papers from OpenAlex + Crossref, most-cited first', async () => {
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
        return Promise.resolve(json({}, 404))
      }),
    )
    const r = await investigateResearch('transformers')
    expect(r.summary.papers).toBe(2)
    // Most-cited first: the OpenAlex paper (100000) leads.
    expect(r.findings[0].claim).toMatch(/Attention is all you need \(2017\) — A\. Vaswani · 100000 citations/)
    expect(r.findings[1].claim).toMatch(/A smaller study \(2020\)/)
  })

  it('rejects too-short input', async () => {
    await expect(investigateResearch('x')).rejects.toThrow(/topic, technology or research/)
  })
})
