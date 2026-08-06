import { describe, it, expect } from 'vitest'
import { buildOntology, inferPredicate } from './ontology'
import type { Evidence } from './types'

function ev(sourceKey: string, entity: Evidence['entity'], over: Partial<Evidence> = {}): Evidence {
  return { claim: 'c', sourceKey, entity, retrievedAt: 't', confidence: 'possible', ...over }
}

describe('inferPredicate', () => {
  it('maps sources and ownership relations to the controlled vocabulary', () => {
    expect(inferPredicate(ev('doh_dns', { type: 'ip', value: '1.2.3.4' }))).toBe('resolves_to')
    expect(inferPredicate(ev('crtsh', { type: 'domain', value: 'a.example.com' }))).toBe('has_subdomain')
    expect(inferPredicate(ev('opensanctions', { type: 'person', value: 'X' }))).toBe('sanctioned_as')
    expect(inferPredicate(ev('gdelt', { type: 'other', value: 'bbc.com' }))).toBe('reported_by')
    expect(
      inferPredicate(ev('gleif_ownership', { type: 'company', value: 'Parent' }, { data: { relation: 'direct-parent' } })),
    ).toBe('owned_by')
    expect(inferPredicate(ev('mystery', { type: 'other', value: 'z' }))).toBe('associated_with')
  })
})

describe('buildOntology', () => {
  it('merges the same entity across gateways into one node and dedupes edges with provenance', () => {
    const root = { type: 'domain' as const, value: 'example.com' }
    const ip = { type: 'ip' as const, value: '1.2.3.4' }
    const onto = buildOntology(root, [
      ev('doh_dns', ip, { admiralty: { source: 'A', info: 1 } }),
      ev('google_dns', ip, { admiralty: { source: 'A', info: 1 } }), // same edge, 2nd source
      ev('crtsh', { type: 'domain', value: 'mail.example.com' }),
    ])
    // Nodes: root + ip + subdomain = 3 (ip not duplicated).
    expect(onto.stats.nodes).toBe(3)
    const resolves = onto.edges.find((e) => e.predicate === 'resolves_to')!
    expect(resolves.to).toBe('ip:1.2.3.4')
    expect(resolves.sources.sort()).toEqual(['doh_dns', 'google_dns'])
    expect(resolves.confidence).toBe('confirmed') // two reliable sources corroborate
    expect(onto.stats.byPredicate.has_subdomain).toBe(1)
  })

  it('does not create a self-edge when the object equals the root', () => {
    const root = { type: 'other' as const, value: 'BTC' }
    const onto = buildOntology(root, [ev('coingecko', { type: 'other', value: 'BTC' })])
    expect(onto.edges).toHaveLength(0)
    expect(onto.stats.nodes).toBe(1)
  })
})
