/**
 * Lambda NX — database schema (Postgres via Drizzle).
 *
 * This is the single source of truth for the data model. Schema changes are made
 * here and turned into versioned SQL migrations in db/migrations (`npm run db:generate`),
 * so any Postgres instance can be rebuilt from zero (charter rule #4: safe portability).
 *
 * App code never queries these tables directly — it goes through lib/db repositories.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  char,
  integer,
  boolean,
  jsonb,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core'

// ── Enums ────────────────────────────────────────────────────────────────────

export const authProviderEnum = pgEnum('auth_provider', ['pi', 'standalone'])

export const entityTypeEnum = pgEnum('entity_type', [
  'domain',
  'ip',
  'email',
  'username',
  'organization',
  'phone',
  'url',
  'image',
  'wallet',
  'company',
  'person',
  'other',
])

/** Standardized confidence grades (reference §5.3). Never asserted from one source. */
export const confidenceEnum = pgEnum('confidence', [
  'confirmed',
  'probable',
  'possible',
  'unconfirmed',
])

export const suggestionKindEnum = pgEnum('suggestion_kind', [
  'feature',
  'improvement',
  'bug',
  'integration',
  'data_source',
  'other',
])
export const suggestionStatusEnum = pgEnum('suggestion_status', [
  'new',
  'triaged',
  'planned',
  'in_progress',
  'shipped',
  'declined',
])
export const impactEnum = pgEnum('impact', ['low', 'medium', 'high', 'critical'])
export const effortEnum = pgEnum('effort', ['small', 'medium', 'large'])

export const scanStatusEnum = pgEnum('scan_status', ['queued', 'running', 'done', 'error'])
export const investigationStatusEnum = pgEnum('investigation_status', ['open', 'archived'])
export const monitorStatusEnum = pgEnum('monitor_status', ['active', 'paused'])
export const radarKindEnum = pgEnum('radar_kind', ['internal', 'product'])

// ── Identity ─────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authProvider: authProviderEnum('auth_provider').notNull(),
    /** Pi username, or the subject id from the standalone auth provider. */
    externalId: text('external_id').notNull(),
    displayName: text('display_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('users_provider_external_uq').on(t.authProvider, t.externalId)],
)

// ── Standalone credentials (email + password, off-Pi mode) ───────────────────

export const credentials = pgTable('credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  email: text('email').notNull().unique(),
  /** scrypt hash as "saltHex:hashHex" — never a plaintext password. */
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Source catalog (our engine's adapters) ───────────────────────────────────

export const sources = pgTable('sources', {
  /** Stable key, e.g. 'crtsh', 'rdap', 'doh_dns'. */
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  capability: text('capability').notNull(),
  /** Always true — the engine only registers passive, read-only sources. */
  passive: boolean('passive').notNull().default(true),
  enabled: boolean('enabled').notNull().default(true),
})

// ── Investigations & the pivot graph ─────────────────────────────────────────

export const investigations = pgTable('investigations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  targetType: entityTypeEnum('target_type').notNull(),
  targetValue: text('target_value').notNull(),
  status: investigationStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    type: entityTypeEnum('type').notNull(),
    value: text('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('entities_investigation_type_value_uq').on(t.investigationId, t.type, t.value),
    index('entities_investigation_idx').on(t.investigationId),
  ],
)

/** Edges of the pivot graph (reference §5.1): "from" is linked to "to" via relation. */
export const entityLinks = pgTable(
  'entity_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    fromEntityId: uuid('from_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    toEntityId: uuid('to_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('entity_links_investigation_idx').on(t.investigationId)],
)

// ── Scans (each source run + our own cache/archive of the raw result) ─────────

export const scans = pgTable(
  'scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    investigationId: uuid('investigation_id').references(() => investigations.id, {
      onDelete: 'cascade',
    }),
    sourceKey: text('source_key')
      .notNull()
      .references(() => sources.key),
    input: text('input').notNull(),
    status: scanStatusEnum('status').notNull().default('queued'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
    /** Normalized raw result — our archive, so we keep data even if a source disappears. */
    result: jsonb('result'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('scans_investigation_idx').on(t.investigationId)],
)

// ── Evidence (per-fact documentation, reference §5.4) ─────────────────────────

export const evidence = pgTable(
  'evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'set null' }),
    claim: text('claim').notNull(),
    sourceKey: text('source_key').references(() => sources.key),
    sourceUrl: text('source_url'),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull().defaultNow(),
    archiveUrl: text('archive_url'),
    contentHash: text('content_hash'),
    /** Admiralty code (reference §1.6): source reliability A–F. */
    admiraltySource: char('admiralty_source', { length: 1 }),
    /** Admiralty code: information credibility 1–6. */
    admiraltyInfo: integer('admiralty_info'),
    confidence: confidenceEnum('confidence').notNull().default('possible'),
    notes: text('notes'),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('evidence_investigation_idx').on(t.investigationId)],
)

// ── Monitoring & alerts (product side of the Radar) ──────────────────────────

export const monitors = pgTable(
  'monitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: entityTypeEnum('target_type').notNull(),
    targetValue: text('target_value').notNull(),
    intervalMinutes: integer('interval_minutes').notNull().default(1440),
    status: monitorStatusEnum('status').notNull().default('active'),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    /** JSON fingerprint of the last observed state, for change detection. */
    lastFingerprint: text('last_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('monitors_user_idx').on(t.userId)],
)

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => monitors.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    detail: jsonb('detail'),
    seen: boolean('seen').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('alerts_monitor_idx').on(t.monitorId)],
)

