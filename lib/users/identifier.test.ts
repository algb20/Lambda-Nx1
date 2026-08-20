import { describe, expect, it } from 'vitest'
import {
  CODE_LENGTH,
  CODE_PREFIX,
  formatIdentifier,
  identifierFor,
  identifierMatches,
  parseIdentifier,
} from './identifier'

const UUID = '93e45129-c147-473a-97c2-f47c56abbd7f'

describe('the code itself', () => {
  it('is the stated length, from the stated alphabet', () => {
    const code = identifierFor(UUID)
    expect(code).toHaveLength(CODE_LENGTH)
    expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]+$/)
  })

  /**
   * The four excluded letters are the classic transcription errors — 1/I/l and
   * 0/O — plus `U`, so no accidental obscenity can appear in a code someone has
   * to read aloud to a stranger.
   */
  it('never emits a character people mis-transcribe', () => {
    // Enough codes that any of the four would show up if it could.
    for (let i = 0; i < 5000; i++) {
      expect(identifierFor(`user-${i}`)).not.toMatch(/[ILOU]/)
    }
  })

  it('gives the same account the same code, always', () => {
    expect(identifierFor(UUID)).toBe(identifierFor(UUID))
  })

  it('gives different accounts different codes', () => {
    const codes = new Set(Array.from({ length: 20_000 }, (_, i) => identifierFor(`user-${i}`)))
    // A collision or two in twenty thousand would be tolerable; a systematic
    // failure would not, and this is what catches one.
    expect(codes.size).toBeGreaterThan(19_990)
  })

  /** Adjacent ids must not share a prefix, or codes look sequential. */
  it('spreads adjacent ids apart rather than clustering them', () => {
    const a = identifierFor('user-1000')
    const b = identifierFor('user-1001')
    expect(a.slice(0, 4)).not.toBe(b.slice(0, 4))
  })

  it('handles an empty id without throwing', () => {
    expect(identifierFor('')).toHaveLength(CODE_LENGTH)
  })
})

describe('showing it to a person', () => {
  it('prefixes and groups it', () => {
    const shown = formatIdentifier(UUID)
    expect(shown).toMatch(new RegExp(`^${CODE_PREFIX}-[0-9A-Z]{5}-[0-9A-Z]{5}$`))
  })

  it('shows the same code the raw function produces', () => {
    expect(formatIdentifier(UUID).replace(/[^0-9A-Z]/g, '').slice(3)).toBe(identifierFor(UUID))
  })
})

describe('reading one back', () => {
  it('accepts exactly what it printed', () => {
    expect(parseIdentifier(formatIdentifier(UUID))).toBe(identifierFor(UUID))
  })

  it('accepts it without the prefix or the hyphens', () => {
    const code = identifierFor(UUID)
    expect(parseIdentifier(code)).toBe(code)
    expect(parseIdentifier(`${code.slice(0, 5)} ${code.slice(5)}`)).toBe(code)
  })

  it('ignores case and surrounding space', () => {
    expect(parseIdentifier(`  ${formatIdentifier(UUID).toLowerCase()}  `)).toBe(identifierFor(UUID))
  })

  /**
   * The other half of excluding those letters: a code read down a bad phone
   * line and typed with an O for a zero must still resolve.
   */
  it('forgives the confusions the alphabet exists to avoid', () => {
    const code = identifierFor(UUID)
    const withZero = code.indexOf('0')
    if (withZero >= 0) {
      const typo = code.slice(0, withZero) + 'O' + code.slice(withZero + 1)
      expect(parseIdentifier(typo)).toBe(code)
    }
    const withOne = code.indexOf('1')
    if (withOne >= 0) {
      const typo = code.slice(0, withOne) + 'I' + code.slice(withOne + 1)
      expect(parseIdentifier(typo)).toBe(code)
    }
  })

  it('rejects the wrong length rather than guessing', () => {
    expect(parseIdentifier('LNX-4K7')).toBeNull()
    expect(parseIdentifier('')).toBeNull()
    expect(parseIdentifier(identifierFor(UUID) + 'X')).toBeNull()
  })

  it('rejects a character that is not in the alphabet at all', () => {
    expect(parseIdentifier('!!!!!!!!!!')).toBeNull()
  })
})

describe('matching a typed code to an account', () => {
  it('matches the account it was made from', () => {
    expect(identifierMatches(formatIdentifier(UUID), UUID)).toBe(true)
    expect(identifierMatches(identifierFor(UUID).toLowerCase(), UUID)).toBe(true)
  })

  it('does not match another account', () => {
    expect(identifierMatches(formatIdentifier(UUID), 'some-other-id')).toBe(false)
  })

  it('does not match nonsense', () => {
    expect(identifierMatches('not a code', UUID)).toBe(false)
  })
})
