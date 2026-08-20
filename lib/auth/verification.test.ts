import { describe, expect, it, beforeEach } from 'vitest'
import {
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  checkCode,
  generateCode,
  issueCode,
  looksLikeCode,
  normalizeCode,
  type StoredCode,
  type VerificationStore,
} from './verification'

/** An in-memory store with the same guarantees the SQL one has. */
function memoryStore(): VerificationStore & { rows: Map<string, StoredCode> } {
  const rows = new Map<string, StoredCode>()
  const key = (email: string, purpose: string) => `${email}::${purpose}`
  let seq = 0
  return {
    rows,
    async find(email, purpose) {
      return rows.get(key(email, purpose))
    },
    async issue(input) {
      const row: StoredCode = {
        id: `code-${++seq}`,
        email: input.email,
        purpose: input.purpose,
        codeHash: input.codeHash,
        attempts: 0,
        expiresAt: input.expiresAt,
        consumedAt: null,
        createdAt: new Date(input.expiresAt.getTime() - CODE_TTL_MINUTES * 60_000),
      }
      rows.set(key(input.email, input.purpose), row)
      return row
    },
    async countAttempt(id) {
      for (const row of rows.values()) {
        if (row.id === id) return (row.attempts += 1)
      }
      return 0
    },
    async consume(id) {
      for (const row of rows.values()) {
        if (row.id !== id) continue
        // The unconsumed predicate, mirrored: consuming twice must fail.
        if (row.consumedAt) return false
        row.consumedAt = new Date()
        return true
      }
      return false
    },
    async sweep(now) {
      let removed = 0
      for (const [k, row] of rows) {
        if (row.expiresAt <= now) {
          rows.delete(k)
          removed++
        }
      }
      return removed
    },
  }
}

const T0 = new Date('2026-08-15T10:00:00Z')

describe('generating a code', () => {
  it('is six digits', () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/)
    expect(CODE_LENGTH).toBe(6)
  })

  /**
   * Not a strong randomness test — it cannot be, in a unit test. It catches the
   * one failure that actually happens: a generator that returns a constant, or
   * one seeded per call so every user in the same second gets the same code.
   */
  it('does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 200 }, generateCode))
    expect(seen.size).toBeGreaterThan(190)
  })
})

describe('what a person actually types', () => {
  it('accepts a code copied with spaces or a hyphen', () => {
    expect(normalizeCode('  482 913 ')).toBe('482913')
    expect(normalizeCode('482-913')).toBe('482913')
  })

  /**
   * An Arabic keyboard produces ٤٨٢٩١٣, which are different code points from
   * 482913 and would never match a code we generated. The user would read the
   * right digits off the screen, type them, and be told they are wrong.
   */
  it('accepts Arabic-Indic digits, which are not the same characters', () => {
    expect(normalizeCode('٤٨٢٩١٣')).toBe('482913')
    expect(normalizeCode('۴۸۲۹۱۳')).toBe('482913')
  })

  it('rejects something that is not six digits before any database work', () => {
    expect(looksLikeCode('12345')).toBe(false)
    expect(looksLikeCode('abcdef')).toBe(false)
    expect(looksLikeCode('482913')).toBe(true)
  })
})

describe('issuing a code', () => {
  let store: ReturnType<typeof memoryStore>
  beforeEach(() => {
    store = memoryStore()
  })

  it('returns the plaintext once and stores only a hash of it', async () => {
    const result = await issueCode('a@example.com', 'signup', { store, now: () => T0 })
    expect(result.status).toBe('issued')
    if (result.status !== 'issued') return
    const row = await store.find('a@example.com', 'signup')
    expect(row?.codeHash).not.toContain(result.code)
    expect(row?.codeHash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/)
  })

  it('expires the code fifteen minutes out', async () => {
    const result = await issueCode('a@example.com', 'signup', { store, now: () => T0 })
    if (result.status !== 'issued') throw new Error('expected issue')
    expect(result.expiresAt.getTime() - T0.getTime()).toBe(CODE_TTL_MINUTES * 60_000)
  })

  /**
   * Without this an open sign-up form is a free mail cannon: type a stranger's
   * address, hold the button, and their inbox fills.
   */
  it('refuses a second send inside the cooldown', async () => {
    await issueCode('a@example.com', 'signup', { store, now: () => T0 })
    const again = await issueCode('a@example.com', 'signup', {
      store,
      now: () => new Date(T0.getTime() + 10_000),
    })
    expect(again.status).toBe('cooldown')
    if (again.status !== 'cooldown') return
    expect(again.retryAfterSeconds).toBe(50)
  })

  it('allows a resend once the cooldown has passed', async () => {
    await issueCode('a@example.com', 'signup', { store, now: () => T0 })
    const again = await issueCode('a@example.com', 'signup', {
      store,
      now: () => new Date(T0.getTime() + RESEND_COOLDOWN_MS + 1),
    })
    expect(again.status).toBe('issued')
  })

  it('keeps sign-up and reset codes apart for the same address', async () => {
    await issueCode('a@example.com', 'signup', { store, now: () => T0 })
    const reset = await issueCode('a@example.com', 'reset', { store, now: () => T0 })
    expect(reset.status).toBe('issued')
    expect(store.rows.size).toBe(2)
  })

  it('replaces the previous code rather than leaving two live', async () => {
    const first = await issueCode('a@example.com', 'signup', { store, now: () => T0 })
    const later = new Date(T0.getTime() + RESEND_COOLDOWN_MS + 1)
    await issueCode('a@example.com', 'signup', { store, now: () => later })
    if (first.status !== 'issued') throw new Error('expected issue')
    // The first code must no longer work.
    const check = await checkCode('a@example.com', 'signup', first.code, { store, now: () => later })
    expect(check.status).toBe('wrong')
  })

  it('sweeps expired rows while it is here', async () => {
    await issueCode('old@example.com', 'signup', { store, now: () => T0 })
    const muchLater = new Date(T0.getTime() + 60 * 60_000)
    await issueCode('new@example.com', 'signup', { store, now: () => muchLater })
    expect(await store.find('old@example.com', 'signup')).toBeUndefined()
  })
})

