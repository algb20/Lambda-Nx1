/** Real wiring for standalone auth over the repositories. */
import { repo } from '../db'
import type { StandaloneDeps } from './standalone'

export const defaultStandaloneDeps: StandaloneDeps = {
  findByEmail: async (email) => {
    const cred = await repo.credentials.getByEmail(email)
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
