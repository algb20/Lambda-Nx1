/**
 * Maps a DB `posts` row to the public API shape. Kept out of the route file
 * because Next.js route modules may only export request handlers, and out of
 * lib/posts.ts so that (client-safe) module never pulls in the database layer.
 */
import type { Post } from '@/lib/db'
import type { PublicPost } from '@/lib/posts'

export function toPublicPost(p: Post, authorAvatarUrl: string | null = null): PublicPost {
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    body: p.body,
    author: p.authorName,
    authorAvatarUrl,
    sourceUrl: p.sourceUrl,
    refType: p.refType,
    refValue: p.refValue,
    locale: p.locale,
    visibility: p.visibility,
    likeCount: p.likeCount,
    repostCount: p.repostCount,
    createdAt: p.createdAt.toISOString(),
  }
}
