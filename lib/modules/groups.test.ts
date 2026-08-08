import { describe, it, expect, vi } from 'vitest'
import {
  GroupLimitError,
  MAX_GROUPS_PER_OWNER,
  blockMember,
  canModerate,
  createGroup,
  joinGroup,
  leaveGroup,
  makeInviteCode,
  slugify,
  uniqueSlug,
  validateGroupInput,
  type GroupDeps,
  type GroupRecord,
  type MemberRecord,
} from './groups'

/** A tiny in-memory store shaped like the real repository. */
function fakeDeps(seed: { groups?: GroupRecord[]; members?: MemberRecord[] } = {}) {
  const groups: GroupRecord[] = [...(seed.groups ?? [])]
  const members: MemberRecord[] = [...(seed.members ?? [])]
  let n = groups.length

  const deps: GroupDeps = {
    countOwnedBy: async (userId) => groups.filter((g) => g.ownerUserId === userId).length,
    slugExists: async (slug) => groups.some((g) => g.slug === slug),
    createGroup: async (input) => {
      const group: GroupRecord = {
        id: `g${++n}`,
        ownerUserId: input.ownerUserId,
        name: input.name,
        slug: input.slug,
        visibility: input.visibility,
        memberCount: 1,
      }
      groups.push(group)
      return group
    },
    getGroup: async (id) => groups.find((g) => g.id === id),
    getMembership: async (groupId, userId) =>
      members.find((m) => m.groupId === groupId && m.userId === userId),
    addMember: async (groupId, userId, role) => {
      members.push({ groupId, userId, role, blocked: false })
    },
    setBlocked: async (groupId, userId, blocked) => {
      const m = members.find((x) => x.groupId === groupId && x.userId === userId)
      if (m) m.blocked = blocked
      else members.push({ groupId, userId, role: 'member', blocked })
    },
    removeMember: async (groupId, userId) => {
      const i = members.findIndex((m) => m.groupId === groupId && m.userId === userId)
      if (i >= 0) members.splice(i, 1)
    },
  }
  return { deps, groups, members }
}

describe('validateGroupInput', () => {
  it('accepts a reasonable group and defaults to public', () => {
    const r = validateGroupInput({ name: '  Analysts  ' })
    expect(r).toEqual({ ok: true, value: { name: 'Analysts', description: null, visibility: 'public' } })
  })

  it('rejects a name that is too short or too long', () => {
    expect(validateGroupInput({ name: 'ab' }).ok).toBe(false)
    expect(validateGroupInput({ name: 'x'.repeat(61) }).ok).toBe(false)
    expect(validateGroupInput({ name: 42 }).ok).toBe(false)
  })

  it('honours a private choice and trims an over-long description', () => {
    const r = validateGroupInput({
      name: 'Team',
      visibility: 'private',
      description: 'y'.repeat(900),
    })
    expect(r.ok && r.value.visibility).toBe('private')
    expect(r.ok && r.value.description!.length).toBe(500)
  })
})

describe('slugify', () => {
  it('makes a URL-safe handle', () => {
    expect(slugify('Threat Analysts — EU')).toBe('threat-analysts-eu')
  })

  /** An Arabic name slugifies to nothing; it must still get a usable handle. */
  it('falls back to a generated handle for a non-Latin name', () => {
    const slug = slugify('مجموعة التحليل', 'user-123')
    expect(slug).toMatch(/^group-[a-z0-9]+$/)
    expect(slug.length).toBeGreaterThan(6)
  })

  it('is stable for the same input', () => {
    expect(slugify('محللون')).toBe(slugify('محللون'))
  })
})

describe('uniqueSlug', () => {
  it('suffixes rather than failing when the handle is taken', async () => {
    const { deps } = fakeDeps({
      groups: [
        { id: 'g1', ownerUserId: 'u9', name: 'Team', slug: 'team', visibility: 'public', memberCount: 1 },
      ],
    })
    expect(await uniqueSlug('Team', deps)).toBe('team-2')
  })
})

describe('makeInviteCode', () => {
  it('is long enough not to be guessable and avoids confusable characters', () => {
    const code = makeInviteCode()
    expect(code).toHaveLength(10)
    expect(code).not.toMatch(/[ilo01]/)
  })

  it('differs between calls', () => {
    expect(makeInviteCode()).not.toBe(makeInviteCode())
  })
})

