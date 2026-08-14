import { describe, it, expect } from 'vitest'
import {
  normalizeUsername,
  usernameProblem,
  usernameError,
  RESERVED_USERNAMES,
  PI_USERNAME_RE,
  USERNAME_RE,
} from './policy'

/**
 * A handle is the one piece of identity other people see, so the rules around
 * it are a security surface rather than a formatting preference: a name that
 * can be taken twice, or that reads as the platform's own, is how account
 * scams begin.
 */
describe('normalizeUsername', () => {
  it('lowercases and trims, and accepts the @ people type', () => {
    expect(normalizeUsername('  Lambda_NX ')).toBe('lambda_nx')
    expect(normalizeUsername('@pioneer')).toBe('pioneer')
    expect(normalizeUsername('@@pioneer')).toBe('pioneer')
  })

  it('makes two spellings of one name identical', () => {
    // Case-insensitive uniqueness is the whole point of a handle: seeing it
    // twice has to mean the same person.
    expect(normalizeUsername('Kamel')).toBe(normalizeUsername('kamel'))
  })
})

describe('usernameProblem', () => {
  it('accepts an ordinary handle', () => {
    expect(usernameProblem('kamel')).toBeNull()
    expect(usernameProblem('pioneer_99')).toBeNull()
    expect(usernameProblem('Analyst_1')).toBeNull() // normalised first
  })

  it('rejects empty and whitespace', () => {
    expect(usernameProblem('')).toBe('empty')
    expect(usernameProblem('   ')).toBe('empty')
    expect(usernameProblem('@')).toBe('empty')
  })

  it('enforces the length bounds', () => {
    expect(usernameProblem('ab')).toBe('too-short')
    expect(usernameProblem('abc')).toBeNull()
    expect(usernameProblem('a'.repeat(30))).toBeNull()
    expect(usernameProblem('a'.repeat(31))).toBe('too-long')
  })

  it('refuses anything outside lowercase letters, digits and underscore', () => {
    for (const bad of ['has space', 'has-dash', 'has.dot', 'has@at', 'émile', 'slash/es', 'a<b']) {
      expect(usernameProblem(bad), bad).toBe('charset')
    }
  })

  it('refuses names that impersonate the platform', () => {
    for (const name of ['admin', 'support', 'lambda', 'security', 'billing']) {
      expect(usernameProblem(name), name).toBe('reserved')
    }
  })

  it('refuses names that would shadow a route', () => {
    // A handle is meant to become a profile path; `privacy` or `api` as a
    // username would collide with a real page.
    for (const name of ['api', 'privacy', 'terms', 'settings', 'feed', 'globe']) {
      expect(usernameProblem(name), name).toBe('reserved')
    }
  })

  it('applies the reserved list after normalising, so casing cannot bypass it', () => {
    expect(usernameProblem('ADMIN')).toBe('reserved')
    expect(usernameProblem('@Admin')).toBe('reserved')
  })
})

describe('usernameError', () => {
  it('gives a sentence a person can act on for every problem', () => {
    const problems = ['empty', 'too-short', 'too-long', 'charset', 'reserved'] as const
    for (const p of problems) {
      const message = usernameError(p)
      expect(message.length, p).toBeGreaterThan(10)
      expect(message.endsWith('.'), p).toBe(true)
    }
  })

  it('says reserved rather than taken, which are different facts', () => {
    // "Unavailable" sends someone off to try variations forever.
    expect(usernameError('reserved')).toMatch(/reserved/i)
  })
})

describe('the shared namespace', () => {
  it('uses one shape for Pi and off-Pi handles', () => {
    // If the shapes differed, an off-Pi account could hold a name no Pi user
    // could — or one that reads as somebody else's Pi identity.
    expect(USERNAME_RE.source).toBe(PI_USERNAME_RE.source)
  })

  it('reserves every name in the list in a form the rule would otherwise allow', () => {
    // A reserved entry that could never be typed anyway is dead weight and
    // hides a real gap; every entry must be a name the charset rule accepts.
    for (const name of RESERVED_USERNAMES) {
      expect(USERNAME_RE.test(name), name).toBe(true)
    }
  })
})
