import { describe, it, expect } from 'vitest'
import { ClaudeAnalyst } from './claude'
import { DisabledAnalyst, notConfiguredVerdict } from './disabled'
import type { Evidence } from '../engine/types'

const findings: Evidence[] = [
  { claim: 'clean screen', sourceKey: 'opensanctions', retrievedAt: 't', confidence: 'possible' },
]

describe('ClaudeAnalyst (no key)', () => {
  it('reports not configured and returns a graceful notice without calling the network', async () => {
    const a = new ClaudeAnalyst({ apiKey: '' })
    expect(a.configured).toBe(false)
    const v = await a.analyze({ subject: 'Acme', gateway: 'finance', findings })
    expect(v.configured).toBe(false)
    expect(v.model).toBeNull()
    expect(v.provider).toBe('claude')
    expect(v.severity).toBe('info')
    expect(v.summary).toMatch(/not configured/i)
  })

  it('is configured when an api key is provided', () => {
    const a = new ClaudeAnalyst({ apiKey: 'sk-test-123' })
    expect(a.configured).toBe(true)
  })
})

describe('DisabledAnalyst', () => {
  it('always returns the not-configured notice', async () => {
    const a = new DisabledAnalyst()
    expect(a.configured).toBe(false)
    const v = await a.analyze({ subject: 'x', gateway: 'domain', findings })
    expect(v.configured).toBe(false)
    expect(v.provider).toBe('disabled')
  })
})

describe('notConfiguredVerdict', () => {
  it('is severity info, unconfigured, with no invented facts', () => {
    const v = notConfiguredVerdict('claude', '2026-07-29T00:00:00.000Z')
    expect(v.severity).toBe('info')
    expect(v.keyPoints).toEqual([])
    expect(v.needsVerification).toEqual([])
    expect(v.generatedAt).toBe('2026-07-29T00:00:00.000Z')
  })
})
