/**
 * lib/storage — the app's only storage entry point. Selects the provider by env
 * (STORAGE_PROVIDER, default 'filesystem'). An object-store provider (Supabase
 * Storage / S3) is registered here at deploy time without caller changes.
 */
import type { StorageProvider } from './types'
import { filesystemStorage } from './filesystem'

export * from './types'

export function getStorageProvider(): StorageProvider {
  const name = process.env.STORAGE_PROVIDER ?? 'filesystem'
  switch (name) {
    case 'filesystem':
      return filesystemStorage
    default:
      throw new Error(
        `STORAGE_PROVIDER="${name}" is not configured. Available: filesystem (object-store added at deploy).`,
      )
  }
}
