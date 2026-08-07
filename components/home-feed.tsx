'use client'

import { useEffect, useState } from 'react'
import { Newspaper, Sparkles } from 'lucide-react'
import { Composer } from '@/components/composer'
import { PostCard } from '@/components/post-card'
import { TrendingBoard } from '@/components/trending-board'
import { XLikeFeed } from '@/components/x-like-feed'
import type { PublicPost } from '@/lib/posts'

type NavTab =
  | 'intelligence' | 'monitor' | 'ideas' | 'calibration' | 'globe' | 'preferences'

/**
 * The home — a publishing feed, the first thing on open. It leads with what's
 * happening (publish box, today's global trending, the community's posts) and
 * keeps the full gateway directory below so nothing that existed is lost. This
 * realizes the publishing home without redesigning the shell (charter §1).
 */
export function HomeFeed({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  const [posts, setPosts] = useState<PublicPost[] | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/posts?limit=30')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { posts: PublicPost[] }) => alive && setPosts(d.posts))
      .catch(() => alive && setPosts([]))
    return () => {
      alive = false
    }
  }, [])

  function onPublished(p: PublicPost) {
    setPosts((cur) => [p, ...(cur ?? [])])
  }

  return (
    <div className="space-y-4">
      <Composer onPublished={onPublished} />

      <TrendingBoard />

      {/* Published posts */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Latest from the community</h2>
        </div>

        {posts === null ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No posts yet. Be the first to publish a finding or a short piece of research.
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </section>

      {/* The gateway directory — everything the platform does, preserved. */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Explore the intelligence gateways</h2>
        </div>
        <XLikeFeed onNavigate={onNavigate} />
      </section>
    </div>
  )
}
