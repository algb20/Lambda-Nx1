import { describe, it, expect } from 'vitest'
import { proposePivots } from './copilot'
import type { Ontology } from '../engine/ontology'

const ontology: Ontology = {
  nodes: [
    { id: 'domain:example.com', type: 'domain', value: 'example.com', sources: [] },
    { id: 'ip:1.2.3.4', type: 'ip', value: '1.2.3.4', sources: [] },
    { id: 'company:Acme', type: 'company', value: 'Acme', sources: [] },
    { id: 'other:bbc.com', type: 'other', value: 'bbc.com', sources: [] }, // not investigable
  ],
  edges: [
    { from: 'domain:example.com', to: 'ip:1.2.3.4', predicate: 'resolves_to', confidence: 'confirmed', sources: [], evidenceCount: 2 },
    { from: 'domain:example.com', to: 'company:Acme', predicate: 'registered_by', confidence: 'possible', sources: [], evidenceCount: 1 },
    { from: 'domain:example.com', to: 'other:bbc.com', predicate: 'reported_by', confidence: 'possible', sources: [], evidenceCount: 1 },
  ],
  stats: { nodes: 4, edges: 3, byPredicate: {} },
}

describe('proposePivots', () => {
  it('proposes investigable neighbours, ranked by link confidence', () => {
    const pivots = proposePivots(ontology)
    // 'other:bbc.com' is skipped (not an investigable type).
    expect(pivots.map((p) => p.selector)).toEqual(['1.2.3.4', 'Acme'])
    // confirmed link ranks before the possible one.
    expect(pivots[0]).toMatchObject({ selector: '1.2.3.4', reason: 'resolves to', confidence: 'confirmed' })
  })

  it('dedupes and respects the max', () => {
    const many: Ontology = {
      ...ontology,
      edges: [
        ...ontology.edges,
        { from: 'domain:example.com', to: 'ip:1.2.3.4', predicate: 'exposes', confidence: 'probable', sources: [], evidenceCount: 1 },
      ],
    }
    const pivots = proposePivots(many, 1)
    expect(pivots).toHaveLength(1)
    expect(new Set(pivots.map((p) => p.selector)).size).toBe(1)
  })
})
