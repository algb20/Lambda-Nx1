import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifySelector, investigateNexus } from './nexus'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('classifySelector', () => {
  it('recognizes each selector type', () => {
    expect(classifySelector('https://example.com/path')).toEqual({ type: 'domain', value: 'example.com' })
    expect(classifySelector('example.com')).toEqual({ type: 'domain', value: 'example.com' })
    expect(classifySelector('8.8.8.8')).toEqual({ type: 'ip', value: '8.8.8.8' })
    expect(classifySelector('a@b.com')).toEqual({ type: 'email', value: 'a@b.com' })
    expect(classifySelector('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').type).toBe('wallet')
    expect(classifySelector('d41d8cd98f00b204e9800998ecf8427e').type).toBe('hash')
    expect(classifySelector('Acme Corporation').type).toBe('entity')
  })
})

describe('investigateNexus', () => {
  it('fans out for a domain and fuses graded evidence with timing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        // Cloudflare DoH answers the DNS capability with an A record.
        if (host === 'cloudflare-dns.com')
          return Promise.resolve(json({ Answer: [{ type: 1, data: '93.184.216.34', name: 'example.com' }] }))
        // Everything else returns empty/soft-fail; the dossier must still form.
        return Promise.resolve(json({}, 200))
      }),
    )
    const r = await investigateNexus('example.com')
    expect(r.selectorType).toBe('domain')
    expect(r.speed.capabilitiesRun).toBeGreaterThanOrEqual(6)
    expect(typeof r.speed.elapsedMs).toBe('number')
    expect(r.sections.some((s) => s.gateway === 'Domain')).toBe(true)
    // The A record became evidence and a graph node (the resolved IP).
    expect(r.findings.some((f) => f.entity?.type === 'ip' && f.entity.value === '93.184.216.34')).toBe(true)
    expect(r.graph.nodes.some((n) => n.value === '93.184.216.34')).toBe(true)
  })

  it('serves an instant cache hit on repeat', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({}, 200))))
    const first = await investigateNexus('8.8.8.8')
    expect(first.speed.cacheHit).toBe(false)
    const second = await investigateNexus('8.8.8.8')
    expect(second.speed.cacheHit).toBe(true)
    expect(second.speed.elapsedMs).toBe(0)
  })

  it('rejects too-short input', async () => {
    await expect(investigateNexus('x')).rejects.toThrow(/Enter anything/)
  })
})
