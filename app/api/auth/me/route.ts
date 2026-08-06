import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { repo } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ user: null })
  const user = await repo.users.getById(userId)
  if (!user) return NextResponse.json({ user: null })
  return NextResponse.json({
    user: { id: user.id, username: user.displayName ?? user.externalId },
  })
}
