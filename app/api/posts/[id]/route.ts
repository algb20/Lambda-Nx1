import { NextResponse } from 'next/server'
import { repo, isDbConfigured } from '@/lib/db'
import { toPublicPost } from '@/lib/post-mapper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/posts/:id — a single post by its permalink id (public + unlisted). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDbConfigured()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { id } = await params
  const post = await repo.posts.getById(id)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ post: toPublicPost(post) })
}

/** POST /api/posts/:id/like is handled here via ?action=like for simplicity. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDbConfigured()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const action = new URL(request.url).searchParams.get('action')
  if (action !== 'like') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  const { id } = await params
  const updated = await repo.posts.like(id)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ post: toPublicPost(updated) })
}
