import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The endpoint that tells the sign-in form what this deployment can offer.
 *
 * These exist because a single `emailSignUp: false` sent the owner chasing a
 * mail problem that did not exist. Mail was configured and working; there was
 * no database, so there was nowhere to store a user — and the form said "no
 * mail provider is configured". Days were lost to that one missing distinction.
 */

/**
 * `db` is "DATABASE_URL is set"; `live` is "the database answers". They are
 * different questions, and conflating them is the second version of the same
 * bug: with a URL set and the host unreachable, this endpoint said
 * `accounts: true`, the form offered sign-up, and pressing the button returned
 * an empty 500.
 */
const state = { db: false, live: true, sessions: false, mail: false }

vi.mock('@/lib/db', () => ({
  isDbConfigured: () => state.db,
  // Self-healing is exercised in lib/db/apply-schema.test.ts and against a real
  // database; here it only has to not be undefined.
  ensureSchema: async () => true,
  databaseAvailability: async () => ({
    live: state.live,
    detail: state.live ? null : 'connect ETIMEDOUT',
    hint: state.live ? null : 'check the pooler host',
    code: state.live ? null : 'ETIMEDOUT',
  }),
}))
vi.mock('@/lib/auth/session', () => ({ canIssueSessions: () => state.sessions }))
vi.mock('@/lib/mail', () => ({ mailConfigured: () => state.mail }))

// Imported lazily inside the helper: a top-level await here is fine for vitest
// but not for the project's tsc target, and the build must stay clean.
type MethodsBody = {
  accounts: boolean
  emailSignUp: boolean
  passwordReset: boolean
  pi: boolean
  emailSignUpOffBecause: string | null
}

async function methods(next: Partial<typeof state>): Promise<MethodsBody> {
  Object.assign(state, { db: false, live: true, sessions: false, mail: false }, next)
  const { GET } = await import('./route')
  return (await (await GET()).json()) as MethodsBody
}

beforeEach(() => Object.assign(state, { db: false, live: true, sessions: false, mail: false }))
afterEach(() => vi.clearAllMocks())

describe('naming the piece that is actually missing', () => {
  /** The exact live failure: mail perfect, no database, blamed on mail. */
  it('blames the database when mail is fine and there is nowhere to store a user', async () => {
    const m = await methods({ mail: true, sessions: true })
    expect(m.emailSignUp).toBe(false)
    expect(m.emailSignUpOffBecause).toBe('database')
  })

  it('blames mail only when mail is genuinely the missing piece', async () => {
    const m = await methods({ db: true, sessions: true })
    expect(m.emailSignUpOffBecause).toBe('mail')
  })

  it('names the session secret when that is what is absent', async () => {
    const m = await methods({ db: true, mail: true })
    expect(m.emailSignUpOffBecause).toBe('sessions')
  })

  it('blames nothing when everything is in place', async () => {
    const m = await methods({ db: true, sessions: true, mail: true })
    expect(m.emailSignUp).toBe(true)
    expect(m.passwordReset).toBe(true)
    expect(m.emailSignUpOffBecause).toBeNull()
  })

  /**
   * The database is the deeper dependency: with no store, mail is irrelevant.
   * Reporting the shallower cause would send the owner to fix the wrong thing
   * again, which is the whole failure being corrected here.
   */
  it('names the deeper cause first when several are missing', async () => {
    expect((await methods({})).emailSignUpOffBecause).toBe('database')
  })

  /** Pi never needs mail: Pi vouches for the identity itself. */
  it('offers Pi sign-in whenever accounts work, mail or no mail', async () => {
    expect((await methods({ db: true, sessions: true })).pi).toBe(true)
  })
})

describe('a database that is configured but not answering', () => {
  /**
   * The live failure, second edition. `DATABASE_URL` was set, the host was
   * unreachable, and this endpoint reported `accounts: true` because a set
   * string was the only thing it checked. The form then offered an account
   * nobody could create.
   */
  it('does not offer accounts when the database does not answer', async () => {
    const m = await methods({ db: true, live: false, sessions: true, mail: true })
    expect(m.accounts).toBe(false)
    expect(m.emailSignUp).toBe(false)
    expect(m.pi).toBe(false)
  })

  /**
   * A distinct reason, not the "no database" one. The two send an owner to
   * completely different actions: one is "set this up", the other is "something
   * you already set up has stopped answering".
   */
  it('says the database is unreachable rather than absent', async () => {
    const m = await methods({ db: true, live: false, sessions: true, mail: true })
    expect(m.emailSignUpOffBecause).toBe('database_unreachable')
  })

  it('still says "database" when there is genuinely no DATABASE_URL', async () => {
    const m = await methods({ db: false, live: false, sessions: true, mail: true })
    expect(m.emailSignUpOffBecause).toBe('database')
  })

  it('offers everything again the moment the database answers', async () => {
    const m = await methods({ db: true, live: true, sessions: true, mail: true })
    expect(m.accounts).toBe(true)
    expect(m.emailSignUpOffBecause).toBeNull()
  })
})
