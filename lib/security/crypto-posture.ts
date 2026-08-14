/**
 * Post-quantum posture — what a large quantum computer would and would not break here.
 *
 * ## Why this is a module and not a paragraph in a document
 *
 * "Quantum-ready" is the easiest claim in security to make and the hardest to
 * check, so most products make it in marketing and nowhere else. The only
 * version worth anything is an inventory: every cryptographic primitive the
 * platform actually uses, what it protects, how long that thing must stay
 * protected, and which quantum algorithm — if any — applies to it. Written as
 * data, it can be tested; a test can then assert that no *new* primitive
 * appears without someone recording its exposure, which is the part a document
 * cannot do.
 *
 * ## The physics, in the two sentences that decide everything
 *
 * **Shor's algorithm** breaks the hard problems behind public-key cryptography
 * — factoring and discrete logarithms — outright. RSA, ECDSA, ECDH and
 * X25519 do not survive it at any key size; a bigger key buys a rounding error
 * of extra time, not safety.
 *
 * **Grover's algorithm** attacks unstructured search, and against a symmetric
 * primitive it costs a square root: 256-bit AES or a SHA-256 HMAC retains about
 * 128 bits of security, which is still beyond reach. Symmetric cryptography and
 * hash-based constructions are therefore *not* an emergency — they are already
 * fine, provided the key is long enough.
 *
 * That asymmetry is the whole plan. Where we can use a symmetric or hash-based
 * construction, we already have, and there is nothing to migrate. Where a
 * public-key primitive is unavoidable, the migration target is the NIST
 * standards — ML-KEM (FIPS 203) for key establishment, ML-DSA (FIPS 204) and
 * SLH-DSA (FIPS 205) for signatures.
 *
 * ## Harvest now, decrypt later
 *
 * The reason this cannot simply be deferred until a quantum computer exists:
 * traffic captured today can be stored and decrypted when one does. That makes
 * the deadline for any given secret **today minus how long it must stay
 * secret**, not the day the machine is built. It is why `retentionYears` is a
 * field here and why the audit sorts by it — a session cookie valid for thirty
 * days has no harvest-now exposure worth the name, and an archive intended to
 * be readable in fifteen years has a great deal.
 */

/** How a quantum computer would attack a primitive, if at all. */
export type QuantumExposure =
  /** Shor's algorithm breaks it outright. No key size helps. */
  | 'broken'
  /** Grover halves the effective key length. Survivable at adequate width. */
  | 'weakened'
  /** No known quantum speed-up beyond Grover, and the margin is already ample. */
  | 'unaffected'

export interface CryptoUse {
  /** Where it lives, so the claim can be checked against the code. */
  where: string
  /** What it protects. */
  protects: string
  /** The primitive, named precisely enough to be looked up. */
  primitive: string
  /** Effective classical security, in bits. */
  classicalBits: number
  exposure: QuantumExposure
  /**
   * How long the protected thing must remain secret, in years.
   *
   * The number that decides urgency, because captured traffic can be stored
   * until a machine exists. Zero means the secret is worthless once used.
   */
  retentionYears: number
  /** Why this primitive was chosen, and what it would move to if it had to. */
  note: string
}

/**
 * Every cryptographic primitive this platform uses.
 *
 * The list is deliberately exhaustive rather than selective. A posture that
 * names only the reassuring parts is worse than none, because it teaches a
 * reader to stop looking.
 */
