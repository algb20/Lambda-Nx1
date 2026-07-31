/**
 * Global ontology — accumulating knowledge-graph memory across ALL runs.
 *
 * Every investigation merges its ontology here, deduped by (type,value) for nodes
 * and (from,to,predicate) for edges, accumulating mentions/evidence over time.
 * So the platform *remembers*: the more it is used, the richer its shared model of
 * the world becomes — a foundation for self-improvement (charter: our own tech).
 *
 * Dependency-injected port ⇒ testable without a live database.
 */
import { repo } from '../db'
import type { Ontology } from '../engine/ontology'
import type { Confidence, EntityType } from '../engine/types'

export interface GlobalNode {
  id: string
  type: EntityType
  value: string
  mentions: number
}
export interface GlobalEdge {
  fromNodeId: string
  toNodeId: string
  predicate: string
  confidence: Confidence
  evidenceCount: number
}

export interface GlobalOntologyPort {
  upsertNode(input: { type: EntityType; value: string; sources: string[] }): Promise<{ id: string }>
  upsertEdge(input: {
    fromNodeId: string
    toNodeId: string
    predicate: string
    confidence: Confidence
    sources: string[]
    evidenceCount: number
  }): Promise<unknown>
  getNode(type: EntityType, value: string): Promise<GlobalNode | undefined>
  edgesForNode(nodeId: string): Promise<GlobalEdge[]>
  nodesByIds(ids: string[]): Promise<GlobalNode[]>
}

export const defaultGlobalOntology: GlobalOntologyPort = {
  upsertNode: (i) => repo.ontology.upsertNode(i),
  upsertEdge: (i) => repo.ontology.upsertEdge(i),
  getNode: (t, v) => repo.ontology.getNode(t, v),
  edgesForNode: (id) => repo.ontology.edgesForNode(id),
  nodesByIds: (ids) => repo.ontology.nodesByIds(ids),
}

/** Merge a request-level ontology into the global accumulating graph. */
export async function mergeOntology(
  port: GlobalOntologyPort,
  ontology: Ontology,
): Promise<{ nodes: number; edges: number }> {
  const nodeToDbId = new Map<string, string>()
  for (const node of ontology.nodes) {
    const row = await port.upsertNode({ type: node.type, value: node.value, sources: node.sources })
    nodeToDbId.set(node.id, row.id)
  }
  let edges = 0
  for (const edge of ontology.edges) {
    const fromNodeId = nodeToDbId.get(edge.from)
    const toNodeId = nodeToDbId.get(edge.to)
    if (!fromNodeId || !toNodeId) continue
    await port.upsertEdge({
      fromNodeId,
      toNodeId,
      predicate: edge.predicate,
      confidence: edge.confidence,
      sources: edge.sources,
      evidenceCount: edge.evidenceCount,
    })
    edges++
  }
  return { nodes: nodeToDbId.size, edges }
}

export interface GlobalNeighbor {
  node: GlobalNode
  predicate: string
  direction: 'out' | 'in'
  evidenceCount: number
}

/** Neighbors of an entity in the accumulated global graph. */
export async function globalNeighbors(
  port: GlobalOntologyPort,
  type: EntityType,
  value: string,
): Promise<{ node: GlobalNode; neighbors: GlobalNeighbor[] } | null> {
  const node = await port.getNode(type, value)
  if (!node) return null
  const edges = await port.edgesForNode(node.id)
  const otherIds = [...new Set(edges.map((e) => (e.fromNodeId === node.id ? e.toNodeId : e.fromNodeId)))]
  const others = new Map((await port.nodesByIds(otherIds)).map((n) => [n.id, n]))
  const neighbors: GlobalNeighbor[] = []
  for (const e of edges) {
    const outward = e.fromNodeId === node.id
    const other = others.get(outward ? e.toNodeId : e.fromNodeId)
    if (other) neighbors.push({ node: other, predicate: e.predicate, direction: outward ? 'out' : 'in', evidenceCount: e.evidenceCount })
  }
  return { node, neighbors }
}
