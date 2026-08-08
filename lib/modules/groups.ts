/**
 * Groups — a small, deliberately bounded social layer.
 *
 * The rules live here rather than in the route or the schema, because they are
 * product decisions and product decisions need tests. The two that matter:
 *
 *  - **Two groups per owner.** A hard cap, checked on the owner's own count, not
 *    on their membership: joining other people's groups is unlimited, creating
 *    them is not. This is what stops one account minting a hundred groups.
 *  - **An owner cannot leave their own group.** They can hand it over or delete
 *    it; walking away would leave a group nobody can administer.
 *
 * Dependency-injected so all of it is testable without a database.
 */
export type GroupRole = 'owner' | 'admin' | 'member'
export type GroupVisibility = 'public' | 'private'

/** The cap. One number, one place. */
export const MAX_GROUPS_PER_OWNER = 2

export const NAME_MIN = 3
export const NAME_MAX = 60
export const DESCRIPTION_MAX = 500

export interface GroupRecord {
  id: string
  ownerUserId: string
  name: string
  slug: string
  visibility: GroupVisibility
  memberCount: number
}

export interface MemberRecord {
  groupId: string
  userId: string
  role: GroupRole
  blocked: boolean
}

export interface GroupDeps {
  countOwnedBy: (userId: string) => Promise<number>
  slugExists: (slug: string) => Promise<boolean>
  createGroup: (input: {
    ownerUserId: string
    name: string
    description: string | null
    slug: string
    visibility: GroupVisibility
    inviteCode: string
  }) => Promise<GroupRecord>
  getMembership: (groupId: string, userId: string) => Promise<MemberRecord | undefined>
  addMember: (groupId: string, userId: string, role: GroupRole) => Promise<void>
  setBlocked: (groupId: string, userId: string, blocked: boolean) => Promise<void>
  removeMember: (groupId: string, userId: string) => Promise<void>
  getGroup: (groupId: string) => Promise<GroupRecord | undefined>
}

export class GroupLimitError extends Error {
  constructor() {
    super(`You can create at most ${MAX_GROUPS_PER_OWNER} groups`)
    this.name = 'GroupLimitError'
  }
}

/**
 * A URL-safe handle from a display name. Non-Latin names (Arabic, for instance)
 * would slugify to nothing, so those fall back to a readable generated handle
 * rather than an empty string.
 */
export function slugify(name: string, fallbackSeed = ''): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  if (base.length >= 2) return base
  const seed = fallbackSeed.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()
  return `group-${seed || Math.abs(hashString(name)).toString(36).slice(0, 6)}`
}

/** Small, stable, non-cryptographic hash — only used to name things. */
function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h | 0
}

export function validateGroupInput(input: {
  name?: unknown
  description?: unknown
  visibility?: unknown
}): { ok: true; value: { name: string; description: string | null; visibility: GroupVisibility } } | { ok: false; error: string } {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return { ok: false, error: `The name must be ${NAME_MIN}–${NAME_MAX} characters` }
  }
  const description =
    typeof input.description === 'string' && input.description.trim()
      ? input.description.trim().slice(0, DESCRIPTION_MAX)
      : null
  const visibility: GroupVisibility = input.visibility === 'private' ? 'private' : 'public'
  return { ok: true, value: { name, description, visibility } }
}

/** A random, hard-to-guess join code. */
export function makeInviteCode(random: () => number = Math.random): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(random() * alphabet.length)]
  return out
}

/** Find a free slug, adding a suffix rather than failing on a common name. */
export async function uniqueSlug(
  name: string,
  deps: Pick<GroupDeps, 'slugExists'>,
  seed = '',
): Promise<string> {
  const base = slugify(name, seed)
  if (!(await deps.slugExists(base))) return base
  for (let i = 2; i <= 50; i++) {
    const candidate = `${base}-${i}`
    if (!(await deps.slugExists(candidate))) return candidate
  }
  // Fall back to something that cannot realistically collide.
  return `${base}-${makeInviteCode().slice(0, 5)}`
}

export async function createGroup(
  userId: string,
  input: { name?: unknown; description?: unknown; visibility?: unknown },
  deps: GroupDeps,
): Promise<GroupRecord> {
  const parsed = validateGroupInput(input)
  if (!parsed.ok) throw new Error(parsed.error)

  // The cap counts groups this user *owns*. Membership elsewhere is unlimited.
  if ((await deps.countOwnedBy(userId)) >= MAX_GROUPS_PER_OWNER) throw new GroupLimitError()

  const slug = await uniqueSlug(parsed.value.name, deps, userId)
  const group = await deps.createGroup({
    ownerUserId: userId,
    name: parsed.value.name,
    description: parsed.value.description,
    slug,
    visibility: parsed.value.visibility,
    inviteCode: makeInviteCode(),
  })
  // The owner is a member from the first moment, or the group has no members.
  await deps.addMember(group.id, userId, 'owner')
  return group
}

export async function joinGroup(
  groupId: string,
  userId: string,
  deps: GroupDeps,
): Promise<{ joined: boolean; reason?: string }> {
  const group = await deps.getGroup(groupId)
  if (!group) return { joined: false, reason: 'That group does not exist' }

  const existing = await deps.getMembership(groupId, userId)
  // A ban survives leaving and re-joining; that is the point of keeping the row.
  if (existing?.blocked) return { joined: false, reason: 'You cannot join this group' }
  if (existing) return { joined: false, reason: 'You are already a member' }

  await deps.addMember(groupId, userId, 'member')
  return { joined: true }
}

/** Can `actor` administer this group? Owners and admins only. */
export async function canModerate(
  groupId: string,
  actorUserId: string,
  deps: GroupDeps,
): Promise<boolean> {
  const membership = await deps.getMembership(groupId, actorUserId)
  if (!membership || membership.blocked) return false
  return membership.role === 'owner' || membership.role === 'admin'
}

export async function blockMember(
  groupId: string,
  actorUserId: string,
  targetUserId: string,
  deps: GroupDeps,
): Promise<void> {
  if (!(await canModerate(groupId, actorUserId, deps))) {
    throw new Error('Only an owner or admin can do that')
  }
  const target = await deps.getMembership(groupId, targetUserId)
  // The owner is not bannable from their own group, by anyone, including an
  // admin they appointed.
  if (target?.role === 'owner') throw new Error('The owner cannot be blocked')
  await deps.setBlocked(groupId, targetUserId, true)
}

export async function leaveGroup(
  groupId: string,
  userId: string,
  deps: GroupDeps,
): Promise<void> {
  const membership = await deps.getMembership(groupId, userId)
  if (!membership) throw new Error('You are not a member of that group')
  if (membership.role === 'owner') {
    // Leaving would strand the group with nobody able to administer it.
    throw new Error('An owner cannot leave their own group — transfer it or delete it')
  }
  await deps.removeMember(groupId, userId)
}
