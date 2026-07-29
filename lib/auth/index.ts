/**
 * lib/auth — the app's only auth entry point. Selects the provider by env
 * (AUTH_PROVIDER, default 'pi'). The standalone provider is registered here in
 * phase P12 without changing any screen or flow.
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
        `AUTH_PROVIDER="${name}" is not configured. Available: pi (standalone arrives in P12).`,
      )
  }
}
