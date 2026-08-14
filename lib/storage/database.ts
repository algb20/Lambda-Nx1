import { eq, like } from 'drizzle-orm'
import { getDb } from '../db/client'
import * as s from '@/db/schema'
import type { StorageProvider } from './types'

/**
 * Durable blob storage in Postgres.
 *
 * This exists because the filesystem default was silently wrong on the hosts
 * this app actually runs on. Netlify and Vercel give a function an ephemeral
 * disk: an avatar written during one request survives until the next deploy —
 * often only until the next cold start. Nothing failed visibly. The upload
 * returned 200, the users row kept a URL, and the picture simply stopped
 * resolving, so the user saw their initials come back with no error to explain
 * it. A storage provider that loses data without reporting a failure is worse
 * than one that refuses to write.
 *
 * The database is the one component here that is already durable, backed up and
 * shared by every instance, and avatars are capped at 2 MB. For that size, this
 * beats adding an object store: no new credential to leak or rotate, no vendor
 * to be locked into, and identical behaviour on every host. It sits behind the
 * same `StorageProvider` port as every other backend, so moving to S3 when the
 * objects get big stays a provider switch rather than an application change
 * (charter §4).
 *
 * The known limit, stated rather than discovered later: Postgres is not a CDN.
 * Large media belongs in an object store, and the port is what makes that a
 * one-file change when the time comes.
 */
export const databaseStorage: StorageProvider = {
  name: 'database',

  async put(key, data, contentType) {
    const db = getDb()
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    await db
      .insert(s.blobs)
      .values({ key, bytes, size: bytes.length, contentType: contentType ?? null })
      // Overwriting one key must replace the object rather than fail. Avatar
      // keys are versioned, so this is the rare re-put of an identical key —
      // but a storage port whose `put` can throw on a key that already exists
      // is a trap for every future caller.
      .onConflictDoUpdate({
        target: s.blobs.key,
        set: { bytes, size: bytes.length, contentType: contentType ?? null },
      })
    return { key, url: `/api/avatar/${key.replace(/^avatars\//, '')}` }
  },

  async get(key) {
    const db = getDb()
    const [row] = await db
      .select({ bytes: s.blobs.bytes })
      .from(s.blobs)
      .where(eq(s.blobs.key, key))
      .limit(1)
    return row ? row.bytes : null
  },

  async delete(key) {
    const db = getDb()
    await db.delete(s.blobs).where(eq(s.blobs.key, key))
  },
}

/**
 * Remove every object under a prefix.
 *
 * Not part of the `StorageProvider` port, because not every backend can do it
 * cheaply and a port should not promise what some implementations must emulate
 * with a full scan. Account deletion needs it: avatar keys are versioned, so a
 * user who changed their picture five times owns five objects, and deleting
 * only the one the `users` row happens to point at would leave the other four
 * behind forever — orphaned bytes of a person who asked to be erased.
 *
 * The prefix is escaped: `_` and `%` are LIKE wildcards, and a user id is
 * attacker-influenced in the general case.
 */
export async function deleteByPrefix(prefix: string): Promise<number> {
  if (!prefix) return 0
  const db = getDb()
  const escaped = prefix.replace(/([\\%_])/g, '\\$1')
  const rows = await db
    .delete(s.blobs)
    .where(like(s.blobs.key, `${escaped}%`))
    .returning({ key: s.blobs.key })
  return rows.length
}
