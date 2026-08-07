/**
 * Credential policy constants, kept in a module with no imports so the sign-in
 * and passphrase forms can state the same rules the server enforces. Importing
 * them from lib/auth/standalone would drag scrypt — and therefore node:crypto —
 * into the browser bundle, which does not build.
 */
export const MIN_PASSWORD_LENGTH = 8

/** Pi usernames are lowercase alphanumerics and underscores, 3–30 characters. */
export const PI_USERNAME_RE = /^[a-z0-9_]{3,30}$/
