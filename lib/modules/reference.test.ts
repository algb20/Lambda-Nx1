import { describe, it, expect, vi, afterEach } from 'vitest'
import { investigateReference } from './reference'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('investigateReference', () => {
  it('resolves an entity into facts + an ontology of typed relations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        if (u.includes('action=wbsearchentities')) return Promise.resolve(json({ search: [{ id: 'Q95' }] }))
        if (u.includes('Special:EntityData/Q95.json'))
          return Promise.resolve(
            json({
              entities: {
                Q95: {
                  labels: { en: { value: 'Google' } },
                  claims: {
                    P749: [{ mainsnak: { datavalue: { value: { id: 'Q20800404' } } } }],
                    P17: [{ mainsnak: { datavalue: { value: { id: 'Q30' } } } }],
                  },
                },
              },
            }),
          )
        if (u.includes('action=wbgetentities'))
          return Promise.resolve(
            json({
              entities: {
                Q20800404: { labels: { en: { value: 'Alphabet Inc.' } } },
                Q30: { labels: { en: { value: 'United States of America' } } },
              },
            }),
          )
        return Promise.resolve(json({}, 404))
      }),
    )
    const r = await investigateReference('Google')
    expect(r.summary.facts).toBe(2)
    expect(r.facts.some((f) => f.claim === 'Parent organization: Alphabet Inc.')).toBe(true)
    const preds = new Set(r.ontology.edges.map((e) => e.predicate))
    expect(preds.has('owned_by')).toBe(true)
    expect(preds.has('located_in')).toBe(true)
  })

  it('rejects too-short input', async () => {
    await expect(investigateReference('x')).rejects.toThrow(/company, person or place/)
  })
})
