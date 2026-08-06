import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { repo } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function ownedMonitor(id: string, userId: string) {
  const monitor = await repo.monitors.getById(id)
  return monitor && monitor.userId === userId ? monitor : null
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await ctx.params
  if (!(await ownedMonitor(id, userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await repo.monitors.remove(id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await ctx.params
  if (!(await ownedMonitor(id, userId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: { status?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (body.status !== 'active' && body.status !== 'paused') {
    return NextResponse.json({ error: 'status must be "active" or "paused"' }, { status: 400 })
  }
  await repo.monitors.setStatus(id, body.status)
  return NextResponse.json({ ok: true })
}
