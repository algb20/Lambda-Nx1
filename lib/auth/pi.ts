import type { AuthProvider } from './types'

/**
 * Pi Network auth. Verifies a Pi access token against the Pi Platform API,
 * server-side. No secrets are needed to verify (the token is the credential).
 */
const PI_API_BASE = process.env.PI_API_BASE ?? 'https://api.minepi.com'

interface PiMe {
  uid?: string
  username?: string
}

export const piAuthProvider: AuthProvider = {
  name: 'pi',
  async verify(accessToken) {
    if (!accessToken) return null
    let res: Response
    try {
      res = await fetch(`${PI_API_BASE}/v2/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch {
      return null // network error — treat as unverified, never as authenticated
    }
    if (!res.ok) return null
    const me = (await res.json().catch(() => null)) as PiMe | null
    /**
     * `uid` first, because it is the fact that does not change. Pi's own
     * documentation is explicit that the username can be changed by the
     * pioneer while the uid is permanent, so keying an account on the username
     * would make a rename look like a brand-new person.
     *
     * The username is carried separately rather than folded in here — see the
     * note on `AuthIdentity.username` for what went wrong when it was not.
     */
    const externalId = me?.uid ?? me?.username
    if (!externalId) return null
    const username = typeof me?.username === 'string' && me.username.trim() ? me.username.trim() : null
    return { provider: 'pi', externalId, username, displayName: username }
  },
}
