import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured, repo, type Group, type GroupMember } from '@/lib/db'
import {
  GroupLimitError,
  MAX_GROUPS_PER_OWNER,
  blockMember,
  createGroup,
  joinGroup,
  leaveGroup,
  type GroupDeps,
} from '@/lib/modules/groups'

/**
 * /api/groups — create, list, join, leave and moderate.
 *
 * The rules (two groups per owner, an owner cannot leave their own group, a
 * blocked member stays blocked) live in lib/modules/groups where they are
 * tested; this file is the plumbing between them and the repository.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Bridge the repository to the module's storage port. */
const deps: GroupDeps = {
  countOwnedBy: (userId) => repo.groups.countOwnedBy(userId),
  slugExists: (slug) => repo.groups.slugExists(slug),
  createGroup: async (input) => toRecord(await repo.groups.create(input)),
  getGroup: async (id) => {
    const g = await repo.groups.getById(id)
    return g ? toRecord(g) : undefined
  },
  getMembership: async (groupId, userId) => {
    const m = await repo.groups.getMembership(groupId, userId)
    return m ? toMember(m) : undefined
  },
  addMember: (groupId, userId, role) => repo.groups.addMember(groupId, userId, role),
  setBlocked: (groupId, userId, blocked) => repo.groups.setBlocked(groupId, userId, blocked),
  removeMember: (groupId, userId) => repo.groups.removeMember(groupId, userId),
}

function toRecord(g: Group) {
  return {
    id: g.id,
    ownerUserId: g.ownerUserId,
    name: g.name,
    slug: g.slug,
    visibility: g.visibility,
    memberCount: g.memberCount,
  }
}

function toMember(m: GroupMember) {
  return { groupId: m.groupId, userId: m.userId, role: m.role, blocked: m.blocked }
}

/** The public shape. The invite code is owner-only, never in a list. */
function toPublic(g: Group, viewerIsOwner: boolean) {
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    description: g.description,
    visibility: g.visibility,
    memberCount: g.memberCount,
    isOwner: viewerIsOwner,
    inviteCode: viewerIsOwner ? g.inviteCode : null,
    createdAt: g.createdAt.toISOString(),
  }
}

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ groups: [], canCreate: false, limit: MAX_GROUPS_PER_OWNER })
  const userId = await getSessionUserId()
  const groups = await repo.groups.listVisibleTo(userId)
  const owned = userId ? await repo.groups.countOwnedBy(userId) : 0
  return NextResponse.json({
    groups: groups.map((g) => toPublic(g, Boolean(userId) && g.ownerUserId === userId)),
    owned,
    limit: MAX_GROUPS_PER_OWNER,
    canCreate: Boolean(userId) && owned < MAX_GROUPS_PER_OWNER,
  })
}

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : 'create'
  const groupId = typeof body.groupId === 'string' ? body.groupId : ''

  try {
    switch (action) {
      case 'create': {
        const created = await createGroup(userId, body, deps)
        const full = await repo.groups.getById(created.id)
        return NextResponse.json({ group: full ? toPublic(full, true) : created }, { status: 201 })
      }
      case 'join': {
        if (!groupId) return NextResponse.json({ error: 'Missing groupId' }, { status: 400 })
        const result = await joinGroup(groupId, userId, deps)
        if (!result.joined) return NextResponse.json({ error: result.reason }, { status: 409 })
        return NextResponse.json({ ok: true })
      }
      case 'leave': {
        if (!groupId) return NextResponse.json({ error: 'Missing groupId' }, { status: 400 })
        await leaveGroup(groupId, userId, deps)
        return NextResponse.json({ ok: true })
      }
      case 'block': {
        const target = typeof body.userId === 'string' ? body.userId : ''
        if (!groupId || !target) {
          return NextResponse.json({ error: 'Missing groupId or userId' }, { status: 400 })
        }
        await blockMember(groupId, userId, target, deps)
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    // The cap is an expected outcome, not a server fault, so it gets its own code.
    const status = err instanceof GroupLimitError ? 409 : 400
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Request failed' },
      { status },
    )
  }
}