describe('checking a code', () => {
  let store: ReturnType<typeof memoryStore>
  const CODE = '482913'
  beforeEach(async () => {
    store = memoryStore()
    await issueCode('a@example.com', 'signup', { store, now: () => T0, makeCode: () => CODE })
  })

  it('accepts the right code', async () => {
    expect((await checkCode('a@example.com', 'signup', CODE, { store, now: () => T0 })).status).toBe('ok')
  })

  /**
   * A code that still works after it has been used is a code sitting in a
   * mailbox that can create a second account or reset a password again.
   */
  it('works exactly once', async () => {
    await checkCode('a@example.com', 'signup', CODE, { store, now: () => T0 })
    expect((await checkCode('a@example.com', 'signup', CODE, { store, now: () => T0 })).status).toBe('none')
  })

  it('refuses after it expires', async () => {
    const late = new Date(T0.getTime() + CODE_TTL_MINUTES * 60_000 + 1)
    expect((await checkCode('a@example.com', 'signup', CODE, { store, now: () => late })).status).toBe('expired')
  })

  it('counts wrong guesses and says how many are left', async () => {
    const first = await checkCode('a@example.com', 'signup', '000000', { store, now: () => T0 })
    expect(first).toEqual({ status: 'wrong', attemptsLeft: MAX_ATTEMPTS - 1 })
  })

  /**
   * Six digits is a keyspace of one million. Five guesses makes a blind attempt
   * a one-in-two-hundred-thousand shot; unlimited guesses makes it a certainty.
   */
  it('dies after five wrong guesses, and stays dead for the right code', async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await checkCode('a@example.com', 'signup', '000000', { store, now: () => T0 })
    }
    expect((await checkCode('a@example.com', 'signup', '000000', { store, now: () => T0 })).status).toBe('exhausted')
    expect((await checkCode('a@example.com', 'signup', CODE, { store, now: () => T0 })).status).toBe('exhausted')
  })

  /**
   * The counter is on the code, not the request, so an attacker cannot reset it
   * by moving to a new IP address.
   */
  it('keeps the attempt count on the code, not the caller', async () => {
    await checkCode('a@example.com', 'signup', '000000', { store, now: () => T0 })
    await checkCode('a@example.com', 'signup', '111111', { store, now: () => T0 })
    const row = await store.find('a@example.com', 'signup')
    expect(row?.attempts).toBe(2)
  })

  it('resets the attempt count when a new code is issued', async () => {
    await checkCode('a@example.com', 'signup', '000000', { store, now: () => T0 })
    const later = new Date(T0.getTime() + RESEND_COOLDOWN_MS + 1)
    await issueCode('a@example.com', 'signup', { store, now: () => later, makeCode: () => '555555' })
    const row = await store.find('a@example.com', 'signup')
    expect(row?.attempts).toBe(0)
  })

  it('says nothing is waiting for an address that never asked', async () => {
    expect((await checkCode('nobody@example.com', 'signup', CODE, { store, now: () => T0 })).status).toBe('none')
  })

  it('does not accept a sign-up code on the reset path', async () => {
    expect((await checkCode('a@example.com', 'reset', CODE, { store, now: () => T0 })).status).toBe('none')
  })

  it('accepts the code as the user typed it, spaced or in Arabic digits', async () => {
    expect((await checkCode('a@example.com', 'signup', '٤٨٢ ٩١٣', { store, now: () => T0 })).status).toBe('ok')
  })

  /**
   * Two requests arriving with the same correct code: exactly one may win, or
   * one of them creates an account the other then resets.
   */
  it('lets only one of two simultaneous correct checks through', async () => {
    const [a, b] = await Promise.all([
      checkCode('a@example.com', 'signup', CODE, { store, now: () => T0 }),
      checkCode('a@example.com', 'signup', CODE, { store, now: () => T0 }),
    ])
    expect([a.status, b.status].filter((s) => s === 'ok')).toHaveLength(1)
  })
})
