import { describe, it, expect } from 'vitest'
import { persistDomainReport, type DomainPersistence } from './persist'
import type { DomainReport } from './domain'
import type { Evidence } from '../engine/types'

function ev(claim: string, entity?: Evidence['entity']): Evidence {
  return {
    claim,
    entity,
    sourceKey: 'dns.cloudflare',
    sourceUrl: 'https://example',
    retrievedAt: new Date().toISOString(),
    admiralty: { source: 'B', info: 2 },
    confidence: 'possible',
  }
}

const report: DomainReport = {
  subject: 'example.com',
  generatedAt: new Date().toISOString(),
  sections: {
    dns: [ev('A record: 1.2.3.4', { type: 'ip', value: '1.2.3.4' })],
    registration: [ev('Registrar: IANA')],
    subdomains: [],
    hosting: [],
    ipExposure: [],
    history: [],
  },
  graph: {
    nodes: [
      { id: 'domain:example.com', type: 'domain', value: 'example.com' },
      { id: 'ip:1.2.3.4', type: 'ip', value: '1.2.3.4' },
    ],
    edges: [
      { from: 'domain:example.com', to: 'ip:1.2.3.4', relation: 'A record: 1.2.3.4', confidence: 'possible' },
    ],
  },
  sourcesUsed: [],
  summary: { subdomains: 0, resolvedIps: 1, entities: 2, sourcesOk: 1, sourcesFailed: 0 },
}

describe('persistDomainReport', () => {
  it('writes investigation, entities, links and evidence with correct mapping', async () => {
    const calls = {
      seedSources: 0,
      investigations: [] as unknown[],
      entities: [] as Array<{ type: string; value: string }>,
      links: [] as unknown[],
      evidence: [] as Array<{ entityId: string | null; claim: string }>,
    }

    const fake: DomainPersistence = {
      seedSources: async () => {
        calls.seedSources++
      },
      createInvestigation: async (i) => {
        calls.investigations.push(i)
        return { id: 'inv-1' }
      },
      addEntity: async (e) => {
        calls.entities.push({ type: e.type, value: e.value })
        return { id: `ent-${e.type}-${e.value}` }
      },
      addLink: async (l) => {
        calls.links.push(l)
      },
      addEvidence: async (e) => {
        calls.evidence.push({ entityId: e.entityId ?? null, claim: e.claim })
      },
    }

    const investigationId = await persistDomainReport('user-1', report, fake)

    expect(investigationId).toBe('inv-1')
    expect(calls.seedSources).toBe(1)
    expect(calls.investigations).toHaveLength(1)
    expect(calls.entities).toHaveLength(2) // two graph nodes
    expect(calls.links).toHaveLength(1)
    expect(calls.evidence).toHaveLength(2) // dns + registration

    // The DNS evidence must be linked to the IP entity; the registrar evidence must not.
    const dnsEvidence = calls.evidence.find((e) => e.claim.startsWith('A record'))
    const regEvidence = calls.evidence.find((e) => e.claim.startsWith('Registrar'))
    expect(dnsEvidence?.entityId).toBe('ent-ip-1.2.3.4')
    expect(regEvidence?.entityId).toBeNull()
  })
})
