/**
 * Signed session tokens (stateless). A token is `payload.signature` where the
 * signature is HMAC-SHA256 over the payload using SESSION_SECRET. No vendor
 * dependency — this is our own auth session, independent of any provider.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

interface SessionPayload {
  sub: string // user id
  exp: number // unix seconds
}

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is not set (needs a strong random string, 16+ chars).')
  }
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createSession(userId: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): string {
  const payloadObj: SessionPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** Return the user id if the token is valid and unexpired, else null. */
export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const providedSig = token.slice(dot + 1)

  const expectedSig = sign(payload)
  const a = Buffer.from(providedSig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionPayload
    if (typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') return null
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null
    return parsed.sub
  } catch {
    return null
  }
}

export const SESSION_COOKIE = 'lnx_session'
export const SESSION_MAX_AGE = DEFAULT_TTL_SECONDS
