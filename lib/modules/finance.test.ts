import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyFinance, investigateFinance } from './finance'
import { financeGatewaySources } from '../engine/sources'

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('classifyFinance', () => {
  it('detects a Bitcoin address vs an entity name', () => {
    expect(classifyFinance('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('wallet')
    expect(classifyFinance('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe('wallet')
    expect(classifyFinance('Acme Corporation')).toBe('entity')
  })
})

describe('investigateFinance', () => {
  /**
   * OpenSanctions is withheld (batch 06): its API refuses keyless calls (401)
   * and its data is CC BY-NC — commercial use needs a paid licence. The entity
   * screen therefore reads GLEIF, and never calls OpenSanctions.
   */
  it('identifies an entity through GLEIF and never calls OpenSanctions', async () => {
    const fetchSpy = vi.fn((u: string) => {
      const host = new URL(u).hostname
      if (host === 'api.gleif.org')
        return Promise.resolve(res({ data: [{ attributes: { lei: '5493001KJTIIGC8Y1R12', entity: { legalName: { name: 'Acme' } } } }] }))
      return Promise.resolve(res({}, 404))
    })
    vi.stubGlobal('fetch', fetchSpy)
    const report = await investigateFinance('Acme')
    expect(report.type).toBe('entity')
    expect(report.findings.some((f) => /GLEIF/.test(f.claim))).toBe(true)
    expect(fetchSpy.mock.calls.some((c) => new URL(String(c[0])).hostname === 'api.opensanctions.org')).toBe(false)
    expect(financeGatewaySources.map((s) => s.key)).not.toContain('opensanctions')
  })

  it('reads Bitcoin ledger facts for an address', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(res({ address: 'x', chain_stats: { funded_txo_sum: 200000000, spent_txo_sum: 100000000, tx_count: 7 } })),
      ),
    )
    const report = await investigateFinance('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
    expect(report.type).toBe('wallet')
    expect(report.findings[0]?.claim).toMatch(/1\.00000000 BTC across 7 tx/)
  })

  it('rejects too-short input', async () => {
    await expect(investigateFinance('ab')).rejects.toThrow(/name\/company or a Bitcoin/)
  })
})
