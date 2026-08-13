import { NextResponse } from 'next/server'
import { repo, isDbConfigured } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth/server'

/**
 * The signed-in account's own investigation history.
 *
 * `GET  /api/investigations?q=&gateway=&limit=&offset=` — list and search.
 * `DELETE /api/investigations?id=…`                     — forget one run.
 *
 * Everything here is scoped to the caller's own user id, and that scoping lives
 * inside the database query rather than in a check above it: a caller who
 * guesses another account's uuid gets nothing back and deletes nothing, because
 * the row was never selected in the first place.
 *
 * History belongs to the account, so an anonymous caller gets 401 rather than an
 * empty list — "you have no history" and "you are not signed in" are different
 * answers and the interface should not have to guess which it received.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 30

export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'History needs a database' }, { status: 503 })
  }
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in to see your history' }, { status: 401 })

  const url = new URL(request.url)
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  const offset = Number.parseInt(url.searchParams.get('offset') ?? '', 10)

  const rows = await repo.investigations.search(userId, {
    q: url.searchParams.get('q') ?? undefined,
    gateway: url.searchParams.get('gateway') ?? undefined,
    limit: Number.isFinite(limit) ? limit : DEFAULT_LIMIT,
    offset: Number.isFinite(offset) ? offset : 0,
  })

  return NextResponse.json(
    {
      entries: rows.map((r) => ({
        id: r.id,
        // A row written before history existed has no gateway; say so rather
        // than inventing one.
        gateway: r.gateway ?? 'investigation',
        subject: r.targetValue,
        findingCount: r.findingCount,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}

export async function DELETE(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'History needs a database' }, { status: 503 })
  }
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in to manage your history' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'Provide an "id".' }, { status: 400 })

  const removed = await repo.investigations.remove(userId, id)
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ removed: true })
}
