import { describe, expect, it } from 'vitest'
import { BOARDS, boardByKey } from './board'
import { ALL_MODES, GATEWAY_GUIDANCE, GATEWAY_FAMILIES } from '@/lib/gateways'

/**
 * The boards are data, and the whole point of that is that adding the eighth is
 * a row rather than a stack. These assert the row is enough — that a board
 * cannot exist as a definition while being unreachable in the interface, or
 * appear in the interface with no definition behind it.
 */
describe('the board catalogue', () => {
  it('gives every board a gateway a user can actually open', () => {
    for (const b of BOARDS) {
      expect(ALL_MODES, `board "${b.key}" is not a gateway`).toContain(b.key)
    }
  })

  it('gives every board the guidance an empty gateway shows', () => {
    for (const b of BOARDS) {
      const guidance = GATEWAY_GUIDANCE[b.key as (typeof ALL_MODES)[number]]
      expect(guidance, `board "${b.key}" has no guidance`).toBeTruthy()
      // A limit that is not stated is a limit the reader discovers by being
      // wrong about something.
      expect(guidance.limit.length).toBeGreaterThan(30)
    }
  })

  it('files every board into exactly one family, so it is reachable', () => {
    for (const b of BOARDS) {
      const families = GATEWAY_FAMILIES.filter((f) => (f.modes as readonly string[]).includes(b.key))
      expect(families, `board "${b.key}" appears in ${families.length} families`).toHaveLength(1)
    }
  })

  it('uses each capability once — two boards on one capability would merge', () => {
    const capabilities = BOARDS.map((b) => b.capability)
    expect(new Set(capabilities).size).toBe(capabilities.length)
  })

  it('resolves a key, and refuses one it does not have', () => {
    expect(boardByKey('courts')?.capability).toBe('courts')
    expect(boardByKey('not-a-board')).toBeUndefined()
  })

  /**
   * The note is what a reader sees before any data arrives. A board whose note
   * does not say which publisher it reads is a board asking to be trusted on
   * nothing.
   */
  it('names what each board is, in a sentence', () => {
    for (const b of BOARDS) {
      expect(b.note.length, `board "${b.key}" has a thin note`).toBeGreaterThan(60)
      expect(b.title.length).toBeGreaterThan(4)
    }
  })
})
