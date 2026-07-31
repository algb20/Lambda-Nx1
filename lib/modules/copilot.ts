/**
 * Pivot Copilot — turns a dossier's ontology into concrete, runnable next steps.
 *
 * The analyst suggests in prose; the copilot proposes *executable* pivots: each
 * investigable neighbour becomes a one-tap "investigate this next", ranked by the
 * confidence of the link that surfaced it. Human-in-the-loop: it proposes, the
 * user approves each run. It only ever proposes another PASSIVE lookup — it never
 * verifies for you and never touches a target.
 */
import { PREDICATE_LABEL, type Ontology, type Predicate } from '../engine/ontology'
import type { Confidence, EntityType } from '../engine/types'

export interface Pivot {
  selector: string
  entityType: EntityType
  reason: string
  predicate: Predicate
  confidence: Confidence
}

const CONFIDENCE_RANK: Record<Confidence, number> = {
  confirmed: 3,
  probable: 2,
  possible: 1,
  unconfirmed: 0,
}

/** Entity types the platform can investigate as a fresh selector. */
const INVESTIGABLE: ReadonlySet<EntityType> = new Set<EntityType>([
  'domain',
  'ip',
  'email',
  'company',
  'person',
  'organization',
  'wallet',
  'url',
])

/**
 * Propose the strongest next pivots from an ontology: one per distinct
 * investigable neighbour, ranked by link confidence (highest first).
 */
export function proposePivots(ontology: Ontology, max = 8): Pivot[] {
  const nodeById = new Map(ontology.nodes.map((n) => [n.id, n]))
  const seen = new Set<string>()
  const pivots: Pivot[] = []
  for (const edge of ontology.edges) {
    const node = nodeById.get(edge.to)
    if (!node || !INVESTIGABLE.has(node.type)) continue
    const key = `${node.type}:${node.value}`
    if (seen.has(key)) continue
    seen.add(key)
    pivots.push({
      selector: node.value,
      entityType: node.type,
      reason: PREDICATE_LABEL[edge.predicate],
      predicate: edge.predicate,
      confidence: edge.confidence,
    })
  }
  return pivots
    .sort((a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence])
    .slice(0, max)
}
