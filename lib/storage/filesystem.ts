import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { StorageProvider } from './types'

/**
 * Filesystem storage — a real, working default for local dev and self-hosted
 * deployments with a writable disk. Serverless hosts (Netlify/Vercel) register
 * an object-store provider instead via getStorageProvider(); no caller changes.
 */
const RESOLVED_ROOT = path.resolve(
  process.env.STORAGE_DIR ?? path.join(process.cwd(), '.storage'),
)

function safePath(key: string): string {
  const full = path.resolve(RESOLVED_ROOT, key)
  if (full !== RESOLVED_ROOT && !full.startsWith(RESOLVED_ROOT + path.sep)) {
    throw new Error('Invalid storage key (path traversal blocked)')
  }
  return full
}

export const filesystemStorage: StorageProvider = {
  name: 'filesystem',
  async put(key, data) {
    const full = safePath(key)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, data)
    return { key, url: `file://${full}` }
  },
  async get(key) {
    try {
      const buf = await fs.readFile(safePath(key))
      return new Uint8Array(buf)
    } catch {
      return null
    }
  },
  async delete(key) {
    try {
      await fs.unlink(safePath(key))
    } catch {
      // already absent — deletion is idempotent
    }
  },
}
