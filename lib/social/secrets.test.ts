import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  decryptSecret,
  encryptSecret,
  isSecretStorageConfigured,
  MissingSecretKeyError,
} from './secrets'

const original = process.env.SOCIAL_SECRET_KEY

beforeEach(() => {
  process.env.SOCIAL_SECRET_KEY = 'a-test-key'
})
afterEach(() => {
  if (original === undefined) delete process.env.SOCIAL_SECRET_KEY
  else process.env.SOCIAL_SECRET_KEY = original
})

describe('secret storage', () => {
  it('round-trips a token', () => {
    const stored = encryptSecret('123456:ABC-bot-token')
    expect(stored).not.toContain('ABC-bot-token')
    expect(decryptSecret(stored)).toBe('123456:ABC-bot-token')
  })

  it('produces different ciphertext each time, so equal tokens are not equal at rest', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('refuses to encrypt with no key rather than storing plaintext', () => {
    delete process.env.SOCIAL_SECRET_KEY
    expect(isSecretStorageConfigured()).toBe(false)
    expect(() => encryptSecret('token')).toThrow(MissingSecretKeyError)
  })

  it('returns null for a token it cannot read, instead of throwing', () => {
    const stored = encryptSecret('token')
    process.env.SOCIAL_SECRET_KEY = 'a-rotated-key'
    expect(decryptSecret(stored)).toBeNull()
  })

  it('rejects tampered ciphertext — the authentication tag has to match', () => {
    const [iv, tag, data] = encryptSecret('token').split(':')
    const flipped = data.slice(0, -2) + (data.endsWith('00') ? '11' : '00')
    expect(decryptSecret([iv, tag, flipped].join(':'))).toBeNull()
  })

  it('returns null for malformed input', () => {
    expect(decryptSecret('')).toBeNull()
    expect(decryptSecret('nonsense')).toBeNull()
    expect(decryptSecret('a:b')).toBeNull()
  })
})
