/** Real wiring for off-Pi auth over the repositories. */
import { repo } from '../db'
import type { ClaimDeps, StandaloneDeps } from './standalone'

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
  createUserAndCredential: async (email, passwordHash, username) => {
    const user = await repo.users.upsert({
      authProvider: 'standalone',
      externalId: email,
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
