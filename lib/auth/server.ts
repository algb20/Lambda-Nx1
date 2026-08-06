/**
 * Server-side session helpers for API routes. Reads the signed session cookie
 * and returns the authenticated user id (or null). Provider-agnostic.
 */
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from './session'

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value)
}
