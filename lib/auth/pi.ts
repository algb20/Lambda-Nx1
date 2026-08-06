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
    const externalId = me?.uid ?? me?.username
    if (!externalId) return null
    return { provider: 'pi', externalId, displayName: me?.username ?? null }
  },
}
