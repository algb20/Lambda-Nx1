import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { repo, isDbConfigured } from '@/lib/db'
import { toPublicPost } from '@/lib/post-mapper'
import { postPermalink, type PublicPost } from '@/lib/posts'
import { Watermarked } from '@/components/watermark'
import { BrandMark } from '@/components/brand-mark'
import { PostShareBar } from '@/components/post-share-bar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function loadPost(id: string): Promise<PublicPost | null> {
  if (!isDbConfigured()) return null
  const row = await repo.posts.getById(id)
  return row ? toPublicPost(row) : null
}

async function origin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'lambda-nx.vercel.app'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const post = await loadPost(id)
  if (!post) return { title: 'Not found — Lambda NX' }
  const description = post.body.length > 200 ? `${post.body.slice(0, 197)}…` : post.body
  return {
    title: `${post.title} — Lambda NX`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      siteName: 'Lambda NX',
    },
    twitter: { card: 'summary', title: post.title, description },
  }
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await loadPost(id)
  if (!post) notFound()

  const permalink = postPermalink(await origin(), post.id)
  const date = new Date(post.createdAt).toISOString().slice(0, 10)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto max-w-2xl px-4 py-3">
          <a href="/" className="inline-flex items-center gap-2 text-primary">
            <BrandMark size={22} title="Lambda NX" />
            <span className="text-sm font-bold tracking-tight">Lambda NX</span>
          </a>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-6">
        <Watermarked className="rounded-xl border border-border bg-card p-6">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wide">{post.kind}</span>
            <span>{date}</span>
            {post.author ? <span>· {post.author}</span> : null}
          </div>
          <h1 className="text-2xl font-bold leading-tight">{post.title}</h1>
          <article className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
            {post.body}
          </article>
          {post.sourceUrl ? (
            <p className="mt-4 text-sm">
              <span className="text-muted-foreground">Source: </span>
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline break-all"
              >
                {post.sourceUrl}
              </a>
            </p>
          ) : null}
        </Watermarked>

        <PostShareBar post={post} permalink={permalink} className="mt-4" />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Published on Lambda NX — passive, lawful open-source intelligence.
        </p>
      </main>
    </div>
  )
}
