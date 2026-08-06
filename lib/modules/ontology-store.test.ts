import { describe, it, expect } from 'vitest'
import {
  loadOntology,
  neighbors,
  persistOntology,
  subgraph,
  type OntologyStorePort,
  type StoredOntology,
} from './ontology-store'
import type { Ontology } from '../engine/ontology'
import type { EntityType } from '../engine/types'

function fakeStore(): OntologyStorePort & {
  entities: Array<{ id: string; investigationId: string; type: EntityType; value: string }>
  links: Array<{ investigationId: string; fromEntityId: string; toEntityId: string; relation: string }>
} {
  const entities: Array<{ id: string; investigationId: string; type: EntityType; value: string }> = []
  const links: Array<{ investigationId: string; fromEntityId: string; toEntityId: string; relation: string }> = []
  return {
    entities,
    links,
    async addEntity(e) {
      // Dedupe by (investigation, type, value) like the real unique index.
      const found = entities.find(
        (x) => x.investigationId === e.investigationId && x.type === e.type && x.value === e.value,
      )
      if (found) return { id: found.id }
      const row = { id: `e${entities.length}`, ...e }
      entities.push(row)
      return { id: row.id }
    },
    async addLink(l) {
      links.push(l)
      return l
    },
    async listEntities(id) {
      return entities.filter((e) => e.investigationId === id)
    },
    async listLinks(id) {
      return links.filter((l) => l.investigationId === id)
    },
  }
}

const ontology: Ontology = {
  nodes: [
    { id: 'domain:example.com', type: 'domain', value: 'example.com', sources: [] },
    { id: 'ip:1.2.3.4', type: 'ip', value: '1.2.3.4', sources: ['doh_dns'] },
    { id: 'company:Acme', type: 'company', value: 'Acme', sources: ['gleif'] },
  ],
  edges: [
    { from: 'domain:example.com', to: 'ip:1.2.3.4', predicate: 'resolves_to', confidence: 'confirmed', sources: ['doh_dns'], evidenceCount: 2 },
    { from: 'domain:example.com', to: 'company:Acme', predicate: 'registered_by', confidence: 'probable', sources: ['rdap'], evidenceCount: 1 },
  ],
  stats: { nodes: 3, edges: 2, byPredicate: { resolves_to: 1, registered_by: 1 } },
}

describe('persistOntology + loadOntology', () => {
  it('round-trips nodes and predicate edges through the store', async () => {
    const store = fakeStore()
    const written = await persistOntology(store, 'inv1', ontology)
    expect(written).toEqual({ nodes: 3, edges: 2 })

    const loaded = await loadOntology(store, 'inv1')
    expect(loaded.nodes).toHaveLength(3)
    expect(loaded.edges.map((e) => e.predicate).sort()).toEqual(['registered_by', 'resolves_to'])
    expect(loaded.edges.find((e) => e.predicate === 'resolves_to')?.to).toBe('ip:1.2.3.4')
  })
})

const graph: StoredOntology = {
  nodes: [
    { id: 'domain:example.com', type: 'domain', value: 'example.com' },
    { id: 'ip:1.2.3.4', type: 'ip', value: '1.2.3.4' },
    { id: 'company:Acme', type: 'company', value: 'Acme' },
    { id: 'company:Parent', type: 'company', value: 'Parent' },
  ],
  edges: [
    { from: 'domain:example.com', to: 'ip:1.2.3.4', predicate: 'resolves_to' },
    { from: 'domain:example.com', to: 'company:Acme', predicate: 'registered_by' },
    { from: 'company:Acme', to: 'company:Parent', predicate: 'owned_by' },
  ],
}

describe('neighbors', () => {
  it('returns direct neighbors with predicate and direction', () => {
    const n = neighbors(graph, 'company:Acme')
    expect(n).toHaveLength(2)
    expect(n.find((x) => x.node.value === 'example.com')?.direction).toBe('in')
    expect(n.find((x) => x.node.value === 'Parent')?.direction).toBe('out')
  })
})

describe('subgraph', () => {
  it('expands breadth-first to the requested depth', () => {
    const d1 = subgraph(graph, 'domain:example.com', 1)
    expect(d1.nodes.map((n) => n.value).sort()).toEqual(['1.2.3.4', 'Acme', 'example.com'])
    const d2 = subgraph(graph, 'domain:example.com', 2)
    expect(d2.nodes.some((n) => n.value === 'Parent')).toBe(true)
  })
})
