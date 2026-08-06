/**
 * Ontology persistence & query. Writes an Ontology (typed entities + predicate
 * edges) into our own store (entities / entity_links), and reads it back as a
 * traversable knowledge graph. So investigations accumulate into shared memory
 * the whole app can query — the point of the ontology (charter: our own tech).
 *
 * Dependency-injected port ⇒ fully testable without a live database.
 */
import { repo } from '../db'
import type { Ontology, Predicate } from '../engine/ontology'
import type { EntityType } from '../engine/types'

export interface StoredNode {
  id: string
  type: EntityType
  value: string
}
export interface StoredEdge {
  from: string
  to: string
  predicate: Predicate
}
export interface StoredOntology {
  nodes: StoredNode[]
  edges: StoredEdge[]
}

export interface OntologyStorePort {
  addEntity(e: { investigationId: string; type: EntityType; value: string }): Promise<{ id: string } | undefined>
  addLink(l: { investigationId: string; fromEntityId: string; toEntityId: string; relation: string }): Promise<unknown>
  listEntities(investigationId: string): Promise<Array<{ id: string; type: EntityType; value: string }>>
  listLinks(
    investigationId: string,
  ): Promise<Array<{ fromEntityId: string; toEntityId: string; relation: string }>>
}

export const defaultOntologyStore: OntologyStorePort = {
  addEntity: (e) => repo.entities.add(e),
  addLink: (l) => repo.links.add(l),
  listEntities: (id) => repo.entities.listByInvestigation(id),
  listLinks: (id) => repo.links.listByInvestigation(id),
}

/** Persist an ontology under an investigation. Returns how many edges were written. */
export async function persistOntology(
  port: OntologyStorePort,
  investigationId: string,
  ontology: Ontology,
): Promise<{ nodes: number; edges: number }> {
  const nodeToDbId = new Map<string, string>()
  for (const node of ontology.nodes) {
    const row = await port.addEntity({ investigationId, type: node.type, value: node.value })
    if (row) nodeToDbId.set(node.id, row.id)
  }
  let edges = 0
  for (const edge of ontology.edges) {
    const fromEntityId = nodeToDbId.get(edge.from)
    const toEntityId = nodeToDbId.get(edge.to)
    if (!fromEntityId || !toEntityId) continue
    await port.addLink({ investigationId, fromEntityId, toEntityId, relation: edge.predicate })
    edges++
  }
  return { nodes: nodeToDbId.size, edges }
}

/** Load a persisted ontology back as a traversable graph (node ids = type:value). */
export async function loadOntology(
  port: OntologyStorePort,
  investigationId: string,
): Promise<StoredOntology> {
  const entities = await port.listEntities(investigationId)
  const links = await port.listLinks(investigationId)
  const dbIdToNodeId = new Map(entities.map((e) => [e.id, `${e.type}:${e.value}`]))
  const nodes: StoredNode[] = entities.map((e) => ({ id: `${e.type}:${e.value}`, type: e.type, value: e.value }))
  const edges: StoredEdge[] = []
  for (const l of links) {
    const from = dbIdToNodeId.get(l.fromEntityId)
    const to = dbIdToNodeId.get(l.toEntityId)
    if (from && to) edges.push({ from, to, predicate: l.relation as Predicate })
  }
  return { nodes, edges }
}

// ── Pure query surface ───────────────────────────────────────────────────────

export interface Neighbor {
  node: StoredNode
  predicate: Predicate
  direction: 'out' | 'in'
}

/** Direct neighbors of a node, with the predicate and direction of each link. */
export function neighbors(graph: StoredOntology, nodeId: string): Neighbor[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const out: Neighbor[] = []
  for (const e of graph.edges) {
    if (e.from === nodeId) {
      const node = byId.get(e.to)
      if (node) out.push({ node, predicate: e.predicate, direction: 'out' })
    } else if (e.to === nodeId) {
      const node = byId.get(e.from)
      if (node) out.push({ node, predicate: e.predicate, direction: 'in' })
    }
  }
  return out
}

/** Breadth-first subgraph around a node up to `depth` hops. */
export function subgraph(graph: StoredOntology, nodeId: string, depth = 1): StoredOntology {
  const keep = new Set<string>([nodeId])
  let frontier = new Set<string>([nodeId])
  for (let d = 0; d < depth; d++) {
    // Expand from the CURRENT level only (a snapshot), so depth is exact.
    const next = new Set<string>()
    for (const e of graph.edges) {
      if (frontier.has(e.from) && !keep.has(e.to)) (keep.add(e.to), next.add(e.to))
      if (frontier.has(e.to) && !keep.has(e.from)) (keep.add(e.from), next.add(e.from))
    }
    if (next.size === 0) break
    frontier = next
  }
  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
  }
}
