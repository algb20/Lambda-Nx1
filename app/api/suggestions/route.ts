import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured, repo, type NewSuggestion } from '@/lib/db'
import { getSuggestionTriager } from '@/lib/ai/suggestions'
import {
  clusterAndRank,
  submitSuggestion,
  type SuggestionRepoPort,
  type SuggestionRow,
} from '@/lib/modules/suggestions'
import type { SuggestionKind } from '@/lib/ai/suggestions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Bridge lib/db repo.suggestions to the module's minimal storage port. */
const repoPort: SuggestionRepoPort = {
  async create(row) {
    return (await repo.suggestions.create(row as unknown as NewSuggestion)) as unknown as SuggestionRow
  },
  async list(limit) {
    return (await repo.suggestions.list(limit)) as unknown as SuggestionRow[]
  },
  async incrementVotes(id) {
    return (await repo.suggestions.incrementVotes(id)) as unknown as SuggestionRow | undefined
  },
}

const KINDS: SuggestionKind[] = ['feature', 'improvement', 'bug', 'integration', 'data_source', 'other']

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isDbConfigured())
    return NextResponse.json({ error: 'Suggestions store is not configured yet.' }, { status: 503 })

  let body: { title?: unknown; body?: unknown; kind?: unknown; locale?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const title = typeof body.title === 'string' ? body.title : ''
  const text = typeof body.body === 'string' ? body.body : ''
  const kind = typeof body.kind === 'string' && KINDS.includes(body.kind as SuggestionKind) ? (body.kind as SuggestionKind) : undefined
  const locale = typeof body.locale === 'string' ? body.locale : undefined

  try {
    const saved = await submitSuggestion(
      { repo: repoPort, triager: getSuggestionTriager() },
      { userId, title, body: text, kind, locale, submitterWeight: 1 },
    )
    return NextResponse.json(saved, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not submit suggestion' },
      { status: 400 },
    )
  }
}

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isDbConfigured()) return NextResponse.json({ clusters: [], total: 0, configured: false })

  const rows = await repoPort.list(300)
  const clusters = clusterAndRank(rows)
  return NextResponse.json({ clusters, total: rows.length, configured: true })
}
