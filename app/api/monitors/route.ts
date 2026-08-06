import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { validateMonitorInput } from '@/lib/modules/monitors'
import { repo } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  return NextResponse.json({ monitors: await repo.monitors.listByUser(userId) })
}

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const input = validateMonitorInput(body)
    const monitor = await repo.monitors.create({ userId, ...input })
    return NextResponse.json({ monitor }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not create monitor' },
      { status: 400 },
    )
  }
}
