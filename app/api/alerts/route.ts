import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { repo } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  return NextResponse.json({ alerts: await repo.alerts.listByUser(userId) })
}
