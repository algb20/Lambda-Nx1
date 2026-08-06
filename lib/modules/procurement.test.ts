import { describe, it, expect, vi, afterEach } from 'vitest'
import { investigateProcurement } from './procurement'

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('investigateProcurement', () => {
  it('reports US federal awards and World Bank projects for a recipient', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((u: string) => {
        const host = new URL(u).hostname
        if (host === 'api.usaspending.gov')
          return Promise.resolve(
            res({
              results: [
                {
                  'Award ID': 'CONT_AWD_1',
                  'Recipient Name': 'Acme Corp',
                  'Award Amount': 2_500_000,
                  'Awarding Agency': 'Department of Defense',
                  'Period of Performance Start Date': '2024-03-01',
                },
              ],
            }),
          )
        if (host === 'search.worldbank.org')
          return Promise.resolve(
            res({
              projects: {
                P123: {
                  id: 'P123',
                  project_name: 'Rural Water Access',
                  countryshortname: 'Kenya',
                  totalcommamt: '150,000,000',
                  boardapprovaldate: '2023-06-15T00:00:00Z',
                  status: 'Active',
                },
              },
            }),
          )
        return Promise.resolve(res({}, 404))
      }),
    )
    const r = await investigateProcurement('Acme Corp')
    expect(r.summary.matches).toBe(2)
    expect(r.findings.some((f) => /US federal award — Acme Corp: \$2\.50M from Department of Defense/.test(f.claim))).toBe(true)
    expect(r.findings.some((f) => /World Bank project — Rural Water Access \[Kenya\]: \$150\.00M committed/.test(f.claim))).toBe(true)
  })

  it('returns no matches gracefully (not a clearance)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(res({ results: [] }))))
    const r = await investigateProcurement('Nonexistent Entity XYZ')
    expect(r.summary.matches).toBe(0)
  })

  it('rejects too-short input', async () => {
    await expect(investigateProcurement('ab')).rejects.toThrow(/recipient, company, agency or project/)
  })
})
