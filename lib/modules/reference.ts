/**
 * Reference / knowledge-base gateway. "What are the structured facts about this
 * entity?" — resolves a name into typed relations (parent org, founder, CEO,
 * country, headquarters, coordinates) from Wikidata, and builds the ontology so
 * the relations are first-class, gradable edges in our own knowledge graph.
 *
 * Facts are curated, well-sourced references — graded honestly (probable), never
 * asserted as primary truth. This is the entity-resolution front door that turns
 * a bare name into a node the rest of the platform can pivot on.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerReferenceGateway } from '../engine/sources'
import { buildOntology, type Ontology } from '../engine/ontology'
import type { Evidence, EntityType } from '../engine/types'

export interface ReferenceReport {
  subject: string
  generatedAt: string
  facts: Evidence[]
  ontology: Ontology
  summary: { facts: number; sourcesOk: number; sourcesFailed: number }
}

export async function investigateReference(input: string): Promise<ReferenceReport> {
  registerReferenceGateway()
  const subject = input.trim()
  if (subject.length < 2) throw new Error('Enter a company, person or place name')
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'reference', value: subject }, { registry, mode: 'all' })
  const facts = [...r.evidence]

  /**
   * What the subject *is*, from the source rather than from this line.
   *
   * This used to read `{ type: 'company', value: subject }`, hard-coded, and it
   * put `company:Marie Curie` into the knowledge graph — a person recorded as a
   * company, stated with the same confidence as everything else. The gateway
   * whose whole purpose is turning a name into a correctly typed node was the
   * one generating the wrong type.
   *
   * The source reads Wikidata's own `P31` and returns it on the identity
   * finding. `other` is the honest fallback when nothing resolved: not knowing
   * what something is beats asserting the wrong thing about it.
   */
  const identity = facts.find((f) => (f.data as { relation?: string } | undefined)?.relation === 'identity')
  const subjectType: EntityType = identity?.entity?.type ?? 'other'
  const ontology = buildOntology({ type: subjectType, value: subject }, facts)

  return {
    subject,
    generatedAt,
    facts,
    ontology,
    summary: {
      facts: facts.length,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}
