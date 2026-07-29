import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'
import { registerUser, loginUser, type StandaloneDeps } from './standalone'

describe('password hashing (scrypt)', () => {
  it('never stores the plaintext and verifies correctly', () => {
    const stored = hashPassword('correct horse battery staple')
    expect(stored).not.toContain('correct horse')
    expect(stored).toContain(':')
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true)
    expect(verifyPassword('wrong password', stored)).toBe(false)
  })

  it('produces a different salt each time', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'))
  })
})

function fakeDeps(seed: Record<string, { userId: string; passwordHash: string }> = {}): {
  deps: StandaloneDeps
  store: Record<string, { userId: string; passwordHash: string }>
} {
  const store = { ...seed }
  const deps: StandaloneDeps = {
    findByEmail: async (email) => store[email],
    createUserAndCredential: async (email, passwordHash) => {
      const userId = `user-${Object.keys(store).length + 1}`
      store[email] = { userId, passwordHash }
      return { userId }
    },
  }
  return { deps, store }
}

describe('standalone register', () => {
  it('creates a user for a valid email + password', async () => {
    const { deps, store } = fakeDeps()
    const { userId } = await registerUser('New@Example.com', 'password123', deps)
    expect(userId).toBe('user-1')
    expect(store['new@example.com']).toBeDefined() // normalized
  })

  it('rejects an invalid email', async () => {
    const { deps } = fakeDeps()
    await expect(registerUser('not-an-email', 'password123', deps)).rejects.toThrow(/Invalid email/)
  })

  it('rejects a short password', async () => {
    const { deps } = fakeDeps()
    await expect(registerUser('a@b.com', 'short', deps)).rejects.toThrow(/at least 8/)
  })

  it('rejects a duplicate email', async () => {
    const { deps } = fakeDeps({ 'a@b.com': { userId: 'u1', passwordHash: hashPassword('x') } })
    await expect(registerUser('a@b.com', 'password123', deps)).rejects.toThrow(/already registered/)
  })
})

describe('standalone login', () => {
  it('logs in with correct credentials', async () => {
    const { deps } = fakeDeps({ 'a@b.com': { userId: 'u1', passwordHash: hashPassword('password123') } })
    const { userId } = await loginUser('A@B.com', 'password123', deps)
    expect(userId).toBe('u1')
  })

  it('rejects a wrong password', async () => {
    const { deps } = fakeDeps({ 'a@b.com': { userId: 'u1', passwordHash: hashPassword('password123') } })
    await expect(loginUser('a@b.com', 'nope', deps)).rejects.toThrow(/Invalid email or password/)
  })

  it('rejects an unknown email', async () => {
    const { deps } = fakeDeps()
    await expect(loginUser('ghost@b.com', 'password123', deps)).rejects.toThrow(/Invalid email or password/)
  })
})
