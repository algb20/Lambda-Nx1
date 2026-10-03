/**
 * lib/auth — selects the Pi identity provider by env (AUTH_PROVIDER, default
 * 'pi'). Pi tokens are verified server-side through the provider returned here.
 *
 * Standalone email/password sign-in is not selected through this switch: it
 * runs alongside Pi, at the same time, through its own routes
 * (`/api/auth/login`, `/api/auth/register`, backed by `./standalone`). The two
 * identities coexist in one deployment; neither replaces the other.
 */
import type { AuthProvider } from './types'
import { piAuthProvider } from './pi'

export * from './types'

export function getAuthProvider(): AuthProvider {
  const name = process.env.AUTH_PROVIDER ?? 'pi'
  switch (name) {
    case 'pi':
      return piAuthProvider
    default:
      throw new Error(
        `AUTH_PROVIDER="${name}" is not a provider this switch selects. Available: pi. ` +
          'Standalone email/password sign-in needs no setting here: it runs alongside Pi ' +
          'through /api/auth/login and /api/auth/register.',
      )
  }
}
