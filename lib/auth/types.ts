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
  /**
   * The public handle the provider itself issued, if it issues one.
   *
   * Separate from `externalId` on purpose, and the separation is not academic:
   * Pi's `/v2/me` returns **both** a `uid` (an opaque UUID, stable forever) and
   * a `username` (what the pioneer is called). They are different facts and
   * only one of them is a name. Collapsing them — taking whichever field
   * happened to be present as "the identity" — is how a verified pioneer ends
   * up with no handle at all: a UUID fails every username rule we have, so the
   * account was created and then silently carried no name.
   *
   * `externalId` answers "is this the same person as last time".
   * `username` answers "what do we call them".
   */
  username: string | null
  displayName: string | null
}

export interface AuthProvider {
  readonly name: AuthProviderName
  /** Verify a credential (e.g. an access token). Returns the identity, or null if invalid. */
  verify(credential: string): Promise<AuthIdentity | null>
}
