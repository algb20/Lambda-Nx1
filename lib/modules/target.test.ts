import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildTargetProfile } from './target'
import type { AiProvider, AnalystVerdict } from '../ai/types'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const fakeAnalyst: AiProvider = {
  name: 'fake',
  configured: true,
  async analyze(): Promise<AnalystVerdict> {
    return {
      summary: 'correlated read',
      severity: 'medium',
      keyPoints: ['A relates to B'],
      nextSteps: ['watch the filing'],
      needsVerification: ['confirm the partnership'],
      confidenceCaveat: false,
      provider: 'fake',
      model: 'fake-1',
      generatedAt: '2026-07-31T00:00:00.000Z',
      configured: true,
    }
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('buildTargetProfile', () => {
  it('separates static identity from the live timeline and the future horizon', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        // DNS (a STATIC identity fact)
        if (host === 'cloudflare-dns.com')
          return Promise.resolve(json({ Answer: [{ type: 1, data: '93.184.216.34', name: 'example.com' }] }))
        // News (LIVE): one past item, one forward-looking item -> horizon
        if (host === 'api.gdeltproject.org')
          return Promise.resolve(
            json({
              articles: [
                { url: 'https://n1/a', title: 'Example signs a partnership with Acme', seendate: '20260730T120000Z', domain: 'n1', sourcecountry: 'US' },
                { url: 'https://n2/b', title: 'Example will report Q3 2026 earnings next month', seendate: '20260731T120000Z', domain: 'n2', sourcecountry: 'US' },
              ],
            }),
          )
        return Promise.resolve(json({}, 200))
      }),
    )

    const p = await buildTargetProfile('example.com', { analyst: fakeAnalyst })
    expect(p.type).toBe('domain')
    // Static: the DNS A record.
    expect(p.identity.static.some((e) => e.sourceKey.startsWith('dns'))).toBe(true)
    // Live timeline holds the past partnership news, tagged as a partnership.
    expect(p.timeline.some((e) => e.kind === 'partnership' && /partnership/i.test(e.title))).toBe(true)
    // Forward-looking item is routed to the horizon, not the timeline.
    expect(p.horizon.some((e) => /will report/i.test(e.title))).toBe(true)
    expect(p.timeline.some((e) => /will report/i.test(e.title))).toBe(false)
    // Our signature comes from the analyst.
    expect(p.signature.summary).toBe('correlated read')
    expect(p.signature.watch).toContain('watch the filing')
    expect(typeof p.speed.elapsedMs).toBe('number')
  })

  it('rejects too-short input', async () => {
    await expect(buildTargetProfile('x', { analyst: fakeAnalyst })).rejects.toThrow(/Enter a target/)
  })
})
