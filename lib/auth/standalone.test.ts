import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'
import {
  claimPiUsername,
  classifyIdentifier,
  isValidPiUsername,
  loginUser,
  normalizePiUsername,
  registerUser,
  type ClaimDeps,
  type CredentialRecord,
  type StandaloneDeps,
} from './standalone'

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

interface Store {
  byEmail: Record<string, CredentialRecord>
  byPi: Record<string, CredentialRecord>
  /** Our own handles — a different namespace slot from a claimed Pi username. */
  byHandle: Record<string, CredentialRecord>
}

function fakeDeps(seed: Partial<Store> = {}): { deps: StandaloneDeps; store: Store } {
  const store: Store = {
    byEmail: { ...seed.byEmail },
    byPi: { ...seed.byPi },
    byHandle: { ...seed.byHandle },
  }
  const deps: StandaloneDeps = {
    findByEmail: async (email) => store.byEmail[email],
    findByPiUsername: async (username) => store.byPi[username],
    findByUsername: async (username) => store.byHandle[username],
    usernameTaken: async (username) =>
      username in store.byHandle || username in store.byPi,
    createUserAndCredential: async (email, passwordHash, username) => {
      const userId = `user-${Object.keys(store.byEmail).length + 1}`
      const record = { userId, passwordHash }
      store.byEmail[email] = record
      store.byHandle[username] = record
      return { userId }
    },
  }
  return { deps, store }
}

describe('classifyIdentifier', () => {
  it('recognises an email address', () => {
    expect(classifyIdentifier('Name@Example.com')).toEqual({
      kind: 'email',
      value: 'name@example.com',
    })
  })

  it('recognises a Pi username, with or without the leading @', () => {
    expect(classifyIdentifier('pioneer_01')).toEqual({ kind: 'pi', value: 'pioneer_01' })
    expect(classifyIdentifier('@Pioneer_01')).toEqual({ kind: 'pi', value: 'pioneer_01' })
    expect(classifyIdentifier('  PIONEER  ')).toEqual({ kind: 'pi', value: 'pioneer' })
  })

  it('rejects what is neither', () => {
    expect(classifyIdentifier('').kind).toBe('invalid')
    expect(classifyIdentifier('   ').kind).toBe('invalid')
    expect(classifyIdentifier('no-at-sign@').kind).toBe('invalid')
    expect(classifyIdentifier('ab').kind).toBe('invalid') // too short for a username
    expect(classifyIdentifier('has spaces').kind).toBe('invalid')
    expect(classifyIdentifier('bad!chars').kind).toBe('invalid')
  })

  it('validates Pi username shape', () => {
    expect(isValidPiUsername('good_name9')).toBe(true)
    expect(isValidPiUsername('@Good_Name9')).toBe(true)
    expect(isValidPiUsername('no')).toBe(false)
    expect(isValidPiUsername('way_too_long_'.repeat(4))).toBe(false)
    expect(normalizePiUsername(' @MixedCase ')).toBe('mixedcase')
  })
})

