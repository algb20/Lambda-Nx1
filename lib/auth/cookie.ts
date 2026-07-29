import type { NextResponse } from 'next/server'
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from './session'

/** Attach a fresh signed session cookie for `userId` to a response. */
export function attachSession(res: NextResponse, userId: string): void {
  res.cookies.set(SESSION_COOKIE, createSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}
