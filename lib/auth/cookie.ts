import type { NextResponse } from 'next/server'
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from './session'

/**
 * The cookie's shape, in one place.
 *
 * It was in two, and they had already drifted: `attachSession` set
 * `sameSite: 'lax'` and `secure` in production, and the logout route cleared it
 * with neither. Clearing still worked — a browser matches a cookie by name,
 * domain and path — but two definitions of one cookie is how the next attribute
 * gets set on the way in and forgotten on the way out, and this particular
 * cookie is the session.
 */
function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

/** Attach a fresh signed session cookie for `userId` to a response. */
export function attachSession(res: NextResponse, userId: string): void {
  res.cookies.set(SESSION_COOKIE, createSession(userId), sessionCookieOptions(SESSION_MAX_AGE))
}

/**
 * Clear it, with the same attributes it was set with.
 *
 * `maxAge: 0` and an empty value, which is how a cookie is deleted; the rest
 * matches `attachSession` so the two can never describe different cookies.
 */
export function clearSession(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0))
}
