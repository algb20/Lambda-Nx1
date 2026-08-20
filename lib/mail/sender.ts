/**
 * Reading a configured sender address well enough to diagnose it.
 *
 * Lives here rather than beside the route that uses it for a reason worth
 * recording: a Next.js route file may only export route handlers and a small
 * set of config fields. Exporting a helper from one — even a pure one, even to
 * test it — fails the build with "not a valid Route export field", and it does
 * so at build time only, so `tsc` and the unit suite both pass first. Anything
 * a route needs *and* a test needs belongs in a module like this one.
 */

export interface SenderShape {
  present: boolean
  /** The domain the address is on, which is the thing a provider verifies. */
  domain: string | null
  hasDisplayName: boolean
}

/**
 * Split a `MAIL_FROM` into the parts a diagnosis needs.
 *
 * Both `Lambda <no-reply@example.org>` and `no-reply@example.org` are valid
 * configurations, and the difference between "not set", "set but not an
 * address" and "set correctly" is three different repairs — so all three are
 * distinguishable in the result rather than collapsed into a boolean.
 */
export function senderShape(raw: string | undefined): SenderShape {
  const value = raw?.trim() ?? ''
  if (!value) return { present: false, domain: null, hasDisplayName: false }
  const address = value.match(/<([^>]+)>/)?.[1] ?? value
  const domain = address.includes('@') ? (address.split('@').pop() ?? '').toLowerCase() : null
  return { present: true, domain: domain || null, hasDisplayName: value.includes('<') }
}
