/**
 * Credential policy constants, kept in a module with no imports so the sign-in
 * and passphrase forms can state the same rules the server enforces. Importing
 * them from lib/auth/standalone would drag scrypt — and therefore node:crypto —
 * into the browser bundle, which does not build.
 */
export const MIN_PASSWORD_LENGTH = 8

/** Pi usernames are lowercase alphanumerics and underscores, 3–30 characters. */
export const PI_USERNAME_RE = /^[a-z0-9_]{3,30}$/

/**
 * The public handle every account carries.
 *
 * Deliberately the *same* shape as a Pi username, because the two live in one
 * namespace: a Pi pioneer arrives with a handle already chosen for them, and
 * someone signing up off-Pi picks one. If the two shapes differed, an off-Pi
 * user could take a form of a name that a Pi user could never hold — or worse,
 * a name that reads as someone else's Pi identity.
 *
 * Lowercase only, and stored lowercase. Case-insensitive uniqueness is the
 * point: `Lambda` and `lambda` must not be two people, because the whole
 * purpose of a handle is that seeing it twice means the same person.
 */
export const USERNAME_RE = PI_USERNAME_RE
export const USERNAME_MIN = 3
export const USERNAME_MAX = 30

/**
 * Handles nobody may register.
 *
 * Two kinds, and both matter. The first is impersonation of the platform —
 * `admin`, `support`, `lambda` — which is how account-recovery scams start. The
 * second is names that collide with our own routes: a handle is meant to become
 * `/@name` and a profile called `api` or `privacy` would shadow a real page.
 *
 * Reserved names are not "taken"; the error says they are reserved, because
 * telling someone a name is unavailable when it is actually forbidden sends
 * them off to try variations forever.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // The platform and its staff.
  'lambda', 'lambdanx', 'lambda_nx', 'admin', 'administrator', 'root', 'support',
  'help', 'security', 'moderator', 'mod', 'staff', 'team', 'official', 'system',
  'billing', 'payments', 'noreply', 'no_reply', 'postmaster', 'webmaster',
  // Anything that is, or could become, a route.
  //
  // Short route segments like `/p/` and `/me` are absent on purpose: they are
  // below the three-character minimum and so can never be registered anyway.
  // Listing them would imply the list is what protects them, hiding the fact
  // that the length rule is.
  'api', 'auth', 'login', 'logout', 'register', 'signup', 'signin', 'account',
  'settings', 'preferences', 'privacy', 'terms', 'about', 'contact', 'home',
  'feed', 'globe', 'map', 'search', 'explore', 'trending', 'radar', 'monitor',
  'intelligence', 'enterprise', 'personal', 'ideas', 'calibration', 'post',
  'posts', 'user', 'users', 'profile', 'new', 'edit', 'delete', 'static',
  'assets', 'public', 'health', 'status', 'cron', 'webhook', 'webhooks',
])

export type UsernameProblem =
  | 'empty'
  | 'too-short'
  | 'too-long'
  | 'charset'
  | 'reserved'

/** Lowercase and trim, accepting a leading `@` because people type one. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, '')
}

/**
 * Why this handle cannot be used, or null if it can.
 *
 * Returns the *reason* rather than a boolean so the form can say what to fix.
 * "Invalid username" tells a person nothing; "3–30 characters" tells them what
 * to type next.
 */
export function usernameProblem(raw: string): UsernameProblem | null {
  const name = normalizeUsername(raw)
  if (!name) return 'empty'
  if (name.length < USERNAME_MIN) return 'too-short'
  if (name.length > USERNAME_MAX) return 'too-long'
  if (!USERNAME_RE.test(name)) return 'charset'
  if (RESERVED_USERNAMES.has(name)) return 'reserved'
  return null
}

/** A sentence a person can act on. */
export function usernameError(problem: UsernameProblem): string {
  switch (problem) {
    case 'empty':
      return 'Choose a username.'
    case 'too-short':
      return `Usernames are at least ${USERNAME_MIN} characters.`
    case 'too-long':
      return `Usernames are at most ${USERNAME_MAX} characters.`
    case 'charset':
      return 'Usernames use lowercase letters, numbers and underscores only.'
    case 'reserved':
      return 'That username is reserved. Please choose another.'
  }
}
