/**
 * Turning a verified Pi identity into an account in our namespace.
 *
 * Kept out of the route so the decisions can be tested without a database and
 * without a network — they are pure rules about names, and rules about names
 * are exactly the kind of thing that fails silently.
 */

import { normalizeUsername, usernameProblem } from './policy'
import type { AuthIdentity } from './types'

/**
 * The handle a pioneer should carry, or null if none can be taken.
 *
 * Reads `identity.username` — the name Pi issued — and never `externalId`,
 * which is Pi's opaque `uid`. That distinction is the whole point of this
 * function existing: the route used to read the uid, a UUID failed every
 * username rule, and every pioneer silently ended up with no handle at all.
 *
 * Returns null rather than throwing when the name cannot be used. A verified
 * pioneer must never be refused entry over a name they did not choose and
 * cannot change — they get in, and the handle is simply absent.
 */
export function piHandleFor(identity: Pick<AuthIdentity, 'username'>): string | null {
  if (!identity.username) return null
  const handle = normalizeUsername(identity.username)
  if (!handle) return null
  return usernameProblem(handle) === null ? handle : null
}

/**
 * Whether a database error is the unique-constraint violation on `username`.
 *
 * The collision is real and not rare in principle: someone can register a
 * handle off-Pi that a pioneer already holds on Pi, and the pioneer's next
 * sign-in would then hit the constraint. Sign-in failing over that would be
 * absurd — the pioneer is verified, the name is a nicety — so the caller
 * retries without the handle. Everything else must still propagate, because a
 * real database fault silently downgraded to "no handle" is a worse bug than
 * the one this fixes.
 *
 * Matched on Postgres's SQLSTATE 23505 plus the constraint's own name, so a
 * unique violation on some *other* column is not mistaken for this one.
 */
export function isUsernameConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  const message = String((error as { message?: unknown }).message ?? '')
  const text = `${(error as { constraint?: unknown }).constraint ?? ''} ${message}`.toLowerCase()
  return code === '23505' && text.includes('username')
}
