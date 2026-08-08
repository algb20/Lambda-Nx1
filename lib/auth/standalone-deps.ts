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
  createUserAndCredential: async (email, passwordHash) => {
    const user = await repo.users.upsert({
      authProvider: 'standalone',
      externalId: email,
      displayName: email,
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
