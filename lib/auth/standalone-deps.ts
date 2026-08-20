/** Real wiring for off-Pi auth over the repositories. */
import { repo } from '../db'
import type { ClaimDeps, ResetDeps, StandaloneDeps } from './standalone'
import type { VerificationStore } from './verification'

export const defaultStandaloneDeps: StandaloneDeps = {
  findByEmail: async (email) => {
    const cred = await repo.credentials.getByEmail(email)
    return cred ? { userId: cred.userId, passwordHash: cred.passwordHash } : undefined
  },
  findByPiUsername: async (username) => {
    const cred = await repo.credentials.getByPiUsername(username)
    return cred ? { userId: cred.userId, passwordHash: cred.passwordHash } : undefined
  },
  findByUsername: async (username) => {
    const user = await repo.users.getByUsername(username)
    if (!user) return undefined
    // A handle only signs anyone in if the account behind it has a password. A
    // Pi account that never claimed a passphrase has no credential row, and
    // must stay unreachable from the off-Pi form rather than matching on an
    // empty hash.
    const cred = await repo.credentials.getByUserId(user.id)
    return cred ? { userId: cred.userId, passwordHash: cred.passwordHash } : undefined
  },
  usernameTaken: async (username) => !(await repo.users.usernameAvailable(username)),
  createUserAndCredential: async (email, passwordHash, username, fullName) => {
    const user = await repo.users.upsert({
      authProvider: 'standalone',
      externalId: email,
      // Stored, never shown: `showRealName` defaults to false, so giving a name
      // at sign-up publishes nothing until its owner opens the eye.
      fullName,
      // The handle is what other people see, so it — not the email address —
      // is the display name. Showing an email address as a public identity
      // both looks wrong and leaks a contact detail the account never chose to
      // publish.
      displayName: username,
      username,
    })
    await repo.credentials.create({ userId: user.id, email, passwordHash })
    return { userId: user.id }
  },
}

export const defaultResetDeps: ResetDeps = {
  findByEmail: async (email) => {
    const cred = await repo.credentials.getByEmail(email)
    return cred ? { userId: cred.userId, passwordHash: cred.passwordHash } : undefined
  },
  setPassword: async (userId, passwordHash) => {
    await repo.credentials.setPassword(userId, passwordHash)
  },
}

/** The code store, over the repository. Shape-for-shape — no logic lives here. */
export const defaultVerificationStore: VerificationStore = {
  find: (email, purpose) => repo.verification.find(email, purpose),
  issue: (input) => repo.verification.issue(input),
  countAttempt: (id) => repo.verification.countAttempt(id),
  consume: (id) => repo.verification.consume(id),
  sweep: (now) => repo.verification.sweep(now),
}

export const defaultClaimDeps: ClaimDeps = {
  findByUserId: async (userId) => {
    const cred = await repo.credentials.getByUserId(userId)
    return cred ? { userId: cred.userId, passwordHash: cred.passwordHash } : undefined
  },
  findByPiUsername: async (username) => {
    const cred = await repo.credentials.getByPiUsername(username)
    return cred ? { userId: cred.userId, passwordHash: cred.passwordHash } : undefined
  },
  savePiCredential: async (input) => {
    await repo.credentials.upsertPiCredential(input)
  },
}