// ── Radar knowledge base (internal: keeps us ahead) ──────────────────────────

export const radarFindings = pgTable('radar_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: radarKindEnum('kind').notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  sourceUrl: text('source_url'),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull().defaultNow(),
  confidence: confidenceEnum('confidence').notNull().default('possible'),
  /** Stable hash of the finding, for de-duplication across runs. */
  dedupeHash: text('dedupe_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Global ontology (accumulating knowledge graph across all investigations) ──

export const ontologyNodes = pgTable(
  'ontology_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: entityTypeEnum('type').notNull(),
    value: text('value').notNull(),
    /** How many times this entity has been observed across runs. */
    mentions: integer('mentions').notNull().default(1),
    /** Union of source keys that have touched this entity. */
    sources: jsonb('sources'),
    firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('ontology_nodes_type_value_uq').on(t.type, t.value)],
)

export const ontologyEdges = pgTable(
  'ontology_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromNodeId: uuid('from_node_id')
      .notNull()
      .references(() => ontologyNodes.id, { onDelete: 'cascade' }),
    toNodeId: uuid('to_node_id')
      .notNull()
      .references(() => ontologyNodes.id, { onDelete: 'cascade' }),
    /** Controlled predicate vocabulary (see lib/engine/ontology). */
    predicate: text('predicate').notNull(),
    confidence: confidenceEnum('confidence').notNull().default('possible'),
    sources: jsonb('sources'),
    evidenceCount: integer('evidence_count').notNull().default(1),
    firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('ontology_edges_uq').on(t.fromNodeId, t.toNodeId, t.predicate),
    index('ontology_edges_from_idx').on(t.fromNodeId),
    index('ontology_edges_to_idx').on(t.toNodeId),
  ],
)

// ── Suggestions (the community feedback loop, AI-triaged) ────────────────────

export const suggestions = pgTable(
  'suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Author. Null after account deletion, but the (anonymized) idea survives. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** Preferred language of the submission (BCP-47), for i18n round-tripping. */
    locale: text('locale'),
    kind: suggestionKindEnum('kind').notNull().default('other'),
    status: suggestionStatusEnum('status').notNull().default('new'),
    // ── AI triage output ──
    category: text('category'),
    impact: impactEnum('impact'),
    effort: effortEnum('effort'),
    sentiment: text('sentiment'),
    /** One-line neutral summary produced by the analyst. */
    summary: text('summary'),
    tags: jsonb('tags'),
    /** Stable key grouping near-duplicate ideas so 100 asks become one signal. */
    clusterKey: text('cluster_key'),
    /** Influence weight of the submitter (tier/usage). Higher = louder signal. */
    submitterWeight: integer('submitter_weight').notNull().default(1),
    votes: integer('votes').notNull().default(0),
    triagedAt: timestamp('triaged_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('suggestions_status_idx').on(t.status),
    index('suggestions_cluster_idx').on(t.clusterKey),
    index('suggestions_user_idx').on(t.userId),
  ],
)
