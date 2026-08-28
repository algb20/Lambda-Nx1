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

/** The shortest secret we will sign with. Below this, HMAC is theatre. */
export const MIN_SESSION_SECRET_LENGTH = 16

/**
 * Whether a given value is a secret this module will actually sign with.
 *
 * Exported because the health probe has to answer the same question, and when
 * it answered it independently it answered differently: it checked presence, so
 * a six-character `SESSION_SECRET` reported "configured" while every sign-in
 * threw here. One predicate, both callers, no room for them to drift.
 */
export function isUsableSessionSecret(value: string | undefined): boolean {
  return typeof value === 'string' && value.length >= MIN_SESSION_SECRET_LENGTH
}

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!isUsableSessionSecret(s)) {
    throw new Error('SESSION_SECRET is not set (needs a strong random string, 16+ chars).')
  }
  return s as string
}

/**
 * Whether this deployment can issue sessions at all.
 *
 * Sign-up and sign-in have to ask *before* they do any work. Without it,
 * registration creates the user row, then throws while attaching the cookie —
 * so the account exists, the person is not signed in, and trying again tells
 * them the email is already taken. A misconfigured deployment must fail before
 * it writes, not after.
 */
export function canIssueSessions(): boolean {
  return isUsableSessionSecret(process.env.SESSION_SECRET)
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
