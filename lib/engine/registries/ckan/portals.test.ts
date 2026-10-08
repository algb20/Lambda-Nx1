import { describe, expect, it } from 'vitest'
describe('the licence gate on portals (batch 09)', () => {
  it('never queries a portal whose catalogue terms refuse this product, even if enabled', async () => {
    const { activePortals, PORTALS } = await import('./portals')
    const { needsAgreement } = await import('../../catalog/licence')
    const open = PORTALS.find((p) => p.enabled !== false)!
    const refused = { ...open, key: 'refused_portal', enabled: true, metadataLicence: needsAgreement('Example', 'https://example.org/terms') }
    expect(activePortals([open, refused]).map((p) => p.key)).toEqual([open.key])
    expect(activePortals().some((p) => p.key === 'who_gho')).toBe(false)
  })
})
