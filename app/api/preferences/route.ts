import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured, repo } from '@/lib/db'
import { parsePrefs } from '@/lib/prefs/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/preferences — this account's stored layout, if it has one.
 *
 * Answers 200 with `signedIn: false` rather than 401 for a visitor. Someone
 * without an account is the *normal* case here — the gateways are open by
 * charter §1 — and their preferences live in their browser. Returning an error
 * on the ordinary path would put a red line in every console for no reason.
 */
export async function GET() {
  const userId = await getSessionUserId().catch(() => null)
  if (!userId || !isDbConfigured()) {
    return NextResponse.json({ signedIn: false, prefs: null })
  }
  try {
    const stored = await repo.users.getPreferences(userId)
    // Validated on the way out as well as in: this row may have been written by
    // a build with a different shape, and the browser should never have to
    // defend itself against its own server.
    return NextResponse.json({ signedIn: true, prefs: stored ? parsePrefs(stored) : null })
  } catch (error) {
    console.error(`[preferences] read failed: ${error instanceof Error ? error.message : error}`)
    return NextResponse.json({ signedIn: true, prefs: null })
  }
}

/**
 * PUT /api/preferences { prefs } — store this account's layout.
 *
 * The body goes through the same validator the browser uses, so what lands in
 * the column is a shape this build understands whatever was sent. That is not
 * suspicion of the user; it is what keeps a blob written today readable by a
 * build shipped next year.
 */
export async function PUT(request: Request) {
  const userId = await getSessionUserId().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }

  let body: { prefs?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const prefs = parsePrefs(body.prefs)
  try {
    await repo.users.setPreferences(userId, prefs)
    return NextResponse.json({ saved: true, prefs })
  } catch (error) {
    console.error(`[preferences] write failed: ${error instanceof Error ? error.message : error}`)
    return NextResponse.json({ error: 'Could not save preferences' }, { status: 502 })
  }
}
