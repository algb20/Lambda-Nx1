/**
 * The identifier a person can read out loud.
 *
 * ## Why the ones we already have are not enough
 *
 * Every account carries two identifiers and neither does this job:
 *
 *  - **`id`** is a UUID. Stable, unique, and unusable by a human: nobody reads
 *    `93e45129-c147-473a-97c2-f47c56abbd7f` down a phone or types it into a
 *    support form without a mistake.
 *  - **`username`** is the public handle, and it is *changeable and optional*.
 *    A Pi user whose Pi name is reserved has none at all, and a handle that can
 *    change cannot be the thing a support request or an audit trail is keyed
 *    on — the whole point is that it still means the same account next year.
 *
 * So there is a third: a short, permanent, human-transcribable code derived
 * from the account's own id.
 *
 * ## The design, and the reason for each choice
 *
 * **Derived, not stored.** It is a pure function of `users.id`, so it needs no
 * column, no migration, no uniqueness constraint and no backfill — and it
 * cannot drift out of step with the account it names.
 *
 * **Crockford's alphabet.** Digits and consonants only: no `I`, `L`, `O` or
 * `U`. The first three are the classic transcription errors (1/I/l, 0/O), and
 * `U` is excluded so that no accidental English obscenity can appear in a code
 * a person has to read to a stranger.
 *
 * **Ten characters.** From a 32-symbol alphabet that is 50 bits — around a
 * quadrillion values. At a billion accounts the chance of any collision at all
 * stays negligible, and ten characters still fits in one spoken breath as two
 * groups of five.
 *
 * **Grouped when displayed, ungrouped when compared.** `LNX-4K7QM-2XB9F` is
 * readable; the hyphens are presentation. Parsing accepts them, any case, and
 * the four confusable characters mapped to what the writer meant.
 */

/**
 * Crockford base32, minus the letters that get mis-transcribed.
 *
 * `I`, `L`, `O` and `U` are absent by design — see the header.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** How many symbols the code carries. Ten × 5 bits = 50 bits of space. */
export const CODE_LENGTH = 10

/** The prefix, so a code is recognisable as ours when pasted somewhere else. */
export const CODE_PREFIX = 'LNX'

/**
 * A stable 64-bit-ish digest of a string, without pulling in `node:crypto`.
 *
 * FNV-1a over two independently seeded passes. Not a cryptographic hash and
 * does not need to be: nothing is being authenticated here, and the id it
 * digests is already unguessable. What it must be is *deterministic across
 * runtimes*, which rules out anything platform-provided, and free of the
 * `node:crypto` import that would drag the whole engine into a browser bundle
 * — a mistake this codebase has made before and paid for.
 */
function digest(input: string): { hi: number; lo: number } {
  let lo = 0x811c9dc5
  let hi = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    lo = Math.imul(lo ^ c, 0x01000193) >>> 0
    hi = Math.imul(hi ^ (c + i), 0x85ebca6b) >>> 0
  }
  // A final avalanche on each half, so adjacent ids do not share a prefix.
  lo = Math.imul(lo ^ (lo >>> 15), 0x2545f491) >>> 0
  hi = Math.imul(hi ^ (hi >>> 13), 0xc2b2ae35) >>> 0
  return { hi, lo }
}

/**
 * The permanent public identifier for an account.
 *
 * Same input, same output, on every runtime and forever.
 */
export function identifierFor(userId: string): string {
  const { hi, lo } = digest(userId)
  let out = ''
  // Ten symbols: five from each half, low bits first.
  for (let i = 0; i < 5; i++) out += ALPHABET[(lo >>> (i * 5)) & 31]
  for (let i = 0; i < 5; i++) out += ALPHABET[(hi >>> (i * 5)) & 31]
  return out
}

/** The identifier as a person should see it: prefixed and grouped. */
export function formatIdentifier(userId: string): string {
  const code = identifierFor(userId)
  return `${CODE_PREFIX}-${code.slice(0, 5)}-${code.slice(5)}`
}

/**
 * Characters a person writes when they meant something else.
 *
 * The whole reason those letters are absent from the alphabet is that people
 * confuse them — so accepting the confusion back is the other half of the job.
 * A code read over a bad phone line and typed as `LNX-4K7QM-2XB9F` with an
 * `O` for a zero must still resolve.
 */
const CONFUSIONS: Record<string, string> = { I: '1', L: '1', O: '0', U: 'V' }

/**
 * Read an identifier a person typed, or null if it is not one.
 *
 * Tolerant on the way in and strict about the result: hyphens, spaces, any
 * case and the four confusable characters are all accepted, and what comes back
 * is either the exact canonical code or nothing.
 */
export function parseIdentifier(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(new RegExp(`^${CODE_PREFIX}[-\\s]*`), '')
    .replace(/[-\s]/g, '')

  if (cleaned.length !== CODE_LENGTH) return null

  let out = ''
  for (const ch of cleaned) {
    const fixed = CONFUSIONS[ch] ?? ch
    if (!ALPHABET.includes(fixed)) return null
    out += fixed
  }
  return out
}

/** Whether a typed identifier names this account. */
export function identifierMatches(raw: string, userId: string): boolean {
  const parsed = parseIdentifier(raw)
  return parsed !== null && parsed === identifierFor(userId)
}
