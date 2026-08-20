/**
 * lib/db — the ONLY database entry point for the rest of the app.
 *
 * App code, API routes and the engine import from here (`repo`, types) and never
 * touch the Drizzle client or a vendor SDK directly. This keeps the storage
 * backend swappable (charter rule #4).
 */
import { and, desc, eq, gte, inArray, lte, or, isNull, sql } from 'drizzle-orm'
import { getDb, isDbConfigured } from './client'
import * as s from '@/db/schema'

export { isDbConfigured }
export * as schema from '@/db/schema'

// Row types inferred from the schema (single source of truth).
export type User = typeof s.users.$inferSelect
export type NewUser = typeof s.users.$inferInsert
export type Credential = typeof s.credentials.$inferSelect
export type VerificationCode = typeof s.verificationCodes.$inferSelect
export type VerificationPurpose = VerificationCode['purpose']
export type SocialChannel = typeof s.socialChannels.$inferSelect
export type NewSocialChannel = typeof s.socialChannels.$inferInsert
export type Investigation = typeof s.investigations.$inferSelect
export type Entity = typeof s.entities.$inferSelect
export type EntityLink = typeof s.entityLinks.$inferSelect
export type Scan = typeof s.scans.$inferSelect
export type Evidence = typeof s.evidence.$inferSelect
export type NewEvidence = typeof s.evidence.$inferInsert
export type Monitor = typeof s.monitors.$inferSelect
export type Alert = typeof s.alerts.$inferSelect
export type SourceHealthDay = typeof s.sourceHealthDaily.$inferSelect
export type RadarFinding = typeof s.radarFindings.$inferSelect
export type NewRadarFinding = typeof s.radarFindings.$inferInsert
export type Source = typeof s.sources.$inferSelect
export type Suggestion = typeof s.suggestions.$inferSelect
export type NewSuggestion = typeof s.suggestions.$inferInsert
export type OntologyNode = typeof s.ontologyNodes.$inferSelect
export type OntologyEdge = typeof s.ontologyEdges.$inferSelect
export type CalibrationClaim = typeof s.calibrationClaims.$inferSelect
export type NewCalibrationClaim = typeof s.calibrationClaims.$inferInsert
export type Visitor = typeof s.visitors.$inferSelect
export type NewVisitor = typeof s.visitors.$inferInsert
export type Group = typeof s.groups.$inferSelect
export type GroupMember = typeof s.groupMembers.$inferSelect
export type Post = typeof s.posts.$inferSelect
export type NewPost = typeof s.posts.$inferInsert

