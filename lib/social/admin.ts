/**
 * Admin gate for the social routes.
 *
 * Reuses the ADMIN_SECRET convention already used by the private usage
 * registry — one operator credential, held in the environment, never a role in
 * the users table. Kept here so both social routes enforce it identically.
 */
export function adminAuthorized(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const provided =
    request.headers.get('x-admin-secret') ?? new URL(request.url).searchParams.get('secret') ?? ''
  return provided.length === secret.length && provided === secret
}

/** The standard refusal, so no route invents its own wording or status. */
export function adminGate(request: Request): Response | null {
  if (!process.env.ADMIN_SECRET) {
    return Response.json({ error: 'ADMIN_SECRET is not configured' }, { status: 503 })
  }
  if (!adminAuthorized(request)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
