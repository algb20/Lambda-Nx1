/**
 * One-time codes: proving an email address, and recovering an account.
 *
 * ## Why an account now needs a proven address
 *
 * Sign-up used to create the account the instant somebody typed an address into
 * the form. Two things follow from that, and both are real:
 *
 *  - A typo produces an account that can never be recovered, because recovery
 *    goes to an address its owner does not read.
 *  - Anyone can create an account on a stranger's address, and the stranger has
 *    no way to stop it. That is also how a product ends up sending mail people
 *    never asked for, which is how it ends up in spam folders permanently.
 *
 * So the address is proven before the account exists, not after.
 *
 * ## The four numbers, and why each is what it is
 *
 * - **Six digits.** Typed from a phone, read aloud, and — the reason it is
 *   digits and not letters — unambiguous in a right-to-left interface, where a
 *   mixed-case alphanumeric string is genuinely hard to transcribe correctly.
 * - **Fifteen minutes.** Long enough for mail to be delayed by a greylisting
 *   relay, short enough that a code sitting in an unattended inbox is not a
 *   standing key to the account.
 * - **Five attempts.** With a million possibilities, five guesses is a one in
 *   two hundred thousand chance. The counter is on the *code*, not the request,
 *   so retrying from a new address does not reset it.
 * - **Sixty seconds between sends.** Without it, an open sign-up form is a
 *   free mail cannon pointed at any address someone cares to type.
 *
 * ## What this deliberately never reveals
 *
 * Whether an address has an account here. `POST /api/auth/password/forgot`
 * answers identically either way. An account-recovery form that says "no such
 * user" is a membership oracle: point it at a list of addresses and it tells you
 * which of those people use the product. For an intelligence platform whose own
 * charter forbids building profiles of private individuals, shipping one on the
 * sign-in page would be indefensible.
 *
 * Dependency-injected, so all of the above is proven by tests rather than
 * asserted in a comment.
 */
import { randomInt } from 'node:crypto'
import { hashPassword, verifyPassword } from './password'

export const CODE_LENGTH = 6
export const CODE_TTL_MINUTES = 15
export const MAX_ATTEMPTS = 5
export const RESEND_COOLDOWN_MS = 60_000

export type VerificationPurpose = 'signup' | 'reset'

export interface StoredCode {
  id: string
  email: string
  purpose: VerificationPurpose
  codeHash: string
  attempts: number
  expiresAt: Date
  consumedAt: Date | null
  createdAt: Date
}

export interface VerificationStore {
  find(email: string, purpose: VerificationPurpose): Promise<StoredCode | undefined>
  issue(input: {
    email: string
    purpose: VerificationPurpose
    codeHash: string
    expiresAt: Date
  }): Promise<StoredCode>
  countAttempt(id: string): Promise<number>
  consume(id: string): Promise<boolean>
  sweep(now: Date): Promise<number>
}

export interface VerificationDeps {
  store: VerificationStore
  now?: () => Date
  /** Test seam. Production always uses the CSPRNG below. */
  makeCode?: () => string
}

/**
 * A uniformly random code.
 *
 * `randomInt` rather than `Math.random()` because this is a credential, and
 * rather than `randomBytes % 10` because the modulo of a byte over ten is not
 * uniform — digits 0–5 would appear 26/256 of the time and 6–9 only 25/256.
 * The bias is small and it is still a bias in a security value, which is the
 * kind of thing that is free to get right and embarrassing to get wrong.
 */
export function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += String(randomInt(0, 10))
  return code
}

export type IssueResult =
  | { status: 'issued'; code: string; expiresAt: Date }
  | { status: 'cooldown'; retryAfterSeconds: number }

/**
 * Mint a code for this address, replacing any previous one.
 *
 * The returned `code` is the only time the plaintext exists — it goes straight
 * into the email and is never written anywhere. The caller must not log it.
 */
export async function issueCode(
  email: string,
  purpose: VerificationPurpose,
  deps: VerificationDeps,
): Promise<IssueResult> {
  const now = (deps.now ?? (() => new Date()))()
  const existing = await deps.store.find(email, purpose)

  if (existing && !existing.consumedAt) {
    const age = now.getTime() - existing.createdAt.getTime()
    if (age < RESEND_COOLDOWN_MS) {
      return {
        status: 'cooldown',
        retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - age) / 1000),
      }
    }
  }

  const code = (deps.makeCode ?? generateCode)()
  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000)
  await deps.store.issue({ email, purpose, codeHash: hashPassword(code), expiresAt })
  // Opportunistic, and deliberately not awaited into the caller's latency
  // budget beyond this point: a failed sweep is housekeeping, not a reason to
  // fail a sign-up.
  await deps.store.sweep(now).catch(() => 0)
  return { status: 'issued', code, expiresAt }
}

export type CheckResult =
  | { status: 'ok' }
  /** No code was ever issued for this address, or it was already spent. */
  | { status: 'none' }
  | { status: 'expired' }
  | { status: 'wrong'; attemptsLeft: number }
  /** Too many wrong guesses — this code is dead and a new one must be sent. */
  | { status: 'exhausted' }

/**
 * Check a code and spend it.
 *
 * Verification and consumption are one operation on purpose. Separating them
 * gives a window in which a correct code has been confirmed but is still live,
 * and every use of this function is a step that must happen exactly once.
 */
export async function checkCode(
  email: string,
  purpose: VerificationPurpose,
  code: string,
  deps: VerificationDeps,
): Promise<CheckResult> {
  const now = (deps.now ?? (() => new Date()))()
  const record = await deps.store.find(email, purpose)
  if (!record || record.consumedAt) return { status: 'none' }
  if (record.expiresAt.getTime() <= now.getTime()) return { status: 'expired' }
  if (record.attempts >= MAX_ATTEMPTS) return { status: 'exhausted' }

  const cleaned = normalizeCode(code)
  if (!verifyPassword(cleaned, record.codeHash)) {
    const attempts = await deps.store.countAttempt(record.id)
    if (attempts >= MAX_ATTEMPTS) return { status: 'exhausted' }
    return { status: 'wrong', attemptsLeft: MAX_ATTEMPTS - attempts }
  }

  // Losing this race means another request already spent the code. Reporting it
  // as "none" rather than success is right: whichever request won has done the
  // work, and telling the loser it succeeded would let it act twice.
  const spent = await deps.store.consume(record.id)
  return spent ? { status: 'ok' } : { status: 'none' }
}

/**
 * Strip what people paste.
 *
 * A code copied from a mail client arrives with a trailing space; a code read
 * aloud is typed with a hyphen in the middle; a code typed on an Arabic keyboard
 * arrives as Arabic-Indic digits (٤٢٣…), which are not the same code points as
 * `4 2 3` and would otherwise never match a code we generated.
 */
export function normalizeCode(raw: string): string {
  let out = ''
  for (const char of raw.trim()) {
    const point = char.codePointAt(0) ?? 0
    // Arabic-Indic ٠-٩ (U+0660) and Extended Arabic-Indic ۰-۹ (U+06F0).
    if (point >= 0x0660 && point <= 0x0669) out += String(point - 0x0660)
    else if (point >= 0x06f0 && point <= 0x06f9) out += String(point - 0x06f0)
    else if (char >= '0' && char <= '9') out += char
  }
  return out
}

/** Whether a string could be a code at all, before any database work. */
export function looksLikeCode(raw: string): boolean {
  return normalizeCode(raw).length === CODE_LENGTH
}
