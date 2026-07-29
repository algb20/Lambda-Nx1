/**
 * Auth port. App code depends on this interface, never on a specific provider,
 * so Pi (inside Pi Browser) and standalone (email/OAuth) are interchangeable
 * (charter rule #4).
 */
export type AuthProviderName = 'pi' | 'standalone'

export interface AuthIdentity {
  provider: AuthProviderName
  /** Stable, provider-unique id (maps to users.external_id). */
  externalId: string
  displayName: string | null
}

export interface AuthProvider {
  readonly name: AuthProviderName
  /** Verify a credential (e.g. an access token). Returns the identity, or null if invalid. */
  verify(credential: string): Promise<AuthIdentity | null>
}
