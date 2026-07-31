/**
 * Ownership & beneficial-control gateway. Resolves a company to its GLEIF legal
 * entity and maps the control network around it — parents, ultimate parents and
 * subsidiaries — into a graded pivot graph. This is the analytical backbone that
 * ties money, companies and (later) sanctions into one picture.
 *
 * Passive and lawful: GLEIF Level-2 relationship data is public, filed record.
 * A "no relationships" result is not a claim of independence — only absence of a
 * filed GLEIF relationship.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { gradeConfidence, type Graph, type GraphEdge, type GraphNode } from '../engine/analysis'
import { registerOwnershipGateway } from '../engine/sources'
import type { Evidence } from '../engine/types'
import type { OwnershipRelation } from '../engine/sources/ownership'

export interface OwnershipReport {
  subject: string
  resolvedEntity: string | null
  generatedAt: string
  findings: Evidence[]
  graph: Graph
  summary: {
    parents: number
    ultimateParents: number
    subsidiaries: number
    sourcesOk: number
    sourcesFailed: number
  }
}

const RELATION_LABEL: Record<Exclude<OwnershipRelation, 'self'>, string> = {
  'direct-parent': 'owned by',
  'ultimate-parent': 'ultimately owned by',
  'direct-child': 'owns',
}

function relationOf(e: Evidence): OwnershipRelation | null {
  const r = (e.data as { relation?: string } | undefined)?.relation
  if (r === 'self' || r === 'direct-parent' || r === 'ultimate-parent' || r === 'direct-child') return r
  return null
}

/** Build the ownership graph: the resolved root linked to each related entity by
 * a clean control relation (owns / owned by / ultimately owned by). */
export function buildOwnershipGraph(rootValue: string, evidence: Evidence[]): Graph {
  const nodes = new Map<string, GraphNode>()
  const rootId = `company:${rootValue}`
  nodes.set(rootId, { id: rootId, type: 'company', value: rootValue })

  const edges: GraphEdge[] = []
  for (const e of evidence) {
    const relation = relationOf(e)
    if (!relation || relation === 'self' || !e.entity) continue
    const toId = `${e.entity.type}:${e.entity.value}`
    if (toId === rootId) continue
    if (!nodes.has(toId)) nodes.set(toId, { id: toId, type: e.entity.type, value: e.entity.value })
    edges.push({
      from: rootId,
      to: toId,
      relation: RELATION_LABEL[relation],
      confidence: gradeConfidence([e]),
    })
  }
  return { nodes: [...nodes.values()], edges }
}

export async function investigateOwnership(input: string): Promise<OwnershipReport> {
  registerOwnershipGateway()
  const subject = input.trim()
  if (subject.length < 3) throw new Error('Enter a company / legal-entity name')
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'ownership', value: subject }, { registry, mode: 'all' })
  const findings = r.evidence

  const self = findings.find((e) => relationOf(e) === 'self')
  const resolvedEntity = self?.entity?.value ?? null
  const rootValue = resolvedEntity ?? subject
  const graph = buildOwnershipGraph(rootValue, findings)

  const count = (rel: OwnershipRelation) => findings.filter((e) => relationOf(e) === rel).length
  return {
    subject,
    resolvedEntity,
    generatedAt,
    findings,
    graph,
    summary: {
      parents: count('direct-parent'),
      ultimateParents: count('ultimate-parent'),
      subsidiaries: count('direct-child'),
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}
