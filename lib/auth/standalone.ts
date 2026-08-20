/**
 * Off-Pi sign-in: one password credential reachable by two identifiers.
 *
 * An account can be signed into with an email address (accounts created here) or
 * with a **Pi Network username** (accounts created through Pi). The second one
 * needs a word of explanation, because the obvious implementation is a security
 * hole:
 *
 * Accepting a typed Pi username as proof of identity would let anyone sign in as
 * any Pi user — a username is public. So a Pi username is never *registered*
 * here. It can only be **claimed**: a user who has already passed Pi SDK
 * verification (so Pi itself vouched for them) sets a passphrase, and only then
 * does their username become a valid sign-in identifier. From that point they
 * can reach their account from any browser, which is what the Pi SDK alone
 * cannot give them — it only works inside the Pi Browser.
 *
 * Dependency-injected so all of this is testable without a database.
 */
import { hashPassword, verifyPassword } from './password'
import {
  MIN_PASSWORD_LENGTH,
  PI_USERNAME_RE,
  normalizeUsername,
  usernameError,
  usernameProblem,
} from './policy'

export interface CredentialRecord {
  userId: string
  passwordHash: string
}

export interface StandaloneDeps {
  findByEmail: (email: string) => Promise<CredentialRecord | undefined>
  findByPiUsername: (username: string) => Promise<CredentialRecord | undefined>
  /**
   * Resolve one of *our* handles to its credential.
   *
   * Distinct from `findByPiUsername`, which answers "who claimed this Pi
   * identity". Both are needed because the two live in one namespace but are
   * stored in different places: a Pi handle is a claim on the credentials row,
   * an off-Pi handle is the account's own column.
   */
  findByUsername: (username: string) => Promise<CredentialRecord | undefined>
  createUserAndCredential: (
    email: string,
    passwordHash: string,
    username: string,
    fullName: string | null,
  ) => Promise<{ userId: string }>
  /**
   * Whether this handle is already held. Advisory: two sign-ups racing on one
   * name would both be told no, so the database's unique constraint remains the
   * thing that actually decides.
   */
  usernameTaken: (username: string) => Promise<boolean>
}

export interface ResetDeps {
  findByEmail: (email: string) => Promise<CredentialRecord | undefined>
  setPassword: (userId: string, passwordHash: string) => Promise<void>
}

export interface ClaimDeps {
  /** The credential row for this user, if they already have one. */
  findByUserId: (userId: string) => Promise<CredentialRecord | undefined>
  /** Whoever already claimed this username, if anyone. */
  findByPiUsername: (username: string) => Promise<CredentialRecord | undefined>
  savePiCredential: (input: {
    userId: string
    piUsername: string
    passwordHash: string
  }) => Promise<void>
}

export { MIN_PASSWORD_LENGTH } from './policy'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizePiUsername(username: string): string {
  // Pi shows usernames with an @ in some places; accept it and strip it.
  return username.trim().toLowerCase().replace(/^@/, '')
}

export function isValidPiUsername(username: string): boolean {
  return PI_USERNAME_RE.test(normalizePiUsername(username))
}

export type Identifier =
  | { kind: 'email'; value: string }
  | { kind: 'pi'; value: string }
  | { kind: 'invalid' }

/**
 * Decide what the user typed into the single sign-in field. An "@" that is not a
 * leading one means they meant an email address; anything else is treated as a
 * Pi username. One field is deliberate — asking someone to first classify their
 * own identifier is a worse experience than working it out for them.
 */
export function classifyIdentifier(raw: string): Identifier {
  const trimmed = raw.trim()
  if (!trimmed) return { kind: 'invalid' }
  if (trimmed.replace(/^@/, '').includes('@')) {
    const email = normalizeEmail(trimmed)
    return EMAIL_RE.test(email) ? { kind: 'email', value: email } : { kind: 'invalid' }
  }
  const username = normalizePiUsername(trimmed)
  return PI_USERNAME_RE.test(username) ? { kind: 'pi', value: username } : { kind: 'invalid' }
}

/**
 * A real name is optional, capped, and stored exactly as typed apart from
 * trimming. Not validated beyond a length bound on purpose: names contain
 * apostrophes, hyphens, spaces, every script there is, and a single word is a
 * complete name for a great many people. A "name validator" is almost always a
 * list of the shapes its author's own name happens to take.
 */
