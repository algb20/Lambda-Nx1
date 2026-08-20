import { describe, expect, it } from 'vitest'
import {
  CONFIRM_WINDOW_MS,
  SUBMIT_REPLY,
  confirmationExpired,
  mayReceive,
  normaliseEmail,
  type FollowerRow,
} from './subscription'

function row(over: Partial<FollowerRow> = {}): FollowerRow {
  return {
    email: 'reader@example.org',
    confirmedAt: new Date('2026-08-01T00:00:00Z'),
    unsubscribedAt: null,
    lastSentAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    ...over,
  }
}

describe('reading an address', () => {
  it('lowercases and trims, so one person cannot hold two subscriptions', () => {
    expect(normaliseEmail('  Reader@Example.ORG ')).toBe('reader@example.org')
  })

  it('refuses what is plainly not an address', () => {
    for (const bad of ['', '   ', 'reader', 'reader@', '@example.org', 'a b@example.org', 'reader@example']) {
      expect(normaliseEmail(bad)).toBeNull()
    }
  })

  it('refuses a domain that starts or ends with a dot', () => {
    expect(normaliseEmail('reader@.example.org')).toBeNull()
    expect(normaliseEmail('reader@example.org.')).toBeNull()
  })

  it('refuses two @ signs rather than guessing which one is meant', () => {
    expect(normaliseEmail('reader@else@example.org')).toBeNull()
  })

  /**
   * Deliberately permissive beyond the obvious cases: the RFC allows far more
   * than people expect, and the real test of an address is whether the
   * confirmation reaches it — which is the whole point of the flow.
   */
  it('accepts the odd but legal', () => {
    expect(normaliseEmail('first+tag@sub.example.co.uk')).toBe('first+tag@sub.example.co.uk')
  })

  it('refuses something absurdly long rather than storing it', () => {
    expect(normaliseEmail(`${'a'.repeat(250)}@example.org`)).toBeNull()
  })
})

/**
 * Every clause here is a way to mail somebody who did not ask, so each is
 * tested on its own rather than trusted to a single happy path.
 */
describe('who may be sent anything', () => {
  const edition = new Date('2026-08-20T06:00:00Z')

  it('sends to a confirmed, still-subscribed reader', () => {
    expect(mayReceive(row(), edition)).toBe(true)
  })

  it('never sends to an address that only ever got typed into the box', () => {
    expect(mayReceive(row({ confirmedAt: null }), edition)).toBe(false)
  })

  it('never sends to somebody who left', () => {
    expect(mayReceive(row({ unsubscribedAt: new Date('2026-08-10T00:00:00Z') }), edition)).toBe(false)
  })

  /** Schedulers fire twice. The reader should not receive the same brief twice. */
  it('does not send one edition to the same reader twice', () => {
    expect(mayReceive(row({ lastSentAt: edition }), edition)).toBe(false)
    expect(mayReceive(row({ lastSentAt: new Date('2026-08-20T07:00:00Z') }), edition)).toBe(false)
  })

  it('does send the next edition to somebody who got the last one', () => {
    expect(mayReceive(row({ lastSentAt: new Date('2026-08-19T06:00:00Z') }), edition)).toBe(true)
  })
})

describe('how long a pending confirmation lives', () => {
  const created = new Date('2026-08-01T00:00:00Z')

  it('is still good inside the window', () => {
    const now = new Date(created.getTime() + CONFIRM_WINDOW_MS - 1000)
    expect(confirmationExpired(row({ confirmedAt: null, createdAt: created }), now)).toBe(false)
  })

  it('has expired past it', () => {
    const now = new Date(created.getTime() + CONFIRM_WINDOW_MS + 1000)
    expect(confirmationExpired(row({ confirmedAt: null, createdAt: created }), now)).toBe(true)
  })

  it('never expires something already confirmed', () => {
    const now = new Date(created.getTime() + 5 * CONFIRM_WINDOW_MS)
    expect(confirmationExpired(row({ createdAt: created }), now)).toBe(false)
  })
})

/**
 * The subscribe box must not become a way to find out who reads us. Three
 * different outcomes, one sentence — and the sentence has to state the opt-in,
 * or a reader who never receives anything will think it is broken.
 */
describe('what the form says back', () => {
  it('promises nothing about whether the address was already known', () => {
    expect(SUBMIT_REPLY).not.toMatch(/already|existing|new|welcome back/i)
  })

  it('tells the reader that nothing arrives until they click', () => {
    expect(SUBMIT_REPLY).toMatch(/click/i)
  })
})
