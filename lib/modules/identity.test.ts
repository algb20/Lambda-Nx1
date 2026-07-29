import { describe, it, expect, vi, afterEach } from 'vitest'
import { investigateUsername, investigateEmail } from './identity'

function res(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('investigateUsername', () => {
  it('reports only platforms where the account exists (no false positives)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'github.com' || host === 'gitlab.com') return Promise.resolve(res('ok', 200))
        if (host === 'keybase.io') return Promise.resolve(res(JSON.stringify({ them: [] }), 200))
        if (host === 'hacker-news.firebaseio.com') return Promise.resolve(res('null', 200))
        return Promise.resolve(res('not found', 404))
      }),
    )
    const report = await investigateUsername('octocat')
    const platforms = report.found.map((e) => e.data as { platform: string }).map((d) => d.platform).sort()
    expect(platforms).toEqual(['GitHub', 'GitLab'])
    expect(report.summary.platformsFound).toBe(2)
  })

  it('rejects an invalid username', async () => {
    await expect(investigateUsername('has spaces!')).rejects.toThrow(/Invalid username/)
  })
})

describe('investigateEmail', () => {
  it('reports breaches and a Gravatar profile', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'api.xposedornot.com')
          return Promise.resolve(res(JSON.stringify({ breaches: [['Adobe', 'Canva']] }), 200))
        if (host === 'www.gravatar.com')
          return Promise.resolve(
            res(JSON.stringify({ entry: [{ displayName: 'Jane', profileUrl: 'https://gravatar.com/jane' }] }), 200),
          )
        return Promise.resolve(res('not found', 404))
      }),
    )
    const report = await investigateEmail('Jane@Example.com')
    expect(report.subject).toBe('jane@example.com')
    expect(report.summary.breachCount).toBe(2)
    expect(report.summary.hasGravatar).toBe(true)
    expect(report.breaches.map((b) => (b.data as { breach: string }).breach)).toEqual(['Adobe', 'Canva'])
  })

  it('reports no exposure cleanly when nothing is found', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(res('not found', 404))))
    const report = await investigateEmail('nobody@example.com')
    expect(report.summary.breachCount).toBe(0)
    expect(report.summary.hasGravatar).toBe(false)
  })

  it('rejects an invalid email', async () => {
    await expect(investigateEmail('nope')).rejects.toThrow(/Invalid email/)
  })
})
