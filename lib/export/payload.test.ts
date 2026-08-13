import { describe, it, expect } from 'vitest'
import { MAX_FINDINGS, TooManyFindingsError, toEvidence, toEvidenceList } from './payload'

const raw = {
  claim: 'example.com resolves to 93.184.216.34',
  sourceKey: 'dns_google',
  sourceUrl: 'https://dns.google/resolve',
  retrievedAt: '2026-08-10T09:00:00.000Z',
  admiralty: { source: 'A', info: 1 },
  confidence: 'confirmed',
  entity: { type: 'ip', value: '93.184.216.34' },
}

describe('toEvidence', () => {
  it('keeps the fields a dossier uses', () => {
    const e = toEvidence(raw)!
    expect(e.claim).toBe(raw.claim)
    expect(e.sourceKey).toBe('dns_google')
    expect(e.admiralty).toEqual({ source: 'A', info: 1 })
    expect(e.entity).toEqual({ type: 'ip', value: '93.184.216.34' })
  })

  /** Everything else in the request body is dropped, not carried along. */
  it('drops fields it was not asked for', () => {
    const e = toEvidence({ ...raw, data: { huge: 'payload' }, isAdmin: true }) as unknown as Record<
      string,
      unknown
    >
    expect(e.data).toBeUndefined()
    expect(e.isAdmin).toBeUndefined()
  })

  it('refuses a finding with no claim or no source', () => {
    expect(toEvidence({ ...raw, claim: '   ' })).toBeNull()
    expect(toEvidence({ ...raw, sourceKey: '' })).toBeNull()
    expect(toEvidence(null)).toBeNull()
    expect(toEvidence('a string')).toBeNull()
  })

  /** A bad timestamp would corrupt every "retrieved" date in the citations. */
  it('replaces an unparseable timestamp rather than printing a lie', () => {
    const e = toEvidence({ ...raw, retrievedAt: 'whenever' })!
    expect(Number.isFinite(Date.parse(e.retrievedAt))).toBe(true)
  })

  it('bounds every string it keeps', () => {
    const e = toEvidence({ ...raw, claim: 'x'.repeat(9_000), sourceKey: 'y'.repeat(500) })!
    expect(e.claim.length).toBe(4_000)
    expect(e.sourceKey.length).toBe(120)
  })

  it('ignores a malformed grade instead of half-reading it', () => {
    expect(toEvidence({ ...raw, admiralty: { source: 'A' } })!.admiralty).toBeUndefined()
    expect(toEvidence({ ...raw, admiralty: 'A1' })!.admiralty).toBeUndefined()
  })

  it('drops an entity with no value', () => {
    expect(toEvidence({ ...raw, entity: { type: 'ip' } })!.entity).toBeUndefined()
  })

  it('defaults an absent confidence to the weakest grade, never the strongest', () => {
    expect(toEvidence({ ...raw, confidence: undefined })!.confidence).toBe('unconfirmed')
  })
})

describe('toEvidenceList', () => {
  it('sanitises each entry and drops the unusable ones', () => {
    expect(toEvidenceList([raw, null, { claim: 'no source' }, raw])).toHaveLength(2)
  })

  it('treats anything that is not a list as no findings', () => {
    expect(toEvidenceList('nope')).toEqual([])
    expect(toEvidenceList(undefined)).toEqual([])
  })

  it('refuses more than a document could sensibly hold', () => {
    const many = Array.from({ length: MAX_FINDINGS + 1 }, () => raw)
    expect(() => toEvidenceList(many)).toThrow(TooManyFindingsError)
  })

  it('accepts exactly the limit', () => {
    const atLimit = Array.from({ length: MAX_FINDINGS }, () => raw)
    expect(toEvidenceList(atLimit)).toHaveLength(MAX_FINDINGS)
  })
})
