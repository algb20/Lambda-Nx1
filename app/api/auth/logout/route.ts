import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth/cookie'

export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  // Cleared through the same helper that sets it, so the two cannot describe
  // different cookies — this route used to spell the attributes out itself and
  // had already lost `sameSite` and `secure`.
  clearSession(res)
  return res
}
