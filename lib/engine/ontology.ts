/**
 * Ontology — one model of the world (Palantir-style thinking, our own build).
 *
 * The pivot graph in analysis.ts uses the raw claim text as the edge label. The
 * ontology goes further: it maps evidence into a **controlled vocabulary** of
 * typed relations (predicates), merges the same entity seen by different gateways
 * into ONE node, and de-duplicates edges while accumulating their provenance and
 * grading each by corroboration. Data, logic and (later) permissions share this
 * one model — so gateways, Nexus and the tracker all speak the same language.
 */
import { gradeConfidence } from './analysis'
import type { Confidence, EntityRef, Evidence } from './types'

/** Controlled relation vocabulary. Extend deliberately, never ad-hoc. */
export const PREDICATES = [
  'resolves_to',
  'has_subdomain',
  'registered_by',
  'owned_by',
  'owns',
  'ultimately_owned_by',
  'identified_as',
  'sanctioned_as',
  'filed',
  'received_funding',
  'flagged_by',
  'reported_by',
  'exposes',
  'priced_at',
  'located_in',
  'founded_by',
  'led_by',
  'associated_with',
] as const
export type Predicate = (typeof PREDICATES)[number]

export const PREDICATE_LABEL: Record<Predicate, string> = {
  resolves_to: 'resolves to',
  has_subdomain: 'has subdomain',
  registered_by: 'registered by',
  owned_by: 'owned by',
  owns: 'owns',
  ultimately_owned_by: 'ultimately owned by',
  identified_as: 'identified as',
  sanctioned_as: 'sanctioned as',
  filed: 'filed',
  received_funding: 'received funding',
  flagged_by: 'flagged by',
  reported_by: 'reported by',
  exposes: 'exposes',
  priced_at: 'priced at',
  located_in: 'located in',
  founded_by: 'founded by',
  led_by: 'led by',
  associated_with: 'associated with',
}

export interface OntoNode {
  id: string
  type: EntityRef['type']
  value: string
  sources: string[]
}
export interface OntoEdge {
  from: string
  to: string
  predicate: Predicate
  confidence: Confidence
  sources: string[]
  evidenceCount: number
}
export interface Ontology {
  nodes: OntoNode[]
  edges: OntoEdge[]
  stats: { nodes: number; edges: number; byPredicate: Partial<Record<Predicate, number>> }
}

function has(key: string, ...needles: string[]): boolean {
  return needles.some((n) => key.includes(n))
}

/** Map one evidence item to a typed predicate (subject = root, object = e.entity). */
export function inferPredicate(e: Evidence): Predicate {
  const rel = (e.data as { relation?: string } | undefined)?.relation
  if (rel === 'direct-parent') return 'owned_by'
  if (rel === 'ultimate-parent') return 'ultimately_owned_by'
  if (rel === 'direct-child') return 'owns'
  if (rel === 'self') return 'identified_as'
  if (rel === 'country' || rel === 'hq') return 'located_in'
  if (rel === 'founder') return 'founded_by'
  if (rel === 'ceo') return 'led_by'

  const k = e.sourceKey
  if (has(k, 'dns')) return 'resolves_to'
  if (has(k, 'crtsh')) return 'has_subdomain'
  if (has(k, 'rdap')) return 'registered_by'
  if (has(k, 'opensanctions')) return 'sanctioned_as'
  if (has(k, 'edgar')) return 'filed'
  if (has(k, 'usaspending', 'worldbank')) return 'received_funding'
  if (has(k, 'feodo', 'urlhaus', 'threatfox')) return 'flagged_by'
  if (has(k, 'gdelt', 'wikipedia')) return 'reported_by'
  if (has(k, 'internetdb', 'shodan')) return 'exposes'
  if (has(k, 'coingecko', 'stooq', 'frankfurter')) return 'priced_at'
  if (has(k, 'gleif')) return 'identified_as'
  return 'associated_with'
}

function nodeId(e: EntityRef): string {
  return `${e.type}:${e.value}`
}

/**
 * Build the ontology graph: the root entity plus every entity discovered in the
 * evidence, linked by typed predicates. Duplicate nodes/edges merge, keeping the
 * union of sources; each edge is graded by the corroboration behind it.
 */
export function buildOntology(root: EntityRef, evidence: Evidence[]): Ontology {
  const nodes = new Map<string, OntoNode>()
  const addNode = (ref: EntityRef, source?: string) => {
    const id = nodeId(ref)
    const existing = nodes.get(id)
    if (existing) {
      if (source && !existing.sources.includes(source)) existing.sources.push(source)
      return id
    }
    nodes.set(id, { id, type: ref.type, value: ref.value, sources: source ? [source] : [] })
    return id
  }

  const rootId = addNode(root)

  // Group linking evidence by (object, predicate) so each edge is graded once.
  const groups = new Map<string, { to: EntityRef; predicate: Predicate; ev: Evidence[] }>()
  for (const e of evidence) {
    if (!e.entity) continue
    const predicate = inferPredicate(e)
    const key = `${nodeId(e.entity)}|${predicate}`
    const g = groups.get(key) ?? { to: e.entity, predicate, ev: [] }
    g.ev.push(e)
    groups.set(key, g)
  }

  const edges: OntoEdge[] = []
  const byPredicate: Partial<Record<Predicate, number>> = {}
  for (const g of groups.values()) {
    const toId = addNode(g.to)
    for (const e of g.ev) addNode(g.to, e.sourceKey)
    if (toId === rootId) continue
    const sources = [...new Set(g.ev.map((e) => e.sourceKey))]
    edges.push({
      from: rootId,
      to: toId,
      predicate: g.predicate,
      confidence: gradeConfidence(g.ev),
      sources,
      evidenceCount: g.ev.length,
    })
    byPredicate[g.predicate] = (byPredicate[g.predicate] ?? 0) + 1
  }

  return {
    nodes: [...nodes.values()],
    edges,
    stats: { nodes: nodes.size, edges: edges.length, byPredicate },
  }
}
