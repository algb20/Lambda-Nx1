import { describe, expect, it } from 'vitest'
import { pubmed } from './research'
import { Registry } from '../registry'
import type { SourceContext } from '../types'

/**
 * E-utilities in a test. Two endpoints, routed by path, because the two-call
 * shape is the part of this source most likely to break — a change to either
 * response silently costs the whole result.
 */
function stub(
  responses: { esearch?: unknown; esummary?: unknown },
  options: { failOn?: Array<'esearch' | 'esummary'>; status?: number } = {},
): SourceContext {
  return {
    fetch: async (url: string) => {
      const which = url.includes('esearch.fcgi') ? 'esearch' : 'esummary'
      if (options.failOn?.includes(which)) {
        return new Response('upstream error', { status: options.status ?? 502 })
      }
      return new Response(JSON.stringify(responses[which] ?? {}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  }
}

const search = (ids: string[]) => ({ esearchresult: { idlist: ids, count: String(ids.length) } })

const summary = {
  result: {
    uids: ['38000001'],
    '38000001': {
      uid: '38000001',
      title: 'Cholera outbreak surveillance in a displaced population,  2024.',
      pubdate: '2024 Mar 15',
      source: 'Lancet Glob Health',
      authors: [{ name: 'Okafor N' }, { name: 'Diallo A' }, { name: 'Haddad R' }, { name: 'Silva P' }],
      elocationid: 'doi: 10.1016/example',
    },
  },
}

describe('PubMed', () => {
  it('registers as a passive source declaring only NCBI', () => {
    const registry = new Registry()
    expect(() => registry.register(pubmed)).not.toThrow()
    expect(pubmed.hosts).toEqual(['eutils.ncbi.nlm.nih.gov'])
  })

  it('turns identifiers into records across the two calls', async () => {
    const evidence = await pubmed.run(
      { capability: 'research', value: 'cholera displacement' },
      stub({ esearch: search(['38000001']), esummary: summary }),
    )

    expect(evidence).toHaveLength(1)
    const e = evidence[0]
    expect(e.claim).toContain('Cholera outbreak surveillance in a displaced population, 2024.')
    expect(e.claim).toContain('(2024)')
    expect(e.claim).toContain('Okafor N, Diallo A, Haddad R')
    expect(e.claim).toContain('Lancet Glob Health')
    expect(e.sourceUrl).toBe('https://pubmed.ncbi.nlm.nih.gov/38000001/')
    expect(e.admiralty).toEqual({ source: 'B', info: 2 })
    // A paper is a claim, not a settled fact — however good the index is.
    expect(e.confidence).toBe('probable')
  })

  it('claims only the year, because that is the only part PubMed always states', async () => {
    const evidence = await pubmed.run(
      { capability: 'research', value: 'malaria' },
      stub({
        esearch: search(['1']),
        esummary: { result: { uids: ['1'], '1': { uid: '1', title: 'A study', pubdate: '2019' } } },
      }),
    )
    expect((evidence[0].data as { year: number | null }).year).toBe(2019)
  })

  it('leaves the year null rather than guessing when the date is unparseable', async () => {
    const evidence = await pubmed.run(
      { capability: 'research', value: 'malaria' },
      stub({
        esearch: search(['1']),
        esummary: { result: { uids: ['1'], '1': { uid: '1', title: 'A study', pubdate: 'in press' } } },
      }),
    )
    expect((evidence[0].data as { year: number | null }).year).toBeNull()
    expect(evidence[0].claim).not.toContain('(')
  })

  it('does not make the second call when nothing matched', async () => {
    let calls = 0
    const evidence = await pubmed.run(
      { capability: 'research', value: 'nothing matches this' },
      {
        fetch: async () => {
          calls++
          return new Response(JSON.stringify(search([])), { status: 200 })
        },
      },
    )
    expect(evidence).toEqual([])
    expect(calls).toBe(1)
  })

  it('refuses an identifier that is not one, rather than putting it in a URL', async () => {
    const evidence = await pubmed.run(
      { capability: 'research', value: 'malaria' },
      stub({ esearch: { esearchresult: { idlist: ['../../etc/passwd', '7'] } }, esummary: {
        result: { uids: ['7'], '7': { uid: '7', title: 'Real record', pubdate: '2020' } },
      } }),
    )
    expect(evidence).toHaveLength(1)
    expect(evidence[0].sourceUrl).toBe('https://pubmed.ncbi.nlm.nih.gov/7/')
  })

  it('reports a failed search as unavailable, never as “no papers exist”', async () => {
    await expect(
      pubmed.run({ capability: 'research', value: 'malaria' }, stub({}, { failOn: ['esearch'] })),
    ).rejects.toThrow(/pubmed/)
  })

  it('reports a failed summary the same way — half an answer is not an answer', async () => {
    await expect(
      pubmed.run(
        { capability: 'research', value: 'malaria' },
        stub({ esearch: search(['1']) }, { failOn: ['esummary'] }),
      ),
    ).rejects.toThrow(/pubmed/)
  })

  it('declines a term too short to search, without calling anyone', async () => {
    let called = false
    const evidence = await pubmed.run(
      { capability: 'research', value: 'a' },
      {
        fetch: async () => {
          called = true
          return new Response('{}')
        },
      },
    )
    expect(evidence).toEqual([])
    expect(called).toBe(false)
  })

  it('identifies itself to NCBI, as their usage policy asks', async () => {
    const seen: string[] = []
    await pubmed.run(
      { capability: 'research', value: 'malaria' },
      {
        fetch: async (url: string) => {
          seen.push(url)
          return new Response(JSON.stringify(search([])), { status: 200 })
        },
      },
    )
    expect(seen[0]).toContain('tool=lambda-nx')
    expect(seen[0]).toContain('email=')
  })
})

/** Against the real index. Off by default — see the CKAN live block. */
describe.runIf(process.env.RUN_LIVE === '1')('PubMed — LIVE', () => {
  it('finds indexed literature for a real biomedical term', async () => {
    const evidence = await pubmed.run(
      { capability: 'research', value: 'cholera outbreak' },
      { fetch: (url) => fetch(url) },
    )
    expect(evidence.length).toBeGreaterThan(0)
    for (const e of evidence) {
      expect(e.sourceUrl).toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/)
    }
  }, 60_000)
})
