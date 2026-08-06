import { describe, it, expect } from 'vitest'
import { globalNeighbors, mergeOntology, type GlobalOntologyPort } from './ontology-global'
import type { Ontology } from '../engine/ontology'
import type { EntityType } from '../engine/types'

/** In-memory global store that dedupes and accumulates like the real repo. */
function memoryStore(): GlobalOntologyPort {
  const nodes = new Map<string, { id: string; type: EntityType; value: string; mentions: number }>()
  const edges = new Map<string, { fromNodeId: string; toNodeId: string; predicate: string; confidence: any; evidenceCount: number }>()
  const key = (t: string, v: string) => `${t}:${v}`
  return {
    async upsertNode({ type, value }) {
      const k = key(type, value)
      const found = nodes.get(k)
      if (found) {
        found.mentions += 1
        return { id: found.id }
      }
      const row = { id: `n${nodes.size}`, type, value, mentions: 1 }
      nodes.set(k, row)
      return { id: row.id }
    },
    async upsertEdge({ fromNodeId, toNodeId, predicate, confidence, evidenceCount }) {
      const k = `${fromNodeId}|${predicate}|${toNodeId}`
      const found = edges.get(k)
      if (found) found.evidenceCount += evidenceCount
      else edges.set(k, { fromNodeId, toNodeId, predicate, confidence, evidenceCount })
      return undefined
    },
    async getNode(type, value) {
      return nodes.get(key(type, value))
    },
    async edgesForNode(nodeId) {
      return [...edges.values()].filter((e) => e.fromNodeId === nodeId || e.toNodeId === nodeId)
    },
    async nodesByIds(ids) {
      return [...nodes.values()].filter((n) => ids.includes(n.id))
    },
  }
}

const onto: Ontology = {
  nodes: [
    { id: 'domain:example.com', type: 'domain', value: 'example.com', sources: [] },
    { id: 'ip:1.2.3.4', type: 'ip', value: '1.2.3.4', sources: ['doh_dns'] },
  ],
  edges: [
    { from: 'domain:example.com', to: 'ip:1.2.3.4', predicate: 'resolves_to', confidence: 'confirmed', sources: ['doh_dns'], evidenceCount: 2 },
  ],
  stats: { nodes: 2, edges: 1, byPredicate: { resolves_to: 1 } },
}

describe('mergeOntology (accumulating global graph)', () => {
  it('dedupes nodes/edges across runs and accumulates mentions + evidence', async () => {
    const store = memoryStore()
    await mergeOntology(store, onto)
    await mergeOntology(store, onto) // same investigation, run twice

    const domain = await store.getNode('domain', 'example.com')
    expect(domain?.mentions).toBe(2) // observed twice

    const around = await globalNeighbors(store, 'domain', 'example.com')
    expect(around).not.toBeNull()
    expect(around!.neighbors).toHaveLength(1) // one deduped edge, not two
    expect(around!.neighbors[0].node.value).toBe('1.2.3.4')
    expect(around!.neighbors[0].direction).toBe('out')
    expect(around!.neighbors[0].evidenceCount).toBe(4) // 2 + 2 accumulated
  })

  it('returns null neighbors for an unknown entity', async () => {
    const store = memoryStore()
    expect(await globalNeighbors(store, 'domain', 'nope.test')).toBeNull()
  })
})
