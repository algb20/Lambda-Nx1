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
import type { Evidence } from '../engine/types'

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
  const ontology = buildOntology({ type: 'company', value: subject }, facts)

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
