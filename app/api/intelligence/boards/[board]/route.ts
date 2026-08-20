import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { recordRunSafely } from '@/lib/modules/history'
import { boardByKey, boardReport, BOARDS } from '@/lib/modules/board'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Resources fans out to eighteen series; orbital to two catalogue groups. */
export const maxDuration = 60

/**
 * POST /api/intelligence/boards/[board] { query? }
 *
 * Plural, and a sibling of `/api/intelligence/board` rather than a child of it:
 * that one is the markets board and this is seven other things, and nesting them
 * would read as though the courts were a section of the stock market.
 *
 * One route for seven gateways, and for the eighth when it arrives. The key
 * selects a board from `BOARDS`; nothing here knows what any of them contain.
 * A dynamic segment rather than seven near-identical files is the difference
 * between adding a gateway being a row of data and being a new stack.
 */
export async function POST(request: Request, context: { params: Promise<{ board: string }> }) {
  const { board: key } = await context.params
  const board = boardByKey(key)
  if (!board) {
    // Name the ones that exist. A bare 404 sends the caller to read source.
    return NextResponse.json(
      { error: `Unknown board "${key}". Available: ${BOARDS.map((b) => b.key).join(', ')}` },
      { status: 404 },
    )
  }

  let subject = ''
  try {
    const body = (await request.json()) as { query?: unknown }
    if (typeof body.query === 'string') subject = body.query
  } catch {
    // A board with no search takes no body at all, so an absent one is normal.
  }

  try {
    const report = await boardReport(board.key, board.capability, board.searchable ? subject : '')
    const userId = await getSessionUserId().catch(() => null)
    if (userId) {
      await recordRunSafely({ userId, gateway: board.key, subject, report })
    }
    return NextResponse.json({ ...report, title: board.title, note: board.note })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : `${board.title} fetch failed` },
      { status: 502 },
    )
  }
}