describe('register', () => {
  it('creates a user for a valid email + password + handle', async () => {
    const { deps, store } = fakeDeps()
    const { userId } = await registerUser('New@Example.com', 'password123', 'Newcomer', deps)
    expect(userId).toBe('user-1')
    expect(store.byEmail['new@example.com']).toBeDefined() // normalized
    // The handle is normalised too, so it cannot be claimed twice by casing.
    expect(store.byHandle['newcomer']).toBeDefined()
  })

  it('rejects an invalid email, a short password and a duplicate', async () => {
    const { deps } = fakeDeps()
    await expect(registerUser('not-an-email', 'password123', 'someone', deps)).rejects.toThrow(
      /Invalid email/,
    )
    await expect(registerUser('a@b.com', 'short', 'someone', deps)).rejects.toThrow(/at least 8/)
    const dup = fakeDeps({ byEmail: { 'a@b.com': { userId: 'u1', passwordHash: hashPassword('x') } } })
    await expect(registerUser('a@b.com', 'password123', 'someone', dup.deps)).rejects.toThrow(
      /already registered/,
    )
  })

  it('rejects a handle that breaks the rules, before writing anything', async () => {
    const { deps, store } = fakeDeps()
    await expect(registerUser('a@b.com', 'password123', 'ab', deps)).rejects.toThrow(/at least 3/)
    await expect(registerUser('a@b.com', 'password123', 'has space', deps)).rejects.toThrow(
      /lowercase letters/,
    )
    await expect(registerUser('a@b.com', 'password123', 'admin', deps)).rejects.toThrow(/reserved/)
    // Nothing was created by any of the three attempts.
    expect(Object.keys(store.byEmail)).toHaveLength(0)
  })

  it('refuses a handle already held, including one claimed by a Pi user', async () => {
    const taken = fakeDeps({ byHandle: { pioneer: { userId: 'u1', passwordHash: 'x' } } })
    await expect(
      registerUser('a@b.com', 'password123', 'Pioneer', taken.deps),
    ).rejects.toThrow(/taken/)

    // One namespace: an off-Pi sign-up must not be able to take a name a Pi
    // pioneer already holds, or it could pass as them.
    const piHeld = fakeDeps({ byPi: { kamel: { userId: 'u2', passwordHash: 'x' } } })
    await expect(registerUser('a@b.com', 'password123', 'kamel', piHeld.deps)).rejects.toThrow(
      /taken/,
    )
  })

  /**
   * The security property of the whole feature: registration here can never mint
   * a Pi username credential, because nothing in this path has verified that the
   * caller owns it. Only claimPiUsername can, and only after Pi vouched.
   */
  it('cannot create a Pi-username credential', async () => {
    const { deps, store } = fakeDeps()
    await registerUser('someone@example.com', 'password123', 'someone', deps)
    expect(Object.keys(store.byPi)).toHaveLength(0)
  })
})

describe('login with either identifier', () => {
  const seeded = () =>
    fakeDeps({
      byEmail: { 'a@b.com': { userId: 'u1', passwordHash: hashPassword('password123') } },
      byPi: { pioneer_01: { userId: 'u2', passwordHash: hashPassword('pi-passphrase') } },
    })

  it('signs in with an email address', async () => {
    const { deps } = seeded()
    expect(await loginUser('A@B.com', 'password123', deps)).toEqual({ userId: 'u1' })
  })

  it('signs in with a claimed Pi username, however it is typed', async () => {
    const { deps } = seeded()
    expect(await loginUser('pioneer_01', 'pi-passphrase', deps)).toEqual({ userId: 'u2' })
    expect(await loginUser('@Pioneer_01', 'pi-passphrase', deps)).toEqual({ userId: 'u2' })
  })

  it('refuses a Pi username that was never claimed', async () => {
    const { deps } = seeded()
    await expect(loginUser('some_other_pioneer', 'anything', deps)).rejects.toThrow(
      /Invalid sign-in details/,
    )
  })

  it('signs in with the handle chosen at sign-up, not only the email', async () => {
    const { deps } = fakeDeps()
    await registerUser('new@example.com', 'password123', 'analyst_7', deps)
    expect(await loginUser('analyst_7', 'password123', deps)).toEqual({ userId: 'user-1' })
    expect(await loginUser('@Analyst_7', 'password123', deps)).toEqual({ userId: 'user-1' })
    // And the email still works — one account, two ways in.
    expect(await loginUser('new@example.com', 'password123', deps)).toEqual({ userId: 'user-1' })
  })

  it('prefers the Pi claim when a handle exists in both places', async () => {
    // Should be unreachable, since registration refuses a name a Pi user holds.
    // If it ever happens, the externally-verified claim must win rather than
    // the local column — otherwise a collision hands away a pioneer's account.
    const { deps } = fakeDeps({
      byPi: { shared: { userId: 'pi-user', passwordHash: hashPassword('pw-pi') } },
      byHandle: { shared: { userId: 'local-user', passwordHash: hashPassword('pw-local') } },
    })
    expect(await loginUser('shared', 'pw-pi', deps)).toEqual({ userId: 'pi-user' })
    await expect(loginUser('shared', 'pw-local', deps)).rejects.toThrow(/Invalid sign-in details/)
  })

  it('rejects a wrong password and an unknown account with the same message', async () => {
    const { deps } = seeded()
    const wrong = await loginUser('a@b.com', 'nope', deps).catch((e: Error) => e.message)
    const unknown = await loginUser('ghost@b.com', 'password123', deps).catch(
      (e: Error) => e.message,
    )
    const unknownPi = await loginUser('ghost_user', 'password123', deps).catch(
      (e: Error) => e.message,
    )
    // Identical messages: the endpoint must not reveal which Pi usernames or
    // emails have accounts here.
    expect(wrong).toBe(unknown)
    expect(unknown).toBe(unknownPi)
  })

  it('rejects a malformed identifier without touching the store', async () => {
    const { deps } = seeded()
    await expect(loginUser('!!', 'password123', deps)).rejects.toThrow(/Invalid sign-in details/)
  })
})