export const repo = {
  users: {
    /** Create the user if new, otherwise return the existing one (by provider + external id). */
    async upsert(input: NewUser): Promise<User> {
      const db = getDb()
      const [row] = await db
        .insert(s.users)
        .values(input)
        .onConflictDoUpdate({
          target: [s.users.authProvider, s.users.externalId],
          // The handle is only ever *filled in*, never overwritten with null:
          // a returning user whose row already carries a username must keep it,
          // and a sign-in that arrives without one must not erase it.
          set: {
            displayName: input.displayName ?? null,
            ...(input.username ? { username: input.username } : {}),
          },
        })
        .returning()
      return row
    },
    /** Look a user up by their public handle. Handles are stored lowercase. */
    async getByUsername(username: string): Promise<User | undefined> {
      const db = getDb()
      const [row] = await db
        .select()
        .from(s.users)
        .where(eq(s.users.username, username.trim().toLowerCase()))
        .limit(1)
      return row
    },
    /**
     * Whether this handle is free.
     *
     * Advisory only — two sign-ups racing on the same name would both be told
     * yes. The unique constraint is what actually decides, and the caller must
     * still handle its violation; this exists so the form can say "taken"
     * before someone fills in a password.
     */
    async usernameAvailable(username: string): Promise<boolean> {
      return (await repo.users.getByUsername(username)) === undefined
    },
    async getById(id: string): Promise<User | undefined> {
      const db = getDb()
      const [row] = await db.select().from(s.users).where(eq(s.users.id, id)).limit(1)
      return row
    },
    /** A user's subscription tier (defaults to 'free' if unknown). */
    async getPlan(id: string): Promise<'free' | 'pro'> {
      const db = getDb()
      const [row] = await db.select({ plan: s.users.plan }).from(s.users).where(eq(s.users.id, id)).limit(1)
      return row?.plan ?? 'free'
    },
    async setPlan(id: string, plan: 'free' | 'pro'): Promise<void> {
      const db = getDb()
      await db.update(s.users).set({ plan }).where(eq(s.users.id, id))
    },
    /**
     * Read this account's stored preferences, or null if it has none yet.
     *
     * Returned raw. Validation belongs to `lib/prefs/schema.ts` and happens at
     * every boundary, because a blob written by an older build is exactly what
     * this column will hold six months from now.
     */
    async getPreferences(id: string): Promise<unknown> {
      const db = getDb()
      const [row] = await db
        .select({ preferences: s.users.preferences })
        .from(s.users)
        .where(eq(s.users.id, id))
        .limit(1)
      return row?.preferences ?? null
    },
    async setPreferences(id: string, preferences: unknown): Promise<void> {
      const db = getDb()
      await db.update(s.users).set({ preferences }).where(eq(s.users.id, id))
    },
    /**
     * The person's own name and whether anyone else sees it.
     *
     * Both in one call because they are one decision: someone typing a name for
     * the first time and revealing it is a single act, and two round trips
     * would leave a window where the name exists with an unset switch.
     */
    async setProfile(
      id: string,
      patch: { fullName?: string | null; showRealName?: boolean },
    ): Promise<User | undefined> {
      const db = getDb()
      const [row] = await db.update(s.users).set(patch).where(eq(s.users.id, id)).returning()
      return row
    },
    /** Avatars for a set of authors in one query, so a feed is not N+1. */
    async avatarsByIds(ids: string[]): Promise<Map<string, string | null>> {
      const out = new Map<string, string | null>()
      const unique = [...new Set(ids)].filter(Boolean)
      if (unique.length === 0) return out
      const db = getDb()
      const rows = await db
        .select({ id: s.users.id, avatarUrl: s.users.avatarUrl })
        .from(s.users)
        .where(inArray(s.users.id, unique))
      for (const row of rows) out.set(row.id, row.avatarUrl)
      return out
    },
    async setAvatar(id: string, avatarUrl: string | null): Promise<void> {
      const db = getDb()
      await db.update(s.users).set({ avatarUrl }).where(eq(s.users.id, id))
    },
    /**
     * Erase an account and everything that belongs to it (GDPR art. 17).
     *
     * The deletion is one statement because the schema does the work: rows that
     * *are* the person — credentials, investigations, monitors, their groups and
     * memberships — carry `on delete cascade`, so they go with the user inside
     * the same transaction and cannot be half-removed. Rows that merely *were
     * authored by* them — published posts, submitted suggestions, the country
     * counters in the visitor registry — carry `on delete set null`, so the
     * public record survives with the person detached from it. That distinction
     * is deliberate: deleting an account must not silently retract things other
     * people are reading, and keeping a name attached to them would defeat the
     * deletion.
     *
     * Returns the row that was removed so the caller can clean up what the
     * database cannot reach (the avatar in object storage), or undefined if the
     * account was already gone — which makes a repeated request harmless.
     */
    async remove(id: string): Promise<User | undefined> {
      const db = getDb()
      const [row] = await db.delete(s.users).where(eq(s.users.id, id)).returning()
      return row
    },
  },

  groups: {
    async countOwnedBy(userId: string): Promise<number> {
      const db = getDb()
      const rows = await db
        .select({ id: s.groups.id })
        .from(s.groups)
        .where(eq(s.groups.ownerUserId, userId))
      return rows.length
    },
    async slugExists(slug: string): Promise<boolean> {
      const db = getDb()
      const [row] = await db.select({ id: s.groups.id }).from(s.groups).where(eq(s.groups.slug, slug)).limit(1)
      return Boolean(row)
    },
    async create(input: typeof s.groups.$inferInsert): Promise<Group> {
      const db = getDb()
      const [row] = await db.insert(s.groups).values(input).returning()
      return row
    },
    async getById(id: string): Promise<Group | undefined> {
      const db = getDb()
      const [row] = await db.select().from(s.groups).where(eq(s.groups.id, id)).limit(1)
      return row
    },
    async getBySlug(slug: string): Promise<Group | undefined> {
      const db = getDb()
      const [row] = await db.select().from(s.groups).where(eq(s.groups.slug, slug)).limit(1)
      return row
    },
    /** Public groups plus every group this user belongs to. */
    async listVisibleTo(userId: string | null, limit = 50): Promise<Group[]> {
      const db = getDb()
      if (!userId) {
        return db
          .select()
          .from(s.groups)
          .where(eq(s.groups.visibility, 'public'))
          .orderBy(desc(s.groups.createdAt))
          .limit(limit)
      }
      const mine = await db
        .select({ groupId: s.groupMembers.groupId })
        .from(s.groupMembers)
        .where(eq(s.groupMembers.userId, userId))
      const ids = mine.map((m) => m.groupId)
      const where = ids.length
        ? or(eq(s.groups.visibility, 'public'), inArray(s.groups.id, ids))
        : eq(s.groups.visibility, 'public')
      return db.select().from(s.groups).where(where).orderBy(desc(s.groups.createdAt)).limit(limit)
    },
    async remove(id: string): Promise<void> {
      const db = getDb()
      await db.delete(s.groups).where(eq(s.groups.id, id))
    },
    async getMembership(groupId: string, userId: string): Promise<GroupMember | undefined> {
      const db = getDb()
      const [row] = await db
        .select()
        .from(s.groupMembers)
        .where(and(eq(s.groupMembers.groupId, groupId), eq(s.groupMembers.userId, userId)))
        .limit(1)
      return row
    },
    async addMember(groupId: string, userId: string, role: GroupMember['role']): Promise<void> {
      const db = getDb()
      await db
        .insert(s.groupMembers)
        .values({ groupId, userId, role })
        .onConflictDoNothing({ target: [s.groupMembers.groupId, s.groupMembers.userId] })
      await db
        .update(s.groups)
        .set({ memberCount: sql`${s.groups.memberCount} + 1` })
        .where(eq(s.groups.id, groupId))
    },
    async setBlocked(groupId: string, userId: string, blocked: boolean): Promise<void> {
      const db = getDb()
      await db
        .update(s.groupMembers)
        .set({ blocked })
        .where(and(eq(s.groupMembers.groupId, groupId), eq(s.groupMembers.userId, userId)))
    },
    async removeMember(groupId: string, userId: string): Promise<void> {
      const db = getDb()
      await db
        .delete(s.groupMembers)
        .where(and(eq(s.groupMembers.groupId, groupId), eq(s.groupMembers.userId, userId)))
      await db
        .update(s.groups)
        .set({ memberCount: sql`GREATEST(${s.groups.memberCount} - 1, 0)` })
        .where(eq(s.groups.id, groupId))
    },
  },

  credentials: {
    async getByEmail(email: string): Promise<Credential | undefined> {
      const db = getDb()
      const [row] = await db
        .select()
        .from(s.credentials)
        .where(eq(s.credentials.email, email))
        .limit(1)
      return row
    },
    async getByPiUsername(piUsername: string): Promise<Credential | undefined> {
      const db = getDb()
      const [row] = await db
        .select()
        .from(s.credentials)
        .where(eq(s.credentials.piUsername, piUsername))
        .limit(1)
      return row
    },
    async getByUserId(userId: string): Promise<Credential | undefined> {
      const db = getDb()
      const [row] = await db
        .select()
        .from(s.credentials)
        .where(eq(s.credentials.userId, userId))
        .limit(1)
      return row
    },
    async create(input: { userId: string; email: string; passwordHash: string }): Promise<Credential> {
      const db = getDb()
      const [row] = await db.insert(s.credentials).values(input).returning()
      return row
    },
    /** Replace the password hash after a proven reset code. */
    async setPassword(userId: string, passwordHash: string): Promise<void> {
      const db = getDb()
      await db.update(s.credentials).set({ passwordHash }).where(eq(s.credentials.userId, userId))
    },
    /**
     * Link a Pi username + passphrase to a user. A Pi user may have no
     * credential row yet (they have only ever signed in through the SDK), or may
     * be replacing the passphrase on an existing one — both are one upsert on
     * the unique user_id.
     */
    async upsertPiCredential(input: {
      userId: string
      piUsername: string
      passwordHash: string
    }): Promise<Credential> {
      const db = getDb()
      const [row] = await db
        .insert(s.credentials)
        .values(input)
        .onConflictDoUpdate({
          target: s.credentials.userId,
          set: { piUsername: input.piUsername, passwordHash: input.passwordHash },
        })
        .returning()
      return row
    },
  },

  /**
   * Email verification and password-reset codes.
   *
   * Every method here is written so that the *database* enforces what matters,
   * rather than the caller remembering to. Issuing upserts on the unique
   * (email, purpose) pair, so a second request cannot leave two live codes
   * behind however it races; spending a code is a conditional update that only
   * matches an unconsumed row, so two requests arriving with the same correct
   * code cannot both succeed.
   */
  verification: {
    async issue(input: {
      email: string
      purpose: VerificationPurpose
      codeHash: string
      expiresAt: Date
    }): Promise<VerificationCode> {
      const db = getDb()
      const [row] = await db
        .insert(s.verificationCodes)
        .values(input)
        .onConflictDoUpdate({
          target: [s.verificationCodes.email, s.verificationCodes.purpose],
          // A reissue is a fresh start in every respect: new hash, new clock,
          // and the attempt counter back to zero. Carrying the old count over
          // would let someone lock a stranger's address out of sign-up by
          // burning five guesses against a code they never received.
          set: {
            codeHash: input.codeHash,
            expiresAt: input.expiresAt,
            attempts: 0,
            consumedAt: null,
            createdAt: new Date(),
          },
        })
        .returning()
      return row
    },

    async find(email: string, purpose: VerificationPurpose): Promise<VerificationCode | undefined> {
      const db = getDb()
      const [row] = await db
        .select()
        .from(s.verificationCodes)
        .where(and(eq(s.verificationCodes.email, email), eq(s.verificationCodes.purpose, purpose)))
        .limit(1)
      return row
    },

    /** Count a wrong guess. Returns the new total so the caller can stop at the limit. */
    async countAttempt(id: string): Promise<number> {
      const db = getDb()
      const [row] = await db
        .update(s.verificationCodes)
        .set({ attempts: sql`${s.verificationCodes.attempts} + 1` })
        .where(eq(s.verificationCodes.id, id))
        .returning({ attempts: s.verificationCodes.attempts })
      return row?.attempts ?? 0
    },

    /**
     * Spend a code. False means somebody else already did.
     *
     * The `is null` in the predicate is the whole point: two requests carrying
     * the same correct code reach this at the same time, both would read an
     * unconsumed row, and without it both would proceed — one creating the
     * account and the other resetting its password a moment later.
     */
    async consume(id: string): Promise<boolean> {
      const db = getDb()
      const rows = await db
        .update(s.verificationCodes)
        .set({ consumedAt: new Date() })
        .where(and(eq(s.verificationCodes.id, id), isNull(s.verificationCodes.consumedAt)))
        .returning({ id: s.verificationCodes.id })
      return rows.length > 0
    },

    /** Drop expired rows. Called opportunistically when a code is issued. */
    async sweep(now: Date = new Date()): Promise<number> {
      const db = getDb()
      const rows = await db
        .delete(s.verificationCodes)
        .where(lte(s.verificationCodes.expiresAt, now))
        .returning({ id: s.verificationCodes.id })
      return rows.length
    },
  },

  socialChannels: {
    async list(): Promise<SocialChannel[]> {
      const db = getDb()
      return db.select().from(s.socialChannels).orderBy(s.socialChannels.createdAt)
    },
    async getById(id: string): Promise<SocialChannel | undefined> {
      const db = getDb()
      const [row] = await db
        .select()
        .from(s.socialChannels)
        .where(eq(s.socialChannels.id, id))
        .limit(1)
      return row
    },
    async create(input: NewSocialChannel): Promise<SocialChannel> {
      const db = getDb()
      const [row] = await db.insert(s.socialChannels).values(input).returning()
      return row
    },
    async update(
      id: string,
      patch: Partial<Pick<SocialChannel, 'label' | 'enabled' | 'autoPublish' | 'kindFilter'>>,
    ): Promise<SocialChannel | undefined> {
      const db = getDb()
      const [row] = await db
        .update(s.socialChannels)
        .set(patch)
        .where(eq(s.socialChannels.id, id))
        .returning()
      return row
    },
    async remove(id: string): Promise<void> {
      const db = getDb()
      await db.delete(s.socialChannels).where(eq(s.socialChannels.id, id))
    },
    /** Record a delivery outcome so a silently broken channel becomes visible. */
    async recordDelivery(id: string, ok: boolean, error: string | null): Promise<void> {
      const db = getDb()
      const current = await repo.socialChannels.getById(id)
      if (!current) return
      await db
        .update(s.socialChannels)
        .set({
          lastStatus: ok ? 'ok' : 'error',
          lastError: ok ? null : error,
          lastAt: new Date(),
          deliveredCount: current.deliveredCount + (ok ? 1 : 0),
          failedCount: current.failedCount + (ok ? 0 : 1),
        })
        .where(eq(s.socialChannels.id, id))
    },
  },

  investigations: {
    async create(input: {
      userId: string
      title: string
      targetType: Entity['type']
      targetValue: string
      gateway?: string
      findingCount?: number
    }): Promise<Investigation> {
      const db = getDb()
      const [row] = await db.insert(s.investigations).values(input).returning()
      return row
    },
    async getById(id: string): Promise<Investigation | undefined> {
      const db = getDb()
      const [row] = await db
        .select()
        .from(s.investigations)
        .where(eq(s.investigations.id, id))
        .limit(1)
      return row
    },
    async listByUser(userId: string): Promise<Investigation[]> {
      const db = getDb()
      return db
        .select()
        .from(s.investigations)
        .where(eq(s.investigations.userId, userId))
        .orderBy(desc(s.investigations.createdAt))
    },

    /**
     * The history list: this user's runs, newest first, optionally narrowed by
     * a text match on the subject or by gateway.
     *
     * The search is a case-insensitive substring on the target value, which is
     * what a person actually remembers ("that nestle one"). `%` and `_` in the
     * query are escaped — otherwise a user typing an underscore silently gets a
     * wildcard and wonders why unrelated rows appear.
     */
    async search(
      userId: string,
      options: { q?: string; gateway?: string; limit?: number; offset?: number } = {},
    ): Promise<Investigation[]> {
      const db = getDb()
      const limit = Math.min(Math.max(options.limit ?? 30, 1), 100)
      const offset = Math.max(options.offset ?? 0, 0)

      const filters = [eq(s.investigations.userId, userId)]
      const q = options.q?.trim()
      if (q) {
        const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`)
        filters.push(sql`${s.investigations.targetValue} ILIKE ${'%' + escaped + '%'} ESCAPE '\\'`)
      }
      if (options.gateway) filters.push(eq(s.investigations.gateway, options.gateway))

      return db
        .select()
        .from(s.investigations)
        .where(and(...filters))
        .orderBy(desc(s.investigations.createdAt))
        .limit(limit)
        .offset(offset)
    },

    /**
     * Delete one entry. Scoped by user id in the same statement as the row id,
     * so a caller cannot delete another account's history by guessing a uuid —
     * authorisation is in the query, not in a check the caller might skip.
     */
    async remove(userId: string, id: string): Promise<boolean> {
      const db = getDb()
      const rows = await db
        .delete(s.investigations)
        .where(and(eq(s.investigations.id, id), eq(s.investigations.userId, userId)))
        .returning({ id: s.investigations.id })
      return rows.length > 0
    },
  },

  entities: {
    /** Add an entity, ignoring duplicates within the same investigation. */
    async add(input: {
      investigationId: string
      type: Entity['type']
      value: string
    }): Promise<Entity | undefined> {
      const db = getDb()
      const [row] = await db
        .insert(s.entities)
        .values(input)
        .onConflictDoNothing({
          target: [s.entities.investigationId, s.entities.type, s.entities.value],
        })
        .returning()
      return row
    },
    async listByInvestigation(investigationId: string): Promise<Entity[]> {
      const db = getDb()
      return db
        .select()
        .from(s.entities)
        .where(eq(s.entities.investigationId, investigationId))
    },
  },

  links: {
    async add(input: {
      investigationId: string
      fromEntityId: string
      toEntityId: string
      relation: string
    }): Promise<EntityLink> {
      const db = getDb()
      const [row] = await db.insert(s.entityLinks).values(input).returning()
      return row
    },
    async listByInvestigation(investigationId: string): Promise<EntityLink[]> {
      const db = getDb()
      return db
        .select()
        .from(s.entityLinks)
        .where(eq(s.entityLinks.investigationId, investigationId))
    },
  },

  evidence: {
    async add(input: NewEvidence): Promise<Evidence> {
      const db = getDb()
      const [row] = await db.insert(s.evidence).values(input).returning()
      return row
    },
    async listByInvestigation(investigationId: string): Promise<Evidence[]> {
      const db = getDb()
      return db
        .select()
        .from(s.evidence)
        .where(eq(s.evidence.investigationId, investigationId))
        .orderBy(desc(s.evidence.retrievedAt))
    },
  },

  scans: {
    async create(input: {
      investigationId?: string | null
      sourceKey: string
      input: string
    }): Promise<Scan> {
      const db = getDb()
      const [row] = await db
        .insert(s.scans)
        .values({
          investigationId: input.investigationId ?? null,
          sourceKey: input.sourceKey,
          input: input.input,
        })
        .returning()
      return row
    },
    async markRunning(id: string): Promise<void> {
      const db = getDb()
      await db
        .update(s.scans)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(s.scans.id, id))
    },
    async complete(id: string, result: unknown): Promise<void> {
      const db = getDb()
      await db
        .update(s.scans)
        .set({ status: 'done', finishedAt: new Date(), result: result as object })
        .where(eq(s.scans.id, id))
    },
    async fail(id: string, error: string): Promise<void> {
      const db = getDb()
      await db
        .update(s.scans)
        .set({ status: 'error', finishedAt: new Date(), error })
        .where(eq(s.scans.id, id))
    },
  },

  monitors: {
    async create(input: {
      userId: string
      targetType: Entity['type']
      targetValue: string
      intervalMinutes?: number
    }): Promise<Monitor> {
      const db = getDb()
      const [row] = await db.insert(s.monitors).values(input).returning()
      return row
    },
    async listByUser(userId: string): Promise<Monitor[]> {
      const db = getDb()
      return db
        .select()
        .from(s.monitors)
        .where(eq(s.monitors.userId, userId))
        .orderBy(desc(s.monitors.createdAt))
    },
    async getById(id: string): Promise<Monitor | undefined> {
      const db = getDb()
      const [row] = await db.select().from(s.monitors).where(eq(s.monitors.id, id)).limit(1)
      return row
    },
    async remove(id: string): Promise<void> {
      const db = getDb()
      await db.delete(s.monitors).where(eq(s.monitors.id, id))
    },
    /** Active monitors whose interval has elapsed since lastRunAt (or never ran). */
    async listDue(now: Date = new Date()): Promise<Monitor[]> {
      const db = getDb()
      const dueBefore = sql`${s.monitors.lastRunAt} + (${s.monitors.intervalMinutes} * interval '1 minute')`
      return db
        .select()
        .from(s.monitors)
        .where(
          and(
            eq(s.monitors.status, 'active'),
            or(isNull(s.monitors.lastRunAt), lte(dueBefore, now)),
          ),
        )
    },
    async markRun(id: string, at: Date = new Date()): Promise<void> {
      const db = getDb()
      await db.update(s.monitors).set({ lastRunAt: at }).where(eq(s.monitors.id, id))
    },
    async setFingerprint(id: string, fingerprint: string): Promise<void> {
      const db = getDb()
      await db.update(s.monitors).set({ lastFingerprint: fingerprint }).where(eq(s.monitors.id, id))
    },
    async setStatus(id: string, status: Monitor['status']): Promise<void> {
      const db = getDb()
      await db.update(s.monitors).set({ status }).where(eq(s.monitors.id, id))
    },
  },

  /**
   * The platform's record of its own sources.
   *
   * Written by every sweep, read by the self-audit. Upserted per source per
   * day: the counters accumulate within a day and the table stays bounded at
   * sources × days, so nobody has to remember to prune it.
   */
  sourceHealth: {
    /**
     * Record one sweep's outcome for one source.
     *
     * `onConflictDoUpdate` rather than read-modify-write, so two sweeps running
     * at once cannot lose each other's counts — the increment happens inside
     * Postgres, where it is atomic. A cron and a manual run overlapping is not
     * hypothetical here; it is what a redeploy mid-sweep looks like.
     */
    async record(input: {
      sourceKey: string
      day: string
      status: 'ok' | 'empty' | 'failed'
      items?: number
      error?: string | null
    }): Promise<void> {
      const db = getDb()
      const ok = input.status === 'ok' ? 1 : 0
      const empty = input.status === 'empty' ? 1 : 0
      const failed = input.status === 'failed' ? 1 : 0
      const items = input.items ?? 0

      await db
        .insert(s.sourceHealthDaily)
        .values({
          sourceKey: input.sourceKey,
          day: input.day,
          ok,
          empty,
          failed,
          items,
          lastError: input.error ?? null,
        })
        .onConflictDoUpdate({
          target: [s.sourceHealthDaily.sourceKey, s.sourceHealthDaily.day],
          set: {
            ok: sql`${s.sourceHealthDaily.ok} + ${ok}`,
            empty: sql`${s.sourceHealthDaily.empty} + ${empty}`,
            failed: sql`${s.sourceHealthDaily.failed} + ${failed}`,
            items: sql`${s.sourceHealthDaily.items} + ${items}`,
            // Only overwrite the error when this run had one, so a single good
            // run does not erase the reason the previous ten failed.
            ...(input.error ? { lastError: input.error } : {}),
            updatedAt: new Date(),
          },
        })
    },

    /** Every observation from the last `days` days, oldest first. */
    async since(days = 90): Promise<SourceHealthDay[]> {
      const db = getDb()
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
      return db
        .select()
        .from(s.sourceHealthDaily)
        .where(gte(s.sourceHealthDaily.day, cutoff))
        .orderBy(s.sourceHealthDaily.day)
    },
  },

  alerts: {
    async add(input: { monitorId: string; title: string; detail?: unknown }): Promise<Alert> {
      const db = getDb()
      const [row] = await db
        .insert(s.alerts)
        .values({ monitorId: input.monitorId, title: input.title, detail: input.detail as object })
        .returning()
      return row
    },
    async listByMonitor(monitorId: string): Promise<Alert[]> {
      const db = getDb()
      return db
        .select()
        .from(s.alerts)
        .where(eq(s.alerts.monitorId, monitorId))
        .orderBy(desc(s.alerts.createdAt))
    },
    async markSeen(id: string): Promise<void> {
      const db = getDb()
      await db.update(s.alerts).set({ seen: true }).where(eq(s.alerts.id, id))
    },
    /** All alerts across a user's monitors (newest first). */
    async listByUser(userId: string, limit = 50): Promise<Alert[]> {
      const db = getDb()
      const rows = await db
        .select()
        .from(s.alerts)
        .innerJoin(s.monitors, eq(s.alerts.monitorId, s.monitors.id))
        .where(eq(s.monitors.userId, userId))
        .orderBy(desc(s.alerts.createdAt))
        .limit(limit)
      return rows.map((r) => r.alerts)
    },
  },

  radar: {
    /** Store a finding, de-duplicated by dedupeHash across runs. */
    async upsertFinding(input: NewRadarFinding): Promise<RadarFinding | undefined> {
      const db = getDb()
      const [row] = await db
        .insert(s.radarFindings)
        .values(input)
        .onConflictDoNothing({ target: s.radarFindings.dedupeHash })
        .returning()
      return row
    },
    async listRecent(kind?: RadarFinding['kind'], limit = 50): Promise<RadarFinding[]> {
      const db = getDb()
      const q = db.select().from(s.radarFindings)
      const rows = kind
        ? await q.where(eq(s.radarFindings.kind, kind)).orderBy(desc(s.radarFindings.retrievedAt)).limit(limit)
        : await q.orderBy(desc(s.radarFindings.retrievedAt)).limit(limit)
      return rows
    },
  },

  suggestions: {
    async create(input: NewSuggestion): Promise<Suggestion> {
      const db = getDb()
      const [row] = await db.insert(s.suggestions).values(input).returning()
      return row
    },
    async list(limit = 200): Promise<Suggestion[]> {
      const db = getDb()
      return db.select().from(s.suggestions).orderBy(desc(s.suggestions.createdAt)).limit(limit)
    },
    async listByUser(userId: string, limit = 100): Promise<Suggestion[]> {
      const db = getDb()
      return db
        .select()
        .from(s.suggestions)
        .where(eq(s.suggestions.userId, userId))
        .orderBy(desc(s.suggestions.createdAt))
        .limit(limit)
    },
    async getById(id: string): Promise<Suggestion | undefined> {
      const db = getDb()
      const [row] = await db.select().from(s.suggestions).where(eq(s.suggestions.id, id)).limit(1)
      return row
    },
    async incrementVotes(id: string): Promise<Suggestion | undefined> {
      const db = getDb()
      const [row] = await db
        .update(s.suggestions)
        .set({ votes: sql`${s.suggestions.votes} + 1` })
        .where(eq(s.suggestions.id, id))
        .returning()
      return row
    },
    async setStatus(id: string, status: Suggestion['status']): Promise<Suggestion | undefined> {
      const db = getDb()
      const [row] = await db
        .update(s.suggestions)
        .set({ status })
        .where(eq(s.suggestions.id, id))
        .returning()
      return row
    },
  },

  calibration: {
    /** Record a claim/forecast; ignore exact duplicates (same author + claim). */
    async record(input: NewCalibrationClaim): Promise<CalibrationClaim | undefined> {
      const db = getDb()
      const [row] = await db
        .insert(s.calibrationClaims)
        .values(input)
        .onConflictDoNothing({ target: s.calibrationClaims.dedupeHash })
        .returning()
      return row
    },
    async resolve(id: string, outcome: CalibrationClaim['outcome'], note?: string): Promise<CalibrationClaim | undefined> {
      const db = getDb()
      const [row] = await db
        .update(s.calibrationClaims)
        .set({ status: 'resolved', outcome, note: note ?? null, resolvedAt: sql`now()` })
        .where(eq(s.calibrationClaims.id, id))
        .returning()
      return row
    },
    async list(limit = 500): Promise<CalibrationClaim[]> {
      const db = getDb()
      return db.select().from(s.calibrationClaims).orderBy(desc(s.calibrationClaims.assertedAt)).limit(limit)
    },
    async listDue(now: Date): Promise<CalibrationClaim[]> {
      const db = getDb()
      return db
        .select()
        .from(s.calibrationClaims)
        .where(and(eq(s.calibrationClaims.status, 'open'), lte(s.calibrationClaims.horizon, now)))
    },
  },

  ontology: {
    /** Upsert a global entity, accumulating mentions + last-seen. */
    async upsertNode(input: { type: Entity['type']; value: string; sources: string[] }): Promise<OntologyNode> {
      const db = getDb()
      const [row] = await db
        .insert(s.ontologyNodes)
        .values({ type: input.type, value: input.value, sources: input.sources })
        .onConflictDoUpdate({
          target: [s.ontologyNodes.type, s.ontologyNodes.value],
          set: {
            mentions: sql`${s.ontologyNodes.mentions} + 1`,
            lastSeen: sql`now()`,
            sources: input.sources,
          },
        })
        .returning()
      return row
    },
    /** Upsert a global edge, accumulating evidence + last-seen. */
    async upsertEdge(input: {
      fromNodeId: string
      toNodeId: string
      predicate: string
      confidence: OntologyEdge['confidence']
      sources: string[]
      evidenceCount: number
    }): Promise<OntologyEdge> {
      const db = getDb()
      const [row] = await db
        .insert(s.ontologyEdges)
        .values(input)
        .onConflictDoUpdate({
          target: [s.ontologyEdges.fromNodeId, s.ontologyEdges.toNodeId, s.ontologyEdges.predicate],
          set: {
            evidenceCount: sql`${s.ontologyEdges.evidenceCount} + ${input.evidenceCount}`,
            confidence: input.confidence,
            lastSeen: sql`now()`,
            sources: input.sources,
          },
        })
        .returning()
      return row
    },
    async getNode(type: Entity['type'], value: string): Promise<OntologyNode | undefined> {
      const db = getDb()
      const [row] = await db
        .select()
        .from(s.ontologyNodes)
        .where(and(eq(s.ontologyNodes.type, type), eq(s.ontologyNodes.value, value)))
        .limit(1)
      return row
    },
    async edgesForNode(nodeId: string): Promise<OntologyEdge[]> {
      const db = getDb()
      return db
        .select()
        .from(s.ontologyEdges)
        .where(or(eq(s.ontologyEdges.fromNodeId, nodeId), eq(s.ontologyEdges.toNodeId, nodeId)))
    },
    async nodesByIds(ids: string[]): Promise<OntologyNode[]> {
      if (ids.length === 0) return []
      const db = getDb()
      return db.select().from(s.ontologyNodes).where(inArray(s.ontologyNodes.id, ids))
    },
  },

  visitors: {
    /**
     * Record one access. Upserts on subjectKey so each subject is a single row:
     * a repeat visit bumps the count and refreshes country + last-seen. Never
     * exposed in the product — read only through the admin API.
     */
    async record(input: {
      subjectKey: string
      userId?: string | null
      provider?: 'pi' | 'standalone' | null
      displayName?: string | null
      countryCode?: string | null
      countryName?: string | null
      region?: string | null
      lastMode?: string | null
      at?: Date
    }): Promise<void> {
      const db = getDb()
      const at = input.at ?? new Date()
      await db
        .insert(s.visitors)
        .values({
          subjectKey: input.subjectKey,
          userId: input.userId ?? null,
          provider: input.provider ?? null,
          displayName: input.displayName ?? null,
          countryCode: input.countryCode ?? null,
          countryName: input.countryName ?? null,
          region: input.region ?? null,
          lastMode: input.lastMode ?? null,
          firstSeenAt: at,
          lastSeenAt: at,
        })
        .onConflictDoUpdate({
          target: s.visitors.subjectKey,
          set: {
            visitCount: sql`${s.visitors.visitCount} + 1`,
            lastSeenAt: at,
            // Refresh identity/location on each visit, but never overwrite a
            // known value with a null (a later visit missing geo shouldn't wipe it).
            userId: sql`coalesce(excluded.user_id, ${s.visitors.userId})`,
            provider: sql`coalesce(excluded.provider, ${s.visitors.provider})`,
            displayName: sql`coalesce(excluded.display_name, ${s.visitors.displayName})`,
            countryCode: sql`coalesce(excluded.country_code, ${s.visitors.countryCode})`,
            countryName: sql`coalesce(excluded.country_name, ${s.visitors.countryName})`,
            region: sql`coalesce(excluded.region, ${s.visitors.region})`,
            lastMode: sql`coalesce(excluded.last_mode, ${s.visitors.lastMode})`,
          },
        })
    },
    /** The full registry for the operator, most-recently-active first. */
    async list(limit = 1000): Promise<Visitor[]> {
      const db = getDb()
      return db.select().from(s.visitors).orderBy(desc(s.visitors.lastSeenAt)).limit(limit)
    },
    /** Visitors-per-country roll-up (identified rows + anonymous aggregates). */
    async byCountry(): Promise<Array<{ countryCode: string | null; countryName: string | null; subjects: number; visits: number }>> {
      const db = getDb()
      return db
        .select({
          countryCode: s.visitors.countryCode,
          countryName: s.visitors.countryName,
          subjects: sql<number>`count(*)::int`,
          visits: sql<number>`coalesce(sum(${s.visitors.visitCount}), 0)::int`,
        })
        .from(s.visitors)
        .groupBy(s.visitors.countryCode, s.visitors.countryName)
        .orderBy(desc(sql`sum(${s.visitors.visitCount})`))
    },
  },

  posts: {
    async create(input: NewPost): Promise<Post> {
      const db = getDb()
      const [row] = await db.insert(s.posts).values(input).returning()
      return row
    },
    async getById(id: string): Promise<Post | undefined> {
      const db = getDb()
      const [row] = await db.select().from(s.posts).where(eq(s.posts.id, id)).limit(1)
      return row
    },
    /** The public feed, newest first. Unlisted posts are reachable only by link. */
    async listPublic(limit = 50, before?: Date): Promise<Post[]> {
      const db = getDb()
      const where = before
        ? and(eq(s.posts.visibility, 'public'), lte(s.posts.createdAt, before))
        : eq(s.posts.visibility, 'public')
      return db.select().from(s.posts).where(where).orderBy(desc(s.posts.createdAt)).limit(limit)
    },
    /**
     * Has an automatically-published post with this reference already gone out?
     * The dedup check behind the scheduled publisher.
     */
    async existsByRef(refType: string, refValue: string): Promise<boolean> {
      return Boolean(await repo.posts.findByRef(refType, refValue))
    },
    /**
     * The post behind a reference, if one exists. Sharing a dossier keys on its
     * seal, so re-sharing the same findings has to return the link that already
     * exists rather than minting a second one for identical content.
     */
    async findByRef(refType: string, refValue: string): Promise<Post | undefined> {
      const db = getDb()
      const [row] = await db
        .select()
        .from(s.posts)
        .where(and(eq(s.posts.refType, refType), eq(s.posts.refValue, refValue)))
        .limit(1)
      return row
    },
    async listByUser(userId: string, limit = 50): Promise<Post[]> {
      const db = getDb()
      return db
        .select()
        .from(s.posts)
        .where(eq(s.posts.authorUserId, userId))
        .orderBy(desc(s.posts.createdAt))
        .limit(limit)
    },
    async like(id: string): Promise<Post | undefined> {
      const db = getDb()
      const [row] = await db
        .update(s.posts)
        .set({ likeCount: sql`${s.posts.likeCount} + 1` })
        .where(eq(s.posts.id, id))
        .returning()
      return row
    },
  },

  sources: {
    /** Register/update our source adapters in the catalog. */
    async upsertMany(rows: Source[]): Promise<void> {
      if (rows.length === 0) return
      const db = getDb()
      await db
        .insert(s.sources)
        .values(rows)
        .onConflictDoUpdate({
          target: s.sources.key,
          set: {
            name: sql`excluded.name`,
            capability: sql`excluded.capability`,
            enabled: sql`excluded.enabled`,
          },
        })
    },
    async listEnabled(): Promise<Source[]> {
      const db = getDb()
      return db.select().from(s.sources).where(eq(s.sources.enabled, true))
    },
  },
}
