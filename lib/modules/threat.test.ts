import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyIndicator, investigateThreat, THREAT_WITHHELD } from './threat'

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('classifyIndicator', () => {
  it('detects the indicator type', () => {
    expect(classifyIndicator('1.2.3.4')).toBe('ip')
    expect(classifyIndicator('https://bad.test/x')).toBe('url')
    expect(classifyIndicator('evil.test')).toBe('domain')
    expect(classifyIndicator('d41d8cd98f00b204e9800998ecf8427e')).toBe('hash')
    expect(classifyIndicator('??')).toBe('unknown')
  })
})

describe('investigateThreat', () => {
  /**
   * Batch 07: abuse.ch admits only authenticated users and may require a
   * commercial subscription; ThreatFox and URLhaus already answered 401. With
   * no permitted source the gateway refuses with the reason, sends nothing,
   * and above all does not return "not flagged" — an unchecked indicator is
   * not a clean one (S invariant 15). The adapters' own tests still cover
   * how a real abuse.ch answer is read, for the day access is arranged.
   */
  it('refuses with the reason, and never reports an unchecked indicator as clean', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(res([])))
    vi.stubGlobal('fetch', fetchSpy)
    await expect(investigateThreat('1.2.3.4')).rejects.toThrow(THREAT_WITHHELD)
    await expect(investigateThreat('clean.test')).rejects.toThrow(/not the same as clean/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects an unrecognizable indicator', async () => {
    await expect(investigateThreat('???')).rejects.toThrow(/IP address, domain/)
  })
})
