import { describe, it, expect, vi, afterEach } from 'vitest'
import { investigateDomain, normalizeDomain } from './domain'

/**
 * These tests exercise the real sources and orchestration against realistic
 * provider response shapes (fetch is stubbed). The live end-to-end test below
 * runs only when RUN_LIVE=1 and network egress to the providers is open.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function mockFetch(urlStr: string): Promise<Response> {
  const url = new URL(urlStr)
  switch (url.hostname) {
    case 'cloudflare-dns.com': {
      const type = url.searchParams.get('type')
      const answer = (t: number, data: string) => ({
        Status: 0,
        Answer: [{ name: 'example.com', type: t, TTL: 300, data }],
      })
      if (type === 'A') return Promise.resolve(jsonResponse(answer(1, '93.184.216.34')))
      if (type === 'MX') return Promise.resolve(jsonResponse(answer(15, '10 mail.example.com')))
      if (type === 'NS') return Promise.resolve(jsonResponse(answer(2, 'a.iana-servers.net')))
      if (type === 'TXT') return Promise.resolve(jsonResponse(answer(16, '"v=spf1 -all"')))
      return Promise.resolve(jsonResponse({ Status: 0 })) // AAAA: none
    }
    case 'rdap.org':
      return Promise.resolve(
        jsonResponse({
          ldhName: 'EXAMPLE.COM',
          status: ['client delete prohibited'],
          events: [{ eventAction: 'registration', eventDate: '1995-08-14T04:00:00Z' }],
          entities: [
            {
              roles: ['registrar'],
              vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'IANA']]],
            },
          ],
          nameservers: [{ ldhName: 'A.IANA-SERVERS.NET' }],
        }),
      )
    case 'crt.sh':
      return Promise.resolve(
        jsonResponse([{ name_value: 'www.example.com\nexample.com' }, { name_value: '*.api.example.com' }]),
      )
    case 'urlscan.io':
      return Promise.resolve(
        jsonResponse({
          results: [
            {
              page: {
                domain: 'example.com',
                ip: '93.184.216.34',
                server: 'ECS',
                asn: 'AS15133',
                asnname: 'EDGECAST',
                country: 'US',
              },
              result: 'https://urlscan.io/result/abc/',
            },
          ],
          total: 1,
        }),
      )
    case 'web.archive.org':
      return Promise.resolve(
        jsonResponse([
          ['timestamp', 'original'],
          ['19990101000000', 'http://example.com/'],
          ['20200101000000', 'http://example.com/'],
        ]),
      )
    case 'internetdb.shodan.io':
      return Promise.resolve(
        jsonResponse({ ip: '93.184.216.34', ports: [80, 443], hostnames: ['example.com'], vulns: [] }),
      )
    default:
      return Promise.resolve(new Response('not found', { status: 404 }))
  }
}

describe('normalizeDomain', () => {
  it('strips scheme, path and port and lower-cases', () => {
    expect(normalizeDomain('https://Example.com:8080/path?q=1')).toBe('example.com')
    expect(normalizeDomain('  EXAMPLE.COM  ')).toBe('example.com')
  })
})

describe('investigateDomain (realistic provider responses)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('rejects an invalid domain', async () => {
    await expect(investigateDomain('notadomain')).rejects.toThrow(/Invalid domain/)
  })

  it('assembles a documented report from all sources', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch))
    const report = await investigateDomain('https://EXAMPLE.com/')

    expect(report.subject).toBe('example.com')

    // Subdomains from CT logs (www + api), target itself excluded.
    expect(report.summary.subdomains).toBe(2)
    const subs = report.sections.subdomains.map((e) => e.entity?.value).sort()
    expect(subs).toEqual(['api.example.com', 'www.example.com'])

    // DNS resolved one IPv4 address.
    expect(report.summary.resolvedIps).toBe(1)

    // Registration came from RDAP (official → Admiralty A).
    const registrar = report.sections.registration.find((e) => e.claim.startsWith('Registrar'))
    expect(registrar?.admiralty?.source).toBe('A')

    // IP exposure was checked for the resolved IP.
    expect(report.sections.ipExposure.length).toBeGreaterThan(0)
    expect(report.sections.ipExposure.some((e) => e.claim.includes('Open ports'))).toBe(true)

    // History from Wayback.
    expect(report.sections.history[0]?.claim).toMatch(/Archived/)

    // Pivot graph is rooted at the subject and includes the resolved IP.
    expect(report.graph.nodes.some((n) => n.id === 'domain:example.com')).toBe(true)
    expect(report.graph.nodes.some((n) => n.id === 'ip:93.184.216.34')).toBe(true)

    // Every source that ran succeeded against the fixtures.
    expect(report.summary.sourcesFailed).toBe(0)
    expect(report.summary.sourcesOk).toBeGreaterThanOrEqual(6)
  })

  it('degrades gracefully when a provider fails (fallback / no crash)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) =>
        new URL(u).hostname === 'crt.sh'
          ? Promise.resolve(new Response('err', { status: 500 }))
          : mockFetch(u),
      ),
    )
    const report = await investigateDomain('example.com')
    expect(report.summary.subdomains).toBe(0) // crt.sh failed → no subdomains, but report still built
    expect(report.sections.dns.length).toBeGreaterThan(0)
  })
})

// Live end-to-end — only with RUN_LIVE=1 and open egress to the providers.
describe.runIf(process.env.RUN_LIVE === '1')('investigateDomain — LIVE', () => {
  it('returns real intelligence for example.com', async () => {
    const report = await investigateDomain('example.com')
    expect(report.subject).toBe('example.com')
    expect(report.summary.sourcesOk).toBeGreaterThan(0)
  }, 30_000)
})