describe('createGroup — the two-group cap', () => {
  it('creates a group and makes the owner its first member', async () => {
    const { deps, members } = fakeDeps()
    const group = await createGroup('u1', { name: 'Analysts' }, deps)
    expect(group.slug).toBe('analysts')
    expect(members).toEqual([{ groupId: group.id, userId: 'u1', role: 'owner', blocked: false }])
  })

  it('allows exactly two and refuses the third', async () => {
    const { deps } = fakeDeps()
    await createGroup('u1', { name: 'First group' }, deps)
    await createGroup('u1', { name: 'Second group' }, deps)
    await expect(createGroup('u1', { name: 'Third group' }, deps)).rejects.toThrow(GroupLimitError)
    expect(MAX_GROUPS_PER_OWNER).toBe(2)
  })

  /** The cap counts what you own, not what you have joined. */
  it('does not count groups the user merely belongs to', async () => {
    const { deps } = fakeDeps({
      groups: [
        { id: 'gx', ownerUserId: 'someone-else', name: 'Other', slug: 'other', visibility: 'public', memberCount: 5 },
      ],
      members: [{ groupId: 'gx', userId: 'u1', role: 'member', blocked: false }],
    })
    await expect(createGroup('u1', { name: 'Mine' }, deps)).resolves.toBeTruthy()
  })

  it('caps each owner separately', async () => {
    const { deps } = fakeDeps()
    await createGroup('u1', { name: 'A group' }, deps)
    await createGroup('u1', { name: 'B group' }, deps)
    await expect(createGroup('u2', { name: 'C group' }, deps)).resolves.toBeTruthy()
  })

  it('rejects an invalid name before touching the store', async () => {
    const { deps } = fakeDeps()
    const spy = vi.spyOn(deps, 'createGroup')
    await expect(createGroup('u1', { name: 'no' }, deps)).rejects.toThrow(/3–60/)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('joinGroup', () => {
  const seeded = () =>
    fakeDeps({
      groups: [
        { id: 'g1', ownerUserId: 'u1', name: 'Team', slug: 'team', visibility: 'public', memberCount: 1 },
      ],
      members: [
        { groupId: 'g1', userId: 'u1', role: 'owner', blocked: false },
        { groupId: 'g1', userId: 'banned', role: 'member', blocked: true },
      ],
    })

  it('adds a new member', async () => {
    const { deps, members } = seeded()
    expect(await joinGroup('g1', 'u2', deps)).toEqual({ joined: true })
    expect(members.some((m) => m.userId === 'u2' && m.role === 'member')).toBe(true)
  })

  /** A ban that re-joining could undo is not a ban. */
  it('refuses a blocked user', async () => {
    const { deps } = seeded()
    const r = await joinGroup('g1', 'banned', deps)
    expect(r.joined).toBe(false)
    expect(r.reason).toMatch(/cannot join/i)
  })

  it('refuses a second membership and an unknown group', async () => {
    const { deps } = seeded()
    expect((await joinGroup('g1', 'u1', deps)).joined).toBe(false)
    expect((await joinGroup('nope', 'u2', deps)).joined).toBe(false)
  })
})

describe('moderation', () => {
  const seeded = () =>
    fakeDeps({
      groups: [
        { id: 'g1', ownerUserId: 'owner', name: 'Team', slug: 'team', visibility: 'public', memberCount: 3 },
      ],
      members: [
        { groupId: 'g1', userId: 'owner', role: 'owner', blocked: false },
        { groupId: 'g1', userId: 'admin', role: 'admin', blocked: false },
        { groupId: 'g1', userId: 'member', role: 'member', blocked: false },
      ],
    })

  it('lets owners and admins moderate, and nobody else', async () => {
    const { deps } = seeded()
    expect(await canModerate('g1', 'owner', deps)).toBe(true)
    expect(await canModerate('g1', 'admin', deps)).toBe(true)
    expect(await canModerate('g1', 'member', deps)).toBe(false)
    expect(await canModerate('g1', 'stranger', deps)).toBe(false)
  })

  it('blocks a member', async () => {
    const { deps, members } = seeded()
    await blockMember('g1', 'admin', 'member', deps)
    expect(members.find((m) => m.userId === 'member')?.blocked).toBe(true)
  })

  it('refuses to block the owner, even for an admin they appointed', async () => {
    const { deps } = seeded()
    await expect(blockMember('g1', 'admin', 'owner', deps)).rejects.toThrow(/owner cannot be blocked/i)
  })

  it('refuses moderation by a plain member', async () => {
    const { deps } = seeded()
    await expect(blockMember('g1', 'member', 'admin', deps)).rejects.toThrow(/owner or admin/i)
  })
})

describe('leaveGroup', () => {
  const seeded = () =>
    fakeDeps({
      groups: [
        { id: 'g1', ownerUserId: 'owner', name: 'Team', slug: 'team', visibility: 'public', memberCount: 2 },
      ],
      members: [
        { groupId: 'g1', userId: 'owner', role: 'owner', blocked: false },
        { groupId: 'g1', userId: 'member', role: 'member', blocked: false },
      ],
    })

  it('lets a member leave', async () => {
    const { deps, members } = seeded()
    await leaveGroup('g1', 'member', deps)
    expect(members.some((m) => m.userId === 'member')).toBe(false)
  })

  /** Otherwise the group is left with nobody able to administer it. */
  it('refuses to let the owner strand their own group', async () => {
    const { deps } = seeded()
    await expect(leaveGroup('g1', 'owner', deps)).rejects.toThrow(/transfer it or delete it/i)
  })

  it('refuses for someone who was never a member', async () => {
    const { deps } = seeded()
    await expect(leaveGroup('g1', 'stranger', deps)).rejects.toThrow(/not a member/i)
  })
})
