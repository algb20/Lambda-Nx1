'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Watermarked } from '@/components/watermark'
import { Avatar } from '@/components/avatar'
import { PostShareBar } from '@/components/post-share-bar'
import { api } from '@/lib/api'
import type { PublicPost } from '@/lib/posts'
import { TimeStamp } from '@/components/time-stamp'

/** One published item in the feed: content, λ watermark, like + share/copy/download. */
export function PostCard({ post }: { post: PublicPost }) {
  const [likes, setLikes] = useState(post.likeCount)
  const [liked, setLiked] = useState(false)
  const permalink = typeof window !== 'undefined' ? `${window.location.origin}/p/${post.id}` : `/p/${post.id}`

  async function like() {
    if (liked) return
    setLiked(true)
    setLikes((n) => n + 1)
    try {
      const { data } = await api.post<{ post: PublicPost }>(`/api/posts/${post.id}?action=like`)
      if (data?.post) setLikes(data.post.likeCount)
    } catch {
      // Roll back on failure so the count stays honest.
      setLiked(false)
      setLikes((n) => Math.max(0, n - 1))
    }
  }

  return (
    <Card className="p-4">
      <Watermarked>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wide">{post.kind}</span>
          <TimeStamp iso={post.createdAt} />
          {post.author ? (
            <span className="inline-flex items-center gap-1">
              · <Avatar src={post.authorAvatarUrl} name={post.author} size={16} /> {post.author}
            </span>
          ) : null}
          {/* Readers are entitled to know when the platform wrote something
              rather than a person. */}
          {post.refType === 'auto' ? (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">auto</span>
          ) : null}
        </div>
        <a href={`/p/${post.id}`} className="block">
          <h3 className="text-base font-semibold leading-snug hover:underline">{post.title}</h3>
        </a>
        <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-sm text-foreground/85">{post.body}</p>
        {post.sourceUrl ? (
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block break-all text-xs text-primary underline"
          >
            {post.sourceUrl}
          </a>
        ) : null}
      </Watermarked>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={like}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-rose-500"
          aria-pressed={liked}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
          {likes > 0 ? likes : ''}
        </button>
        <PostShareBar post={post} permalink={permalink} />
      </div>
    </Card>
  )
}
