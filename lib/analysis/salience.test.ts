import { describe, it, expect } from 'vitest'
import {
  LEAD_THRESHOLD,
  leadFinding,
  rankFindings,
  scoreFinding,
  topicKey,
  whyLead,
} from './salience'
import type { Evidence } from '@/lib/engine/types'

const ev = (over: Partial<Evidence> = {}): Evidence => ({
  claim: 'a claim',
  sourceKey: 'src_a',
  retrievedAt: '2026-08-10T09:00:00.000Z',
  admiralty: { source: 'A', info: 1 },
  confidence: 'confirmed',
  ...over,
})

describe('topicKey', () => {
  it('treats the same entity as the same subject, whatever the wording', () => {
    const a = ev({ entity: { type: 'ip', value: '1.2.3.4' }, claim: 'resolves to 1.2.3.4' })
    const b = ev({ entity: { type: 'IP' as never, value: '1.2.3.4' }, claim: 'A record 1.2.3.4' })
    expect(topicKey(a)).toBe(topicKey(b))
  })

  it('falls back to the claim when there is no entity', () => {
    expect(topicKey(ev({ claim: 'Registrar is Example Inc' }))).toContain('registrar')
  })
})

describe('scoreFinding', () => {
  it('ranks a top-rated, corroborated, confirmed finding highest', () => {
    expect(scoreFinding(ev(), true)).toBe(100)
  })

  it('ranks an unrated, unconfirmed, uncorroborated finding lowest', () => {
    const weak = ev({ admiralty: undefined, confidence: 'unconfirmed' })
    expect(scoreFinding(weak, false)).toBeLessThan(scoreFinding(ev(), false))
  })

  it('prefers a more reliable source over a less reliable one', () => {
    const a = ev({ admiralty: { source: 'A', info: 2 } })
    const d = ev({ admiralty: { source: 'D', info: 2 } })
    expect(scoreFinding(a, false)).toBeGreaterThan(scoreFinding(d, false))
  })

  it('prefers more credible information from the same source grade', () => {
    const good = ev({ admiralty: { source: 'B', info: 1 } })
    const poor = ev({ admiralty: { source: 'B', info: 5 } })
    expect(scoreFinding(good, false)).toBeGreaterThan(scoreFinding(poor, false))
  })

  it('rewards corroboration', () => {
    expect(scoreFinding(ev(), true)).toBeGreaterThan(scoreFinding(ev(), false))
  })

  /** Unknown is not the same as bad; an ungraded source sits in the middle. */
  it('treats an ungraded source as unknown rather than worst', () => {
    const ungraded = scoreFinding(ev({ admiralty: undefined }), false)
    const worst = scoreFinding(ev({ admiralty: { source: 'F', info: 6 } }), false)
    const best = scoreFinding(ev({ admiralty: { source: 'A', info: 1 } }), false)
    expect(ungraded).toBeGreaterThan(worst)
    expect(ungraded).toBeLessThan(best)
  })

  it('never exceeds the scale', () => {
    expect(scoreFinding(ev(), true)).toBeLessThanOrEqual(100)
  })
})

describe('rankFindings', () => {
  it('puts the most significant finding first', () => {
    const ranked = rankFindings([
      ev({ claim: 'weak', admiralty: { source: 'E', info: 5 }, confidence: 'unconfirmed' }),
      ev({ claim: 'strong' }),
    ])
    expect(ranked[0].evidence.claim).toBe('strong')
  })

  it('marks a claim two independent sources reported as corroborated', () => {
    const entity = { type: 'ip' as const, value: '1.2.3.4' }
    const ranked = rankFindings([
      ev({ entity, sourceKey: 'src_a' }),
      ev({ entity, sourceKey: 'src_b' }),
      ev({ claim: 'alone', entity: { type: 'ip', value: '9.9.9.9' } }),
    ])
    expect(ranked.filter((r) => r.corroborated)).toHaveLength(2)
    expect(ranked.find((r) => r.evidence.claim === 'alone')?.corroborated).toBe(false)
  })

  /** The same source twice is not corroboration; that is one source repeating. */
  it('does not count one source reporting twice as corroboration', () => {
    const entity = { type: 'ip' as const, value: '1.2.3.4' }
    const ranked = rankFindings([
      ev({ entity, sourceKey: 'src_a' }),
      ev({ entity, sourceKey: 'src_a', claim: 'again' }),
    ])
    expect(ranked.every((r) => !r.corroborated)).toBe(true)
  })

  /** An analyst who reloads must not get a different "most important finding". */
  it('is deterministic when scores tie', () => {
    const items = [
      ev({ claim: 'x', sourceKey: 'src_b' }),
      ev({ claim: 'y', sourceKey: 'src_a' }),
    ]
    const first = rankFindings(items).map((r) => r.evidence.claim)
    const again = rankFindings([...items].reverse()).map((r) => r.evidence.claim)
    expect(first).toEqual(again)
  })

  it('breaks a tie on recency before source name', () => {
    const older = ev({ claim: 'older', sourceKey: 'src_a', retrievedAt: '2026-08-01T00:00:00.000Z' })
    const newer = ev({ claim: 'newer', sourceKey: 'src_z', retrievedAt: '2026-08-09T00:00:00.000Z' })
    expect(rankFindings([older, newer])[0].evidence.claim).toBe('newer')
  })

  it('returns everything it was given', () => {
    expect(rankFindings([ev(), ev({ claim: 'b' }), ev({ claim: 'c' })])).toHaveLength(3)
    expect(rankFindings([])).toEqual([])
  })
})

describe('leadFinding — promoting nothing is a valid answer', () => {
  it('promotes a clear standout', () => {
    const lead = leadFinding([
      ev({ claim: 'strong' }),
      ev({ claim: 'weak', admiralty: { source: 'E', info: 5 }, confidence: 'unconfirmed' }),
    ])
    expect(lead?.evidence.claim).toBe('strong')
  })

  /** Promoting the best of a uniformly weak set would be a false signal. */
  it('promotes nothing when the whole set is weak', () => {
    const weak = ev({ admiralty: { source: 'E', info: 5 }, confidence: 'unconfirmed' })
    expect(leadFinding([weak, { ...weak, claim: 'b' }])).toBeNull()
  })

  it('promotes nothing when the top two are indistinguishable', () => {
    expect(leadFinding([ev({ claim: 'a' }), ev({ claim: 'b' })])).toBeNull()
  })

  it('promotes nothing from a single finding, which has nothing to stand out from', () => {
    expect(leadFinding([ev()])).toBeNull()
    expect(leadFinding([])).toBeNull()
  })

  it('uses a threshold high enough to mean something', () => {
    expect(LEAD_THRESHOLD).toBeGreaterThan(50)
  })
})

describe('whyLead — the reason must be about grading, never about truth', () => {
  it('names the grade and the corroboration', () => {
    const reason = whyLead({ evidence: ev(), score: 100, corroborated: true })
    expect(reason).toContain('rated A1')
    expect(reason).toContain('two independent sources')
    expect(reason).toContain('confirmed')
  })

  it('still says something honest for an ungraded finding', () => {
    const reason = whyLead({
      evidence: ev({ admiralty: undefined, confidence: 'unconfirmed' }),
      score: 60,
      corroborated: false,
    })
    expect(reason).toBe('highest-graded finding in this set')
  })

  it('never asserts the claim is true', () => {
    const reason = whyLead({ evidence: ev(), score: 100, corroborated: true })
    expect(reason.toLowerCase()).not.toContain('true')
    expect(reason.toLowerCase()).not.toContain('verified')
  })
})
