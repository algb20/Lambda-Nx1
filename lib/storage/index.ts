/**
 * lib/storage — the app's only storage entry point. Selects the provider by env
 * (STORAGE_PROVIDER, default 'filesystem'). An object-store provider (Supabase
 * Storage / S3) is registered here at deploy time without caller changes.
 */
import type { StorageProvider } from './types'
import { filesystemStorage } from './filesystem'
import { databaseStorage } from './database'
import { isDbConfigured } from '../db/client'

export * from './types'
export { deleteByPrefix } from './database'

/**
 * Which backend stores blobs.
 *
 * The default is **not** a constant, and that is the point. It used to be
 * `filesystem`, which is correct for a self-hosted box with a disk and silently
 * destructive on Netlify and Vercel, where a function's filesystem is
 * ephemeral: a profile picture uploaded during one request was gone by the next
 * deploy. Nothing reported an error — the upload returned 200, the database
 * kept a URL, and the image simply stopped resolving.
 *
 * So the default now follows the deployment. If a database is configured, blobs
 * go there, because a database is the one component of this platform that is
 * already durable and shared across instances. Only a deployment with no
 * database at all falls back to the local disk, where a local disk is the only
 * thing there is.
 *
 * `STORAGE_PROVIDER` still overrides both, for a self-hosted install that wants
 * its disk despite having a database.
 */
export function getStorageProvider(): StorageProvider {
  const name = process.env.STORAGE_PROVIDER ?? (isDbConfigured() ? 'database' : 'filesystem')
  switch (name) {
    case 'database':
      return databaseStorage
    case 'filesystem':
      return filesystemStorage
    default:
      throw new Error(
        `STORAGE_PROVIDER="${name}" is not configured. Available: database, filesystem.`,
      )
  }
}
