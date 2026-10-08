import { describe, expect, it } from 'vitest'
import { SOURCE_CREDITS, creditOf } from './credits'
import { creditEntries } from './credit-derivation'
import { licenseRecord, usagePolicy } from '../licensing/registry'

describe('the generated credit index (GL-04, R323)', () => {
  it('answers identically to the catalogue and registry', () => {
    // Drift means a credit someone owes is missing from the page. Regenerate:
    // npx tsx scripts/build-credit-index.ts
    expect(Object.entries(SOURCE_CREDITS)).toEqual(creditEntries())
  })

  it('gives withheld sources no credit, because nothing of theirs is shown', () => {
    for (const key of Object.keys(SOURCE_CREDITS)) {
      const r = licenseRecord(key)
      if (r) expect(usagePolicy(r.license_status), key).not.toBe('WITHHOLD')
    }
    expect(creditOf('guardian_world')).toBeUndefined()
  })

  it('names a licence only where the registry verified it', () => {
    for (const [key, c] of Object.entries(SOURCE_CREDITS)) {
      if (c.licence) expect(licenseRecord(key)?.license_status, key).toMatch(/^VERIFIED/)
    }
    expect(creditOf('bgs_quakes')?.licence).toBeUndefined()
    expect(creditOf('emsc_quakes')?.licence).toBe('CC BY 4.0')
  })
})
