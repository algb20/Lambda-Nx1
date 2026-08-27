import { describe, it, expect } from 'vitest'
import { wikidata } from './reference'
import { buildOntology } from '../ontology'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** A ctx.fetch that routes by the Wikidata API action / path. */
function wikidataFetch() {
  return (url: string): Promise<Response> => {
    if (url.includes('action=wbsearchentities')) {
      return Promise.resolve(json({ search: [{ id: 'Q95', label: 'Google' }] }))
    }
    if (url.includes('Special:EntityData/Q95.json')) {
      return Promise.resolve(
        json({
          entities: {
            Q95: {
              labels: { en: { value: 'Google' } },
              claims: {
                P749: [{ mainsnak: { datavalue: { value: { id: 'Q20800404' } } } }], // parent
                P112: [{ mainsnak: { datavalue: { value: { id: 'Q92747' } } } }], // founder
                P17: [{ mainsnak: { datavalue: { value: { id: 'Q30' } } } }], // country
                P625: [{ mainsnak: { datavalue: { value: { latitude: 37.42, longitude: -122.08 } } } }],
              },
            },
          },
        }),
      )
    }
    if (url.includes('action=wbgetentities')) {
      return Promise.resolve(
        json({
          entities: {
            Q20800404: { labels: { en: { value: 'Alphabet Inc.' } } },
            Q92747: { labels: { en: { value: 'Larry Page' } } },
            Q30: { labels: { en: { value: 'United States of America' } } },
          },
        }),
      )
    }
    return Promise.resolve(json({}, 404))
  }
}

describe('wikidata source', () => {
  it('resolves an entity into typed relations + coordinates', async () => {
    const ev = await wikidata.run({ capability: 'reference', value: 'Google' }, { fetch: wikidataFetch() })
    const byRel = (rel: string) => ev.find((e) => (e.data as { relation?: string }).relation === rel)

    expect(byRel('direct-parent')?.entity?.value).toBe('Alphabet Inc.')
    expect(byRel('founder')?.entity?.value).toBe('Larry Page')
    expect(byRel('country')?.entity?.value).toBe('United States of America')
    // self coordinate pin for the globe
    const self = byRel('self')
    expect((self?.data as { lat: number; lon: number }).lat).toBeCloseTo(37.42, 2)
    expect((self?.data as { lat: number; lon: number }).lon).toBeCloseTo(-122.08, 2)
    // all facts graded probable, sourced to wikidata
    expect(ev.every((e) => e.sourceKey === 'wikidata' && e.confidence === 'probable')).toBe(true)
  })

  it('maps its relations onto ontology predicates (owned_by / located_in / founded_by)', async () => {
    const ev = await wikidata.run({ capability: 'reference', value: 'Google' }, { fetch: wikidataFetch() })
    const onto = buildOntology({ type: 'company', value: 'Google' }, ev)
    const preds = new Set(onto.edges.map((e) => e.predicate))
    expect(preds.has('owned_by')).toBe(true) // parent org
    expect(preds.has('founded_by')).toBe(true) // founder
    expect(preds.has('located_in')).toBe(true) // country
    // the parent edge points at the resolved node
    const parent = onto.edges.find((e) => e.predicate === 'owned_by')!
    expect(onto.nodes.find((n) => n.id === parent.to)?.value).toBe('Alphabet Inc.')
  })

  it('returns nothing when the name does not resolve', async () => {
    const ev = await wikidata.run(
      { capability: 'reference', value: 'zzzznotanentity' },
      { fetch: () => Promise.resolve(json({ search: [] })) },
    )
    expect(ev).toEqual([])
  })
})

/**
 * The measured failure: Wikidata resolved Marie Curie to Q7186 on the first
 * call, and the gateway returned nothing, because every property it lifted was
 * corporate. The page read as a failure and the ontology recorded a person as
 * `company:Marie Curie`.
 */
describe('a person resolves to a person, with something to show', () => {
  const person = {
    entities: {
      Q7186: {
        labels: { en: { value: 'Marie Curie' } },
        descriptions: { en: { value: 'Polish-French physicist and chemist' } },
        claims: {
          P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
          P27: [{ mainsnak: { datavalue: { value: { id: 'Q142' } } } }],
          P166: [{ mainsnak: { datavalue: { value: { id: 'Q38104' } } } }],
        },
      },
    },
  }
  const labels = {
    entities: {
      Q5: { labels: { en: { value: 'human' } } },
      Q142: { labels: { en: { value: 'France' } } },
      Q38104: { labels: { en: { value: 'Nobel Prize in Physics' } } },
    },
  }

  const ctx = () => ({
    fetch: (url: string): Promise<Response> => {
      if (url.includes('wbsearchentities')) return Promise.resolve(json({ search: [{ id: 'Q7186' }] }))
      if (url.includes('EntityData')) return Promise.resolve(json(person))
      return Promise.resolve(json(labels))
    },
  })

  it('never returns an empty page for an entity it resolved', async () => {
    const out = await wikidata.run({ capability: 'reference', value: 'Marie Curie' }, ctx())
    expect(out.length).toBeGreaterThan(0)
    const identity = out.find((e) => (e.data as { relation?: string }).relation === 'identity')
    expect(identity, 'the identity itself is the answer, not a preamble').toBeDefined()
    expect(identity?.claim).toContain('Marie Curie')
    expect(identity?.claim).toContain('human')
    expect(identity?.claim).toContain('physicist')
  })

  it('types her from the entity rather than from the questions asked', () => {
    // `company:Marie Curie` was written into the knowledge graph. A wrong fact
    // stated confidently is what the grading exists to prevent.
    return wikidata
      .run({ capability: 'reference', value: 'Marie Curie' }, ctx())
      .then((out) => {
        const identity = out.find((e) => (e.data as { relation?: string }).relation === 'identity')
        expect(identity?.entity?.type).toBe('person')
      })
  })

  it('lifts the relations a person actually has', async () => {
    const out = await wikidata.run({ capability: 'reference', value: 'Marie Curie' }, ctx())
    const relations = out.map((e) => (e.data as { relation?: string }).relation)
    expect(relations).toContain('citizenship')
    expect(relations).toContain('award')
  })

  it('says "other" rather than guessing when it does not recognise the class', async () => {
    const odd = {
      entities: {
        Q1: {
          labels: { en: { value: 'Some Thing' } },
          claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q99999999' } } } }] },
        },
      },
    }
    const c = {
      fetch: (url: string): Promise<Response> => {
        if (url.includes('wbsearchentities')) return Promise.resolve(json({ search: [{ id: 'Q1' }] }))
        if (url.includes('EntityData')) return Promise.resolve(json(odd))
        return Promise.resolve(json({ entities: {} }))
      },
    }
    const out = await wikidata.run({ capability: 'reference', value: 'Some Thing' }, c)
    const identity = out.find((e) => (e.data as { relation?: string }).relation === 'identity')
    expect(identity?.entity?.type).toBe('other')
  })
})
