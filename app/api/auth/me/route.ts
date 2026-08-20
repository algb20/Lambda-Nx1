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
    user: {
      id: user.id,
      // The handle is the public identity. `displayName` and `externalId` are
      // fallbacks for accounts created before handles existed — and for an
      // off-Pi account externalId is an email address, which must never be
      // rendered as a public name.
      username: user.username ?? user.displayName ?? user.externalId,
      handle: user.username,
      plan: user.plan,
      avatarUrl: user.avatarUrl,
      provider: user.authProvider,
      // The caller is the owner of this account, so they see their own real
      // name whatever the switch says — the switch governs what *others* see.
      fullName: user.fullName,
      showRealName: user.showRealName,
    },
  })
}