export const FULL_NAME_MAX = 80

export function normalizeFullName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  if (trimmed.length > FULL_NAME_MAX) {
    throw new Error(`Name must be ${FULL_NAME_MAX} characters or fewer`)
  }
  return trimmed
}

export async function registerUser(
  email: string,
  password: string,
  username: string,
  deps: StandaloneDeps,
  fullName = '',
): Promise<{ userId: string }> {
  const normEmail = normalizeEmail(email)
  if (!EMAIL_RE.test(normEmail)) throw new Error('Invalid email address')
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }

  // The handle is validated before anything is written, and its rules are the
  // same ones a Pi username obeys — one namespace, so an off-Pi sign-up cannot
  // take a name that reads as somebody's Pi identity.
  const handle = normalizeUsername(username)
  const problem = usernameProblem(handle)
  if (problem) throw new Error(usernameError(problem))

  if (await deps.findByEmail(normEmail)) throw new Error('Email already registered')
  if (await deps.usernameTaken(handle)) throw new Error('That username is taken')

  return deps.createUserAndCredential(
    normEmail,
    hashPassword(password),
    handle,
    normalizeFullName(fullName),
  )
}

/**
 * Sign in with either identifier. The failure message is deliberately identical
 * for "no such account" and "wrong password", and for both identifier kinds, so
 * it cannot be used to discover which Pi usernames have accounts here.
 */
export async function loginUser(
  identifier: string,
  password: string,
  deps: StandaloneDeps,
): Promise<{ userId: string }> {
  const failure = new Error('Invalid sign-in details')
  const id = classifyIdentifier(identifier)
  if (id.kind === 'invalid') throw failure

  // A non-email identifier is a handle, and handles share one namespace across
  // both kinds of account. Try the Pi claim first — that is the stricter,
  // externally-verified one — then our own column, so someone who signed up
  // off-Pi can sign in with the name they chose rather than only their email.
  const cred =
    id.kind === 'email'
      ? await deps.findByEmail(id.value)
      : ((await deps.findByPiUsername(id.value)) ?? (await deps.findByUsername(id.value)))
  if (!cred || !verifyPassword(password, cred.passwordHash)) throw failure
  return { userId: cred.userId }
}

/**
 * Set a new password after a reset code has been proven.
 *
 * The caller must have already spent a valid code for this address — this
 * function assumes that and enforces everything else. It returns the user id so
 * the route can sign the person in immediately: a reset that ends at the login
 * screen asks someone to type the password they just chose, which is where they
 * mistype it and start again.
 *
 * A reset for an address with no account is a silent success. That is not
 * sloppiness: the request only got here by carrying a code we mailed to that
 * address, and answering differently would turn the reset form into the
 * membership oracle the whole flow is built to avoid.
 */
export async function resetPassword(
  email: string,
  password: string,
  deps: ResetDeps,
): Promise<{ userId: string } | null> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }
  const cred = await deps.findByEmail(normalizeEmail(email))
  if (!cred) return null
  await deps.setPassword(cred.userId, hashPassword(password))
  return { userId: cred.userId }
}

/**
 * Attach a passphrase to a Pi-verified account so its username becomes a valid
 * sign-in identifier elsewhere. The caller must already have proved, through the
 * Pi SDK, that this session owns this username — this function assumes that
 * check has happened and enforces everything else.
 */
export async function claimPiUsername(
  input: { userId: string; piUsername: string; password: string },
  deps: ClaimDeps,
): Promise<void> {
  const username = normalizePiUsername(input.piUsername)
  if (!isValidPiUsername(username)) throw new Error('Invalid Pi username')
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }

  const existing = await deps.findByPiUsername(username)
  if (existing && existing.userId !== input.userId) {
    // Two accounts cannot share a username. This should be unreachable, since
    // the username came from Pi's own verification, but a silent overwrite here
    // would hand one user's account to another.
    throw new Error('That Pi username is already linked to another account')
  }

  await deps.savePiCredential({
    userId: input.userId,
    piUsername: username,
    passwordHash: hashPassword(input.password),
  })
}
