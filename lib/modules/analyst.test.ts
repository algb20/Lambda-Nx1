import { describe, it, expect, vi } from 'vitest'
import { analyzeFindings } from './analyst'
import type { AiProvider, AnalystInput, AnalystVerdict } from '../ai/types'
import type { Evidence } from '../engine/types'

function fakeProvider(over: Partial<AnalystVerdict> = {}): AiProvider & { calls: AnalystInput[] } {
  const calls: AnalystInput[] = []
  return {
    calls,
    name: 'fake',
    configured: true,
    async analyze(input: AnalystInput): Promise<AnalystVerdict> {
      calls.push(input)
      return {
        summary: 'ok',
        severity: 'low',
        keyPoints: [],
        nextSteps: [],
        needsVerification: [],
        confidenceCaveat: false,
        provider: 'fake',
        model: 'fake-1',
        generatedAt: '2026-07-29T00:00:00.000Z',
        configured: true,
        ...over,
      }
    },
  }
}

const evidence: Evidence[] = [
  { claim: 'A record 1.2.3.4', sourceKey: 'doh_dns', retrievedAt: 't', confidence: 'confirmed' },
]

describe('analyzeFindings', () => {
  it('passes normalized input to the injected provider and returns its verdict', async () => {
    const p = fakeProvider({ summary: 'triaged' })
    const verdict = await analyzeFindings(
      { subject: '  example.com  ', gateway: '  domain  ', findings: evidence },
      p,
    )
    expect(verdict.summary).toBe('triaged')
    expect(p.calls).toHaveLength(1)
    expect(p.calls[0].subject).toBe('example.com')
    expect(p.calls[0].gateway).toBe('domain')
  })

  it('defaults an empty gateway to "general"', async () => {
    const p = fakeProvider()
    await analyzeFindings({ subject: 'x', gateway: '', findings: evidence }, p)
    expect(p.calls[0].gateway).toBe('general')
  })

  it('rejects a missing subject', async () => {
    const p = fakeProvider()
    await expect(
      analyzeFindings({ subject: '   ', gateway: 'domain', findings: evidence }, p),
    ).rejects.toThrow(/subject is required/)
    expect(p.calls).toHaveLength(0)
  })

  it('rejects non-array findings', async () => {
    const p = fakeProvider()
    await expect(
      // @ts-expect-error deliberately wrong type
      analyzeFindings({ subject: 'x', gateway: 'domain', findings: null }, p),
    ).rejects.toThrow(/findings must be an array/)
  })

  it('propagates a provider that surfaces a not-configured notice', async () => {
    const p = fakeProvider({ configured: false, model: null, summary: 'not configured' })
    const v = await analyzeFindings({ subject: 'x', gateway: 'domain', findings: evidence }, p)
    expect(v.configured).toBe(false)
    expect(v.model).toBeNull()
  })
})
