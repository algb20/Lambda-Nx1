import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { repo } from '@/lib/db'
import { publicNameFor } from '@/lib/users/public-name'

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
      // The handle is the public identity; `displayName` covers accounts made
      // before handles existed. `externalId` is deliberately not a fallback —
      // it is an email address off-Pi and an opaque uid on Pi, so it is a leak
      // in one case and gibberish in the other. See lib/users/public-name.
      username: publicNameFor(user),
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
