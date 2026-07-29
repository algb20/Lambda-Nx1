/**
 * Persist a DomainReport to our database — the "our own cache/archive" charter
 * value. Writes an investigation, its entities and pivot-graph links, and every
 * finding as evidence (with Admiralty + confidence). Dependencies are injected
 * so the logic is testable without a live database.
 */
import { repo } from '../db'
import { allSourceCatalog } from '../engine/sources'
import type { DomainReport } from './domain'
import type { Evidence, EntityType } from '../engine/types'

export interface DomainPersistence {
  seedSources: () => Promise<void>
  createInvestigation: (i: {
    userId: string
    title: string
    targetType: EntityType
    targetValue: string
  }) => Promise<{ id: string }>
  addEntity: (e: {
    investigationId: string
    type: EntityType
    value: string
  }) => Promise<{ id: string } | undefined>
  addLink: (l: {
    investigationId: string
    fromEntityId: string
    toEntityId: string
    relation: string
  }) => Promise<unknown>
  addEvidence: (e: Parameters<typeof repo.evidence.add>[0]) => Promise<unknown>
}

export const defaultDomainPersistence: DomainPersistence = {
  seedSources: () => repo.sources.upsertMany(allSourceCatalog),
  createInvestigation: (i) => repo.investigations.create(i),
  addEntity: (e) => repo.entities.add(e),
  addLink: (l) => repo.links.add(l),
  addEvidence: (e) => repo.evidence.add(e),
}

function allEvidence(report: DomainReport): Evidence[] {
  const s = report.sections
  return [...s.dns, ...s.registration, ...s.subdomains, ...s.hosting, ...s.ipExposure, ...s.history]
}

/** Persist the report for a user and return the new investigation id. */
export async function persistDomainReport(
  userId: string,
  report: DomainReport,
  p: DomainPersistence = defaultDomainPersistence,
): Promise<string> {
  await p.seedSources()

  const investigation = await p.createInvestigation({
    userId,
    title: `Domain: ${report.subject}`,
    targetType: 'domain',
    targetValue: report.subject,
  })

  // Entities (graph nodes) → map node id to db entity id.
  const nodeToEntityId = new Map<string, string>()
  for (const node of report.graph.nodes) {
    const row = await p.addEntity({
      investigationId: investigation.id,
      type: node.type,
      value: node.value,
    })
    if (row) nodeToEntityId.set(node.id, row.id)
  }

  // Pivot-graph edges.
  for (const edge of report.graph.edges) {
    const fromEntityId = nodeToEntityId.get(edge.from)
    const toEntityId = nodeToEntityId.get(edge.to)
    if (fromEntityId && toEntityId) {
      await p.addLink({
        investigationId: investigation.id,
        fromEntityId,
        toEntityId,
        relation: edge.relation,
      })
    }
  }

  // Evidence.
  for (const e of allEvidence(report)) {
    const entityId = e.entity ? nodeToEntityId.get(`${e.entity.type}:${e.entity.value}`) : undefined
    await p.addEvidence({
      investigationId: investigation.id,
      entityId: entityId ?? null,
      claim: e.claim,
      sourceKey: e.sourceKey,
      sourceUrl: e.sourceUrl ?? null,
      retrievedAt: new Date(e.retrievedAt),
      archiveUrl: null,
      contentHash: null,
      admiraltySource: e.admiralty?.source ?? null,
      admiraltyInfo: e.admiralty?.info ?? null,
      confidence: e.confidence,
      notes: null,
      raw: (e.data ?? null) as object | null,
    })
  }

  return investigation.id
}
