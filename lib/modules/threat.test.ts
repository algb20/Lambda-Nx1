import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyIndicator, investigateThreat } from './threat'

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
  it('flags an IP found on the Feodo botnet list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'feodotracker.abuse.ch')
          return Promise.resolve(res([{ ip_address: '1.2.3.4', malware: 'Emotet' }]))
        if (host === 'urlhaus-api.abuse.ch')
          return Promise.resolve(res({ query_status: 'ok', url_count: 2, urls: [] }))
        if (host === 'threatfox-api.abuse.ch')
          return Promise.resolve(res({ query_status: 'ok', data: [{ malware: 'Emotet' }] }))
        return Promise.resolve(res({}, 404))
      }),
    )
    const report = await investigateThreat('1.2.3.4')
    expect(report.type).toBe('ip')
    expect(report.flagged).toBe(true)
    expect(report.findings.some((f) => /Feodo/.test(f.claim))).toBe(true)
  })

  it('reports no known threat cleanly (and never throws) when feeds are empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'feodotracker.abuse.ch') return Promise.resolve(res([]))
        return Promise.resolve(res({ query_status: 'no_result' }))
      }),
    )
    const report = await investigateThreat('clean.test')
    expect(report.flagged).toBe(false)
    expect(report.summary.hits).toBe(0)
  })

  it('rejects an unrecognizable indicator', async () => {
    await expect(investigateThreat('???')).rejects.toThrow(/IP address, domain/)
  })
})
