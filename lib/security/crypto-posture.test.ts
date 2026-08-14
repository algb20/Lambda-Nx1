import { describe, expect, it } from 'vitest'
import {
  CRYPTO_USES,
  HARVEST_HORIZON_YEARS,
  assessPosture,
  cryptoPosture,
  type CryptoUse,
} from './crypto-posture'

function use(over: Partial<CryptoUse> = {}): CryptoUse {
  return {
    where: 'lib/example.ts',
    protects: 'Something',
    primitive: 'HMAC-SHA256',
    classicalBits: 256,
    exposure: 'weakened',
    retentionYears: 0,
    note: '',
    ...over,
  }
}

describe('the inventory itself', () => {
  it('names where every primitive lives, so the claim can be checked against code', () => {
    for (const u of CRYPTO_USES) {
      expect(u.where, `${u.primitive} does not say where it is used`).toMatch(/\.ts|HTTPS/)
      expect(u.protects.length).toBeGreaterThan(0)
    }
  })

  it('gives every use a reason, including the ones that need nothing', () => {
    // A posture naming only the reassuring parts teaches a reader to stop
    // looking, so the entries with nothing to fix still carry their argument.
    for (const u of CRYPTO_USES) {
      expect(u.note.length, `${u.where} has no note`).toBeGreaterThan(20)
    }
  })

  it('includes the uses that have no cryptography at all', () => {
    // An inventory that omits the uncovered parts is the kind that gets someone
    // hurt: the reader concludes everything is covered.
    expect(CRYPTO_USES.some((u) => u.primitive.toLowerCase().startsWith('none'))).toBe(true)
  })
})

describe('assessing exposure', () => {
  it('leaves a 256-bit hash-based MAC alone, because Grover only halves it', () => {
    const [finding] = assessPosture([use({ classicalBits: 256, exposure: 'weakened' })])
    expect(finding.urgency).toBe('none')
    expect(finding.reason).toMatch(/128 bits/)
  })

  it('flags a symmetric primitive too narrow to survive halving', () => {
    const [finding] = assessPosture([use({ classicalBits: 128, exposure: 'weakened' })])
    expect(finding.urgency).toBe('plan')
    expect(finding.reason).toMatch(/only 64 bits/)
  })

  it('calls a Shor-broken primitive urgent only when its secret must outlive it', () => {
    // The harvest-now framing: the deadline is set by how long the secret has
    // to last, not by when the machine arrives.
    const [urgent] = assessPosture([
      use({ exposure: 'broken', retentionYears: HARVEST_HORIZON_YEARS + 1 }),
    ])
    expect(urgent.urgency).toBe('urgent')
    expect(urgent.reason).toMatch(/captured today is readable later/)
  })

  it('does not cry wolf over a broken primitive that protects nothing lasting', () => {
    const [finding] = assessPosture([use({ exposure: 'broken', retentionYears: 0 })])
    expect(finding.urgency).toBe('plan')
    expect(finding.reason).toMatch(/hygiene item, not an exposure/)
  })

  it('puts the worst first, so a reader who stops early stops in the right place', () => {
    const findings = assessPosture([
      use({ where: 'a', exposure: 'unaffected' }),
      use({ where: 'b', exposure: 'broken', retentionYears: 20 }),
      use({ where: 'c', exposure: 'broken', retentionYears: 0 }),
    ])
    expect(findings.map((f) => f.urgency)).toEqual(['urgent', 'plan', 'none'])
  })
})

describe('the platform’s actual posture', () => {
  it('has nothing urgent — no vulnerable primitive guards a long-lived secret', () => {
    // The property this whole module exists to make checkable rather than
    // asserted. If someone adds RSA-signed long-lived tokens, this fails.
    const posture = cryptoPosture()
    expect(posture.urgent).toBe(0)
    expect(posture.headline).toMatch(/nothing to rescue/)
  })

  it('authenticates everything with hash-based constructions, not public keys', () => {
    const authUses = CRYPTO_USES.filter((u) => /proof|session|deliver/i.test(u.protects))
    expect(authUses.length).toBeGreaterThan(0)
    for (const u of authUses) {
      expect(u.primitive, `${u.where} authenticates with a public-key primitive`).toMatch(/HMAC/)
    }
  })

  it('admits the one primitive Shor does break, rather than omitting it', () => {
    const broken = CRYPTO_USES.filter((u) => u.exposure === 'broken')
    expect(broken.length).toBeGreaterThan(0)
    // And says honestly why it does not matter here.
    expect(broken[0].note).toMatch(/public feed|nothing secret/i)
  })

  it('does not claim credit for protecting something it stores in the clear', () => {
    const storage = CRYPTO_USES.find((u) => u.where.includes('storage'))!
    expect(storage.classicalBits).toBe(0)
    expect(storage.note).toMatch(/No cryptography/)
  })
})
