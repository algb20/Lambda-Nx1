import { describe, expect, it } from 'vitest'
import { LICENCE_TEXTS, STANDARD_LICENCE_WORDS, licenceTextsFor, licenceTextsInUse } from './licence-texts'
import { SOURCE_LICENSE_REGISTRY, usagePolicy } from './registry'

describe('licence texts owed to the sources Lambda shows', () => {
  it('has a text for every standard licence a running source names', () => {
    const unlinked = SOURCE_LICENSE_REGISTRY.filter(
      (r) =>
        usagePolicy(r.license_status) !== 'WITHHOLD' &&
        STANDARD_LICENCE_WORDS.test(r.license) &&
        licenceTextsFor(r.license).length === 0,
    ).map((r) => `${r.source_id}: ${r.license}`)
    expect(unlinked).toEqual([])
  })

  it('includes the licences batch 11 verified (R318)', () => {
    const ids = licenceTextsInUse().map((t) => t.id)
    for (const id of ['cc-by-4.0', 'cc-by-3.0-nz', 'ogl-uk-3.0', 'licence-ouverte-2.0', 'w3c-document-2023', 'japan-public-data-1.0']) {
      expect(ids).toContain(id)
    }
  })

  it('reads every licence family the way it is written in the registry', () => {
    expect(licenceTextsFor('CC BY 4.0').map((t) => t.id)).toEqual(['cc-by-4.0'])
    expect(licenceTextsFor('CC-BY-SA-4.0').map((t) => t.id)).toEqual(['cc-by-sa-4.0'])
    expect(licenceTextsFor('OGL-UK-3.0').map((t) => t.id)).toEqual(['ogl-uk-3.0'])
    expect(licenceTextsFor('Per-ecosystem open licences (CC BY 4.0, CC BY-SA 4.0, CC0, MIT)').map((t) => t.id)).toEqual([
      'cc-by-4.0',
      'cc-by-sa-4.0',
      'cc0-1.0',
    ])
    // Bespoke terms are linked from the record's own terms URL, not here.
    expect(licenceTextsFor('ECB terms of use')).toEqual([])
  })

  it('owes nothing for a withheld source (negative control)', () => {
    const withheld = { ...SOURCE_LICENSE_REGISTRY[0], license: 'CC BY 3.0 NZ', license_status: 'RESTRICTED' as const }
    expect(licenceTextsInUse([withheld]).map((t) => t.id)).toEqual([])
  })

  it('links only https texts', () => {
    for (const t of LICENCE_TEXTS) expect(t.url, t.id).toMatch(/^https:\/\//)
  })
})
