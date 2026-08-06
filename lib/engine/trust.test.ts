import { describe, it, expect } from 'vitest'
import { assessTrust, sealFindings } from './trust'
import type { Evidence } from './types'

function ev(sourceKey: string, over: Partial<Evidence> = {}): Evidence {
  return {
    claim: 'a claim',
    sourceKey,
    retrievedAt: 't',
    confidence: 'possible',
    ...over,
  }
}

describe('assessTrust', () => {
  it('flags a single-source finding as low neutrality and not corroborated', () => {
    const t = assessTrust([ev('gdelt')])
    expect(t.independentSources).toBe(1)
    expect(t.corroboration).toBe('single')
    expect(t.neutrality).toBeLessThanOrEqual(35)
  })

  it('rewards multiple reliable, geographically diverse sources', () => {
    const t = assessTrust([
      ev('rdap', { admiralty: { source: 'A', info: 1 }, data: { country: 'US' } }),
      ev('crtsh', { admiralty: { source: 'B', info: 2 }, data: { country: 'DE' } }),
      ev('gdelt', { admiralty: { source: 'C', info: 3 }, data: { country: 'FR' } }),
    ])
    expect(t.independentSources).toBe(3)
    expect(t.reliableSources).toBe(2)
    expect(t.corroboration).toBe('strong')
    expect(t.sourceCountries.sort()).toEqual(['DE', 'FR', 'US'])
    expect(t.neutrality).toBeGreaterThanOrEqual(75)
  })

  it('counts a topic as corroborated only when ≥2 distinct sources back it', () => {
    const entity = { type: 'ip' as const, value: '1.2.3.4' }
    const t = assessTrust([
      ev('doh_dns', { entity }),
      ev('google_dns', { entity }),
      ev('gdelt', { entity: { type: 'ip', value: '9.9.9.9' } }),
    ])
    expect(t.corroboratedTopics).toBe(1)
  })
})

describe('sealFindings', () => {
  it('is deterministic and order-independent', () => {
    const a = ev('s1', { claim: 'x' })
    const b = ev('s2', { claim: 'y' })
    expect(sealFindings([a, b])).toBe(sealFindings([b, a]))
    expect(sealFindings([a, b])).toMatch(/^lnx1-[a-f0-9]{16}$/)
  })

  it('changes when a finding changes', () => {
    const base = sealFindings([ev('s1', { claim: 'x' })])
    const changed = sealFindings([ev('s1', { claim: 'x!' })])
    expect(base).not.toBe(changed)
  })
})