export const CRYPTO_USES: CryptoUse[] = [
  {
    where: 'lib/auth/session.ts',
    protects: 'Session cookies — proof that a request comes from a signed-in account',
    primitive: 'HMAC-SHA256 over the session payload',
    classicalBits: 256,
    exposure: 'weakened',
    retentionYears: 0,
    note: 'Grover leaves ~128 bits, which is not a concern. A session is worthless the moment it expires, so there is no harvest-now exposure at all: an attacker who breaks a cookie in 2040 has broken a cookie that stopped working in 2026.',
  },
  {
    where: 'lib/alerts/delivery.ts',
    protects: 'Webhook deliveries — proof to a receiver that an alert came from us',
    primitive: 'HMAC-SHA256 over `v1:{timestamp}.{body}`',
    classicalBits: 256,
    exposure: 'weakened',
    retentionYears: 0,
    note: 'Symmetric by design, and the timestamp is inside the signed material, so a signature is valid for five minutes. Nothing to migrate — a hash-based MAC is already the post-quantum answer for authentication between parties that share a secret.',
  },
  {
    where: 'lib/alerts/delivery.ts',
    protects: 'Delivery identity — the receiver’s idempotency key',
    primitive: 'HMAC-SHA256 over the rule and subject ids',
    classicalBits: 256,
    exposure: 'unaffected',
    retentionYears: 0,
    note: 'Used as a stable identifier rather than as a secret. Forging one buys an attacker the ability to collide with a delivery they already had.',
  },
  {
    where: 'lib/engine/fetch-guard.ts (via the platform’s HTTPS stack)',
    protects: 'Traffic to the public data providers we read',
    primitive: 'TLS 1.3 — X25519 key agreement, AES-GCM or ChaCha20-Poly1305',
    classicalBits: 128,
    exposure: 'broken',
    retentionYears: 0,
    note: 'X25519 falls to Shor, and this is the one genuinely vulnerable primitive in the list. It is also the one carrying nothing secret: every byte we fetch is a public feed anyone can read, and we send no credentials to keyless providers. The migration is not ours to make — it is the hybrid X25519MLKEM768 exchange now shipping in browsers and CDNs, and we inherit it from the runtime.',
  },
  {
    where: 'lib/storage/database.ts',
    protects: 'Stored blobs — avatars',
    primitive: 'None; stored as bytes, protected by database access control',
    classicalBits: 0,
    exposure: 'unaffected',
    retentionYears: 0,
    note: 'No cryptography, so nothing to break. Named here because an inventory that omits the uncovered parts is the kind that gets someone hurt.',
  },
]

export interface PostureFinding {
  use: CryptoUse
  /**
   * Whether this needs work, and when.
   *
   * `urgent` is reserved for a Shor-broken primitive protecting something that
   * must outlive the machine. Everything else is either fine or a watch item,
   * and calling a watch item urgent is how a real one gets ignored.
   */
  urgency: 'urgent' | 'plan' | 'watch' | 'none'
  reason: string
}

/**
 * Years of protection beyond which harvest-now-decrypt-later is a real risk.
 *
 * Deliberately conservative rather than a bet on a date. Nobody knows when a
 * cryptographically relevant quantum computer arrives, and the whole point of
 * the harvest-now framing is that you do not need to know: you need to know how
 * long your secret must last.
 */
export const HARVEST_HORIZON_YEARS = 5

export function assessPosture(uses: CryptoUse[] = CRYPTO_USES): PostureFinding[] {
  return uses
    .map<PostureFinding>((use) => {
      if (use.exposure === 'broken') {
        if (use.retentionYears >= HARVEST_HORIZON_YEARS) {
          return {
            use,
            urgency: 'urgent',
            reason: `Shor breaks ${use.primitive}, and what it protects must stay secret for ${use.retentionYears} years — longer than the horizon this can safely be deferred past. Traffic captured today is readable later.`,
          }
        }
        return {
          use,
          urgency: 'plan',
          reason: `Shor breaks ${use.primitive}, but nothing it protects needs to stay secret (${use.retentionYears} years). The migration is a hygiene item, not an exposure.`,
        }
      }

      if (use.exposure === 'weakened') {
        // Grover halves it. 256 bits leaving 128 is fine; 128 leaving 64 is not.
        const remaining = use.classicalBits / 2
        return remaining >= 128
          ? {
              use,
              urgency: 'none',
              reason: `Grover leaves ${remaining} bits, which is beyond reach. Nothing to do.`,
            }
          : {
              use,
              urgency: 'plan',
              reason: `Grover leaves only ${remaining} bits. Widen the primitive before this matters.`,
            }
      }

      return { use, urgency: 'none', reason: 'No quantum algorithm applies to this use.' }
    })
    .sort((a, b) => {
      const order = { urgent: 0, plan: 1, watch: 2, none: 3 }
      return order[a.urgency] - order[b.urgency]
    })
}

export interface PostureSummary {
  uses: number
  urgent: number
  plan: number
  /** The posture in one sentence a non-specialist can act on. */
  headline: string
  findings: PostureFinding[]
}

export function cryptoPosture(uses: CryptoUse[] = CRYPTO_USES): PostureSummary {
  const findings = assessPosture(uses)
  const urgent = findings.filter((f) => f.urgency === 'urgent').length
  const plan = findings.filter((f) => f.urgency === 'plan').length

  const headline =
    urgent > 0
      ? `${urgent} of ${uses.length} cryptographic uses protect something for longer than a quantum-vulnerable primitive can be trusted to. These need migrating, not watching.`
      : `No quantum-vulnerable primitive here protects anything that has to outlast it. The platform authenticates with hash-based constructions, which Grover only halves — ${plan} item${plan === 1 ? '' : 's'} to tidy, nothing to rescue.`

  return { uses: uses.length, urgent, plan, headline, findings }
}
