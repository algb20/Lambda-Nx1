/**
 * lib/db — the ONLY database entry point for the rest of the app.
 *
 * App code, API routes and the engine import from here (`repo`, types) and never
 * touch the Drizzle client or a vendor SDK directly. This keeps the storage
 * backend swappable (charter rule #4).
 */
import { and, desc, eq, lte, or, isNull, sql } from 'drizzle-orm'
import { getDb, isDbConfigured } from './client'
import * as s from '@/db/schema'

export { isDbConfigured }
export * as schema from '@/db/schema'

// Row types inferred from the schema (single source of truth).
export type User = typeof s.users.$inferSelect
export type NewUser = typeof s.users.$inferInsert
export type Credential = typeof s.credentials.$inferSelect
export type Investigation = typeof s.investigations.$inferSelect
export type Entity = typeof s.entities.$inferSelect
export type EntityLink = typeof s.entityLinks.$inferSelect
export type Scan = typeof s.scans.$inferSelect
export type Evidence = typeof s.evidence.$inferSelect
export type NewEvidence = typeof s.evidence.$inferInsert
export type Monitor = typeof s.monitors.$inferSelect
export type Alert = typeof s.alerts.$inferSelect
export type RadarFinding = typeof s.radarFindings.$inferSelect
export type NewRadarFinding = typeof s.radarFindings.$inferInsert
export type Source = typeof s.sources.$inferSelect
export type Suggestion = typeof s.suggestions.$inferSelect
export type NewSuggestion = typeof s.suggestions.$inferInsert

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
          set: { displayName: input.displayName ?? null },
        })
        .returning()
      return row
    },
    async getById(id: string): Promise<User | undefined> {
      const db = getDb()
      const [row] = await db.select().from(s.users).where(eq(s.users.id, id)).limit(1)
      return row
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
    async create(input: { userId: string; email: string; passwordHash: string }): Promise<Credential> {
      const db = getDb()
      const [row] = await db.insert(s.credentials).values(input).returning()
      return row
    },
  },

  investigations: {
    async create(input: {
      userId: string
      title: string
      targetType: Entity['type']
      targetValue: string
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
