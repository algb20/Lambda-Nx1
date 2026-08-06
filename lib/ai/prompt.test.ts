import { describe, it, expect } from 'vitest'
import { ANALYST_SYSTEM, buildAnalystPrompt } from './prompt'
import type { AnalystInput } from './types'
import type { Evidence } from '../engine/types'

function ev(claim: string, over: Partial<Evidence> = {}): Evidence {
  return {
    claim,
    sourceKey: 'crtsh',
    retrievedAt: '2026-07-29T00:00:00.000Z',
    confidence: 'possible',
    ...over,
  }
}

describe('ANALYST_SYSTEM', () => {
  it('encodes the sort-not-verify and passive-only rules', () => {
    expect(ANALYST_SYSTEM).toMatch(/do NOT verify/)
    expect(ANALYST_SYSTEM).toMatch(/Passive only/)
    expect(ANALYST_SYSTEM).toMatch(/Use ONLY the evidence provided/)
  })
})

describe('buildAnalystPrompt', () => {
  it('includes subject, gateway, focus and each finding with its grade + source', () => {
    const input: AnalystInput = {
      subject: 'example.com',
      gateway: 'domain',
      focus: 'is this used for phishing?',
      findings: [
        ev('A record 93.184.216.34', { confidence: 'confirmed', sourceKey: 'doh_dns' }),
        ev('subdomain mail.example.com', { admiralty: { source: 'B', info: 2 } }),
      ],
    }
    const p = buildAnalystPrompt(input)
    expect(p).toMatch(/SUBJECT: example\.com/)
    expect(p).toMatch(/GATEWAY: domain/)
    expect(p).toMatch(/FOCUS: is this used for phishing\?/)
    expect(p).toMatch(/\[confirmed\] \(source=doh_dns\) A record 93\.184\.216\.34/)
    expect(p).toMatch(/admiralty=B2/)
    expect(p).toMatch(/EVIDENCE \(2 finding/)
  })

  it('handles an empty evidence set honestly', () => {
    const p = buildAnalystPrompt({ subject: 'x.test', gateway: 'domain', findings: [] })
    expect(p).toMatch(/none — the collectors returned no findings/)
  })

  it('caps findings and truncates very long claims', () => {
    const many = Array.from({ length: 80 }, (_, i) => ev(`finding ${i}`))
    const p = buildAnalystPrompt({ subject: 's', gateway: 'g', findings: many })
    expect(p).toMatch(/showing first 60/)
    expect(p).toMatch(/and 20 more finding\(s\) not shown/)

    const longClaim = 'z'.repeat(1000)
    const p2 = buildAnalystPrompt({ subject: 's', gateway: 'g', findings: [ev(longClaim)] })
    expect(p2).toContain('…')
    expect(p2).not.toContain('z'.repeat(1000))
  })
})
