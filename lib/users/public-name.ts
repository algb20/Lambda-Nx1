/**
 * The one place that decides what an account is called in public.
 *
 * ## Why this is not just `user.displayName`
 *
 * Several surfaces independently wrote `user.displayName ?? user.externalId`,
 * and that last fallback is a mistake in both providers at once:
 *
 *  - For a **standalone** account, `externalId` is the **email address** the
 *    person signed up with. Rendering it as an author name publishes a contact
 *    detail the account never chose to publish.
 *  - For a **Pi** account, `externalId` is Pi's opaque `uid` — a UUID. It is
 *    not a leak, it is simply not a name, and showing it to a reader is worse
 *    than showing nothing.
 *
 * The fallback existed for accounts created before handles did, which is a real
 * case; the fix is to fall back to something that is *always* safe to show
 * rather than to a field that is safe in neither provider.
 */

/** The word shown for an account with no handle and no display name at all. */
export const ANONYMOUS_NAME = 'Member'

export interface NameableUser {
  username?: string | null
  displayName?: string | null
}

/**
 * What to call this account in public.
 *
 * Handle first, because the handle *is* the public identity — it is unique,
 * lowercase and stable, and seeing it twice means the same person. The display
 * name comes second for older accounts that predate handles. `externalId` is
 * deliberately not consulted; see the header.
 */
export function publicNameFor(user: NameableUser | null | undefined): string {
  const handle = user?.username?.trim()
  if (handle) return handle
  const shown = user?.displayName?.trim()
  if (shown) return shown
  return ANONYMOUS_NAME
}
