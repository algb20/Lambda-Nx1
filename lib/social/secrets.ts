/**
 * Encryption for the one credential this feature has to keep: a Telegram bot
 * token. It cannot be hashed, because we need the original to call the API — so
 * it is encrypted at rest with AES-256-GCM under a key that lives only in the
 * environment, never in the database and never in the repository.
 *
 * If SOCIAL_SECRET_KEY is absent we refuse to store a secret at all. Storing a
 * token in plain text "for now" is exactly the temporary solution the charter
 * forbids, and the operator can still use every webhook platform meanwhile.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const SALT = 'lambda-nx/social-channel-secrets'

export class MissingSecretKeyError extends Error {
  constructor() {
    super(
      'SOCIAL_SECRET_KEY is not set. Channels that need a bot token cannot be stored until it is.',
    )
    this.name = 'MissingSecretKeyError'
  }
}

export function isSecretStorageConfigured(): boolean {
  return Boolean(process.env.SOCIAL_SECRET_KEY)
}

function key(): Buffer {
  const raw = process.env.SOCIAL_SECRET_KEY
  if (!raw) throw new MissingSecretKeyError()
  return scryptSync(raw, SALT, 32)
}

/** Encrypt to "ivHex:tagHex:cipherHex". */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), enc.toString('hex')].join(':')
}

/**
 * Decrypt a stored secret. Returns null rather than throwing when the value is
 * unreadable — a rotated key must degrade to "this channel stopped working",
 * which the dashboard reports, not to a crash on every publish.
 */
export function decryptSecret(stored: string): string | null {
  try {
    const [ivHex, tagHex, dataHex] = stored.split(':')
    if (!ivHex || !tagHex || !dataHex) return null
    const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}
