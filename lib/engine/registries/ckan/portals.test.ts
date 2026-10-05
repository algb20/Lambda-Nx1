import { describe, expect, it } from 'vitest'
describe('the licence gate on portals (batch 09)', () => {
  it('never queries a portal whose catalogue terms refuse this product, even if enabled', async () => {
    const { activePortals, PORTALS } = await import('./portals')
    const { needsAgreement } = await import('../../catalog/licence')
    const refused = { ...PORTALS[0], key: 'refused_portal', enabled: true, metadataLicence: needsAgreement('Example', 'https://example.org/terms') }
    expect(activePortals([PORTALS[0], refused]).map((p) => p.key)).toEqual([PORTALS[0].key])
    expect(activePortals().some((p) => p.key === 'who_gho')).toBe(false)
  })
})
