import { describe, it, expect, vi, afterEach } from 'vitest'
import { investigateOwnership, buildOwnershipGraph } from './ownership'
import type { Evidence } from '../engine/types'

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
function leiRecord(name: string, lei: string) {
  return { id: lei, attributes: { lei, entity: { legalName: { name } } } }
}

afterEach(() => vi.unstubAllGlobals())

describe('investigateOwnership', () => {
  it('resolves an entity and maps its control network into a graded graph', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const url = new URL(u)
        if (url.pathname === '/api/v1/lei-records')
          return Promise.resolve(res({ data: [leiRecord('Acme Corp', '5493001ACME0000001R12')] }))
        if (url.pathname.endsWith('/direct-parents'))
          return Promise.resolve(res({ data: [leiRecord('Acme Holdings', '5493001HOLD0000002R12')] }))
        if (url.pathname.endsWith('/ultimate-parents'))
          return Promise.resolve(res({ data: [leiRecord('Global Ultimate SA', '5493001ULT00000003R12')] }))
        if (url.pathname.endsWith('/direct-children'))
          return Promise.resolve(res({ data: [leiRecord('Acme Sub One', '5493001SUB00000004R12')] }))
        return Promise.resolve(res({}, 404))
      }),
    )
    const r = await investigateOwnership('Acme Corp')
    expect(r.resolvedEntity).toBe('Acme Corp')
    expect(r.summary.parents).toBe(1)
    expect(r.summary.ultimateParents).toBe(1)
    expect(r.summary.subsidiaries).toBe(1)
    expect(r.findings.some((f) => /Direct parent \(GLEIF\): Acme Holdings/.test(f.claim))).toBe(true)
    expect(r.findings.some((f) => /Ultimate parent \(GLEIF\): Global Ultimate SA/.test(f.claim))).toBe(true)
    expect(r.findings.some((f) => /Direct subsidiary \(GLEIF\): Acme Sub One/.test(f.claim))).toBe(true)

    // Graph: root + 3 related nodes; edges carry clean control relations.
    expect(r.graph.nodes).toHaveLength(4)
    const relations = r.graph.edges.map((e) => e.relation).sort()
    expect(relations).toEqual(['owned by', 'owns', 'ultimately owned by'])
  })

  it('handles an unknown entity without inventing relationships', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(res({ data: [] }))))
    const r = await investigateOwnership('No Such Entity Ltd')
    expect(r.resolvedEntity).toBeNull()
    expect(r.findings).toHaveLength(0)
    expect(r.graph.edges).toHaveLength(0)
  })

  it('rejects too-short input', async () => {
    await expect(investigateOwnership('ab')).rejects.toThrow(/company \/ legal-entity name/)
  })
})

describe('buildOwnershipGraph', () => {
  it('ignores the self node and non-ownership evidence', () => {
    const ev: Evidence[] = [
      { claim: 'self', sourceKey: 'gleif_ownership', retrievedAt: 't', confidence: 'probable', entity: { type: 'company', value: 'Root' }, data: { relation: 'self' } },
      { claim: 'p', sourceKey: 'gleif_ownership', retrievedAt: 't', confidence: 'probable', entity: { type: 'company', value: 'Parent' }, data: { relation: 'direct-parent' } },
      { claim: 'noise', sourceKey: 'x', retrievedAt: 't', confidence: 'possible', entity: { type: 'company', value: 'Other' } },
    ]
    const g = buildOwnershipGraph('Root', ev)
    expect(g.nodes.map((n) => n.value).sort()).toEqual(['Parent', 'Root'])
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]).toMatchObject({ relation: 'owned by' })
  })
})