function fakeClaimDeps(seed: Record<string, CredentialRecord> = {}): {
  deps: ClaimDeps
  saved: Array<{ userId: string; piUsername: string; passwordHash: string }>
} {
  const byPi = { ...seed }
  const saved: Array<{ userId: string; piUsername: string; passwordHash: string }> = []
  const deps: ClaimDeps = {
    findByUserId: async (userId) => Object.values(byPi).find((c) => c.userId === userId),
    findByPiUsername: async (username) => byPi[username],
    savePiCredential: async (input) => {
      saved.push(input)
      byPi[input.piUsername] = { userId: input.userId, passwordHash: input.passwordHash }
    },
  }
  return { deps, saved }
}

describe('claimPiUsername', () => {
  it('links the username and stores only a hash', async () => {
    const { deps, saved } = fakeClaimDeps()
    await claimPiUsername({ userId: 'u1', piUsername: '@Pioneer_01', password: 'passphrase1' }, deps)
    expect(saved).toHaveLength(1)
    expect(saved[0].piUsername).toBe('pioneer_01') // normalized
    expect(saved[0].passwordHash).not.toContain('passphrase1')
    expect(verifyPassword('passphrase1', saved[0].passwordHash)).toBe(true)
  })

  it('lets the same user replace their passphrase', async () => {
    const { deps, saved } = fakeClaimDeps({
      pioneer_01: { userId: 'u1', passwordHash: hashPassword('old-one') },
    })
    await claimPiUsername({ userId: 'u1', piUsername: 'pioneer_01', password: 'new-passphrase' }, deps)
    expect(verifyPassword('new-passphrase', saved[0].passwordHash)).toBe(true)
  })

  /** Without this, claiming an already-linked username would hand over the account. */
  it('refuses to take a username already linked to somebody else', async () => {
    const { deps } = fakeClaimDeps({
      pioneer_01: { userId: 'u1', passwordHash: hashPassword('theirs') },
    })
    await expect(
      claimPiUsername({ userId: 'attacker', piUsername: 'pioneer_01', password: 'passphrase1' }, deps),
    ).rejects.toThrow(/already linked/)
  })

  it('rejects a malformed username or a weak passphrase', async () => {
    const { deps } = fakeClaimDeps()
    await expect(
      claimPiUsername({ userId: 'u1', piUsername: 'no', password: 'passphrase1' }, deps),
    ).rejects.toThrow(/Invalid Pi username/)
    await expect(
      claimPiUsername({ userId: 'u1', piUsername: 'pioneer_01', password: 'short' }, deps),
    ).rejects.toThrow(/at least 8/)
  })
})
