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
  customType,
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

/**
 * Raw bytes. Drizzle has no first-class `bytea`, and the alternative — base64
 * in a text column — would inflate every stored image by a third and make the
 * column a lie about what it holds.
 */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
})

// ── Enums ────────────────────────────────────────────────────────────────────

export const authProviderEnum = pgEnum('auth_provider', ['pi', 'standalone'])

export const planEnum = pgEnum('plan', ['free', 'pro'])

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

export const calibrationAuthorKindEnum = pgEnum('calibration_author_kind', ['us', 'external'])
export const calibrationOutcomeEnum = pgEnum('calibration_outcome', ['correct', 'partial', 'wrong'])
export const calibrationStatusEnum = pgEnum('calibration_status', ['open', 'resolved'])

export const scanStatusEnum = pgEnum('scan_status', ['queued', 'running', 'done', 'error'])
export const investigationStatusEnum = pgEnum('investigation_status', ['open', 'archived'])
export const monitorStatusEnum = pgEnum('monitor_status', ['active', 'paused'])
export const radarKindEnum = pgEnum('radar_kind', ['internal', 'product'])

/** A published item's kind: free-form post, a shared dossier, or a spotted signal. */
export const postKindEnum = pgEnum('post_kind', ['post', 'research', 'signal'])
/** Public = discoverable in the feed; unlisted = reachable only by its link. */
export const postVisibilityEnum = pgEnum('post_visibility', ['public', 'unlisted'])

// ── Identity ─────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authProvider: authProviderEnum('auth_provider').notNull(),
    /** Pi username, or the subject id from the standalone auth provider. */
    externalId: text('external_id').notNull(),
    displayName: text('display_name'),
    /**
     * The public handle, unique across **all** accounts however they signed up.
     *
     * One namespace on purpose. A Pi pioneer arrives with a handle Pi already
     * assigned them; someone signing up off-Pi chooses one. Two namespaces
     * would let an off-Pi account register a name that reads as a Pi user's
     * identity, which is exactly the impersonation a handle is supposed to
     * prevent.
     *
     * Stored lowercase (see `normalizeUsername`) so uniqueness is
     * case-insensitive without a functional index: `Lambda` and `lambda` must
     * not be two people.
     *
     * Nullable only for accounts created before handles existed — every new
     * account gets one at sign-up.
     */
    username: text('username'),
    /**
     * The person's real name, as they gave it at sign-up.
     *
     * Held separately from `displayName` — which is what the product shows —
     * because they answer different questions. `displayName` is "what should
     * appear next to this post"; `fullName` is "who is this", and it is not
     * published unless its owner says so.
     */
    fullName: text('full_name'),
    /**
     * Whether the real name is shown alongside the handle.
     *
     * Defaults to **false**, and that default is the decision: on a platform
     * whose charter forbids profiling private individuals, a real name that
     * appears until you find the switch has already been published. The eye
     * control in the interface flips this, and every reader sees the result —
     * it is one visibility state, not a per-viewer preference.
     */
    showRealName: boolean('show_real_name').notNull().default(false),
    /**
     * What this person has chosen: globe layers, muted categories, the panels
     * they opened and their order, the gateways they pinned to the front page.
     *
     * One JSON document rather than a row per key. There are eight settings; a
     * row each means eight round trips, eight migrations, and eight chances for
     * a partial write to leave a layout nobody chose. The shape is validated on
     * read by `lib/prefs/schema.ts`, which is what lets a blob from an older
     * build degrade to defaults instead of crashing the page.
     */
    preferences: jsonb('preferences'),
    /**
     * Profile picture. Stored through lib/storage (never a vendor URL), so the
     * storage backend stays swappable; this column holds only the key we can
     * resolve back to an image.
     */
    avatarUrl: text('avatar_url'),
    /** Subscription tier (source of truth for pricing/features is lib/plans). */
    plan: planEnum('plan').notNull().default('free'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('users_provider_external_uq').on(t.authProvider, t.externalId),
    unique('users_username_uq').on(t.username),
  ],
)

// ── Password credentials (off-Pi sign-in) ────────────────────────────────────
//
// One row per user, reachable by either identifier. `email` belongs to accounts
// created with email + password; `piUsername` is set only when a Pi-verified
// user claims their own username through the Pi SDK, which is what lets them
// sign in outside the Pi Browser without anyone being able to claim a username
// they do not own. Both are nullable — a row needs at least one, not both.

export const credentials = pgTable('credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  email: text('email').unique(),
  /** Set only after Pi SDK verification proved this user owns the username. */
  piUsername: text('pi_username').unique(),
  /** scrypt hash as "saltHex:hashHex" — never a plaintext password. */
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Email verification & password reset codes ────────────────────────────────
//
// One live code per (email, purpose). Issuing a new code replaces the previous
// one rather than adding to it: a mailbox holding five valid codes at once is
// five chances for a guess, and a reader looking at five near-identical emails
// cannot tell which is current.
//
// The code itself is never stored. `codeHash` is the same scrypt hash used for
// passwords, which matters more here than it looks: a six-digit code has only a
// million possibilities, so a plain-text column would hand every pending code to
// anyone who ever reads a backup. scrypt makes even an offline sweep of the
// whole keyspace cost days per code, and `attempts` makes an online one cost
// five tries.

export const verificationPurposeEnum = pgEnum('verification_purpose', ['signup', 'reset'])

export const verificationCodes = pgTable(
  'verification_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Normalised (trimmed, lowercased) address the code was sent to. */
    email: text('email').notNull(),
    purpose: verificationPurposeEnum('purpose').notNull(),
    /** scrypt hash as "saltHex:hashHex" — never the code itself. */
    codeHash: text('code_hash').notNull(),
    /** Wrong guesses so far. The row dies at the limit, not the request. */
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Set the moment a code is spent, so a correct code still works only once. */
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('verification_codes_email_purpose_uq').on(t.email, t.purpose),
    // Expired rows are swept by address, and by age when nobody comes back.
    index('verification_codes_expires_idx').on(t.expiresAt),
  ],
)

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
  /**
   * Which gateway produced this run. Nullable because rows written before
   * history existed are still real history and must not be thrown away.
   */
  gateway: text('gateway'),
  /**
   * How many findings the run produced, stored so a history list can say
   * "12 findings" without loading every finding to count them.
   */
  findingCount: integer('finding_count').notNull().default(0),
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
  /** Admiralty rating as `source/info`, e.g. "A/1" (charter §6). */
  admiralty: text('admiralty'),
  /** Watchlist feed key this finding was read from (internal findings). */
  feed: text('feed'),
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

// ── Calibration ledger (we grade our own & others' forecasts vs. outcomes) ────

export const calibrationClaims = pgTable(
  'calibration_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Who made the claim: 'us' (our own graded analysis) or 'external'. */
    authorKind: calibrationAuthorKindEnum('author_kind').notNull(),
    /** Display author — 'Lambda NX' or the external source/outlet. */
    author: text('author').notNull(),
    claim: text('claim').notNull(),
    topic: text('topic'),
    assertedAt: timestamp('asserted_at', { withTimezone: true }).notNull().defaultNow(),
    /** When this claim should be judged. */
    horizon: timestamp('horizon', { withTimezone: true }),
    status: calibrationStatusEnum('status').notNull().default('open'),
    /** Set when resolved: how it turned out. */
    outcome: calibrationOutcomeEnum('outcome'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    note: text('note'),
    sourceUrl: text('source_url'),
    confidence: confidenceEnum('confidence').notNull().default('possible'),
    /** Stable hash (author + claim), for de-duplication. */
    dedupeHash: text('dedupe_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('calibration_status_idx').on(t.status),
    index('calibration_horizon_idx').on(t.horizon),
    index('calibration_author_idx').on(t.author),
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

// ── Private usage registry (admin-only; never surfaced in the product) ────────

/**
 * Who reaches the app, and from which country. This exists so the operator can
 * answer "who is using Lambda NX, and where from" — it is deliberately NOT shown
 * anywhere in the product (charter §3: no public exposure of internal detail).
 *
 * Data-minimized on purpose:
 *  - **No IP address is ever stored.** The country is derived from the edge
 *    provider's geo header (Vercel / Netlify / Cloudflare) and only the coarse
 *    country (+ optional region) is kept.
 *  - Signed-in visitors get **one row each**, keyed by their identity, so the
 *    operator sees a real list of Pi usernames with their country and activity.
 *  - Anonymous visitors are **aggregated per country** (subjectKey `anon:<cc>`),
 *    never tracked individually — no per-guest identifier, no cookie for them.
 *
 * `subjectKey` is the collapse key: `pi:<uid>`, `user:<userId>` (standalone),
 * or `anon:<countryCode>`. A repeat visit upserts the same row (bumps count,
 * refreshes last-seen and country), so the table stays one-row-per-subject.
 */
export const visitors = pgTable(
  'visitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Collapse key — one row per subject. See table doc. */
    subjectKey: text('subject_key').notNull(),
    /** The signed-in user, when known (null for anonymous / after deletion). */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Which auth path this subject arrived on (null for anonymous). */
    provider: authProviderEnum('provider'),
    /** Pi username or standalone email snapshot — the human-readable identity. */
    displayName: text('display_name'),
    /** ISO-3166 alpha-2, uppercase (e.g. "DE"). Null if the edge gave no geo. */
    countryCode: char('country_code', { length: 2 }),
    /** Full country name resolved from the code, for a readable admin list. */
    countryName: text('country_name'),
    /** Coarse region/subdivision when the edge provides it (never a city). */
    region: text('region'),
    /** How they were using it at last sight (e.g. "pi", "standalone", "guest"). */
    lastMode: text('last_mode'),
    visitCount: integer('visit_count').notNull().default(1),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('visitors_subject_uq').on(t.subjectKey),
    index('visitors_country_idx').on(t.countryCode),
    index('visitors_last_seen_idx').on(t.lastSeenAt),
  ],
)

// ── Publishing (the home feed: posts, shared research, spotted signals) ───────

/**
 * A published item. Publishing happens on the app itself; each post has a stable
 * public permalink so it can be shared outside the app and drive discovery.
 *
 * The author's display name is snapshotted so a post keeps its byline even if the
 * account is later deleted (the FK then nulls, the post survives — like
 * suggestions). Evidence/dossier posts carry a source link so the claim always
 * traces back (charter §1).
 */
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Byline snapshot (Pi username / email) — survives account deletion. */
    authorName: text('author_name'),
    kind: postKindEnum('kind').notNull().default('post'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** Origin link for research/signal posts, so every claim is traceable. */
    sourceUrl: text('source_url'),
    /** Optional gateway/subject this was published from (for "open in app"). */
    refType: text('ref_type'),
    refValue: text('ref_value'),
    /** BCP-47 language of the post body, for i18n display. */
    locale: text('locale'),
    visibility: postVisibilityEnum('visibility').notNull().default('public'),
    /** Lightweight engagement counters (reactions table lands with the social layer). */
    likeCount: integer('like_count').notNull().default(0),
    repostCount: integer('repost_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('posts_visibility_created_idx').on(t.visibility, t.createdAt),
    index('posts_author_idx').on(t.authorUserId),
  ],
)

// ── Social publishing channels ───────────────────────────────────────────────
//
// Where a published post can be broadcast. Only platforms we can actually
// deliver to are represented: an outgoing webhook (which covers Discord, Slack
// and every automation tool that accepts one) and the Telegram Bot API. The
// networks that require an approved OAuth application are deliberately absent
// rather than present and broken.

export const socialPlatformEnum = pgEnum('social_platform', [
  'webhook',
  'discord',
  'slack',
  'telegram',
])

export const socialChannels = pgTable(
  'social_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platform: socialPlatformEnum('platform').notNull(),
    /** Operator-facing name, e.g. "Team Discord" or "Public announcements". */
    label: text('label').notNull(),
    /** Webhook URL, or the Telegram chat id to post into. */
    target: text('target').notNull(),
    /**
     * AES-256-GCM ciphertext of a bot token, never the token itself. Null for
     * channels whose target URL is the only credential (webhooks).
     */
    secretEnc: text('secret_enc'),
    /** Off means nothing is ever sent here, by any path. */
    enabled: boolean('enabled').notNull().default(true),
    /** On means new posts are broadcast without anyone pressing a button. */
    autoPublish: boolean('auto_publish').notNull().default(false),
    /** Restrict auto-publishing to one post kind; null broadcasts them all. */
    kindFilter: postKindEnum('kind_filter'),
    /** Last delivery outcome, so a silently broken channel is visible. */
    lastStatus: text('last_status'),
    lastError: text('last_error'),
    lastAt: timestamp('last_at', { withTimezone: true }),
    deliveredCount: integer('delivered_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('social_channels_enabled_idx').on(t.enabled, t.autoPublish)],
)

// ── Groups ───────────────────────────────────────────────────────────────────
//
// A deliberately small social layer. The cap of two groups per owner is a
// product rule, not a storage one, so it lives in lib/modules/groups where it
// can be tested — but the schema records ownership so the rule has something to
// count.

export const groupRoleEnum = pgEnum('group_role', ['owner', 'admin', 'member'])
export const groupVisibilityEnum = pgEnum('group_visibility', ['public', 'private'])

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    /** URL-safe handle, unique across the platform. */
    slug: text('slug').notNull().unique(),
    visibility: groupVisibilityEnum('visibility').notNull().default('public'),
    /** Random, rotatable code that lets someone join a private group. */
    inviteCode: text('invite_code').notNull().unique(),
    memberCount: integer('member_count').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('groups_owner_idx').on(t.ownerUserId)],
)

export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: groupRoleEnum('role').notNull().default('member'),
    /** Blocked members keep their row, so a ban cannot be undone by re-joining. */
    blocked: boolean('blocked').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('group_members_group_user_uq').on(t.groupId, t.userId),
    index('group_members_user_idx').on(t.userId),
  ],
)


// ── Blobs (durable object storage) ───────────────────────────────────────────
//
// The storage port defaulted to the filesystem, which is right for a
// self-hosted box and silently wrong everywhere this app actually runs: on
// Netlify and Vercel the function filesystem is ephemeral, so a profile picture
// written during one request was gone by the next deploy. The upload reported
// success, the users row kept a URL pointing at nothing, and the picture
// quietly reverted to initials with no error anywhere.
//
// Blobs therefore live in the database — the one component here that is already
// durable, backed up and shared by every instance. For avatar-sized objects
// (capped at 2 MB) that beats adding a vendor: no new key to leak, nothing new
// to be locked into, identical behaviour on every host. The storage port is
// unchanged, so moving to S3 later stays a provider switch (charter §4).

export const blobs = pgTable(
  'blobs',
  {
    /** Storage key, e.g. `avatars/<user-id>/<version>.png`. */
    key: text('key').primaryKey(),
    contentType: text('content_type'),
    bytes: bytea('bytes').notNull(),
    /** Denormalised so a size query never has to read the payload. */
    size: integer('size').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('blobs_key_prefix_idx').on(t.key)],
)

// ── The platform's record of itself ──────────────────────────────────────────
//
// Every source carries an Admiralty rating we *declared* when we wrote its
// record. This table holds what each source has actually *done*, so the two can
// be compared — see lib/engine/reliability.ts. A feed that has rotted goes on
// carrying its A forever unless something is counting.
//
// Aggregated per source per day rather than one row per run, deliberately. A
// row per run grows without bound and buys nothing: the questions this data
// answers — is it reachable, does it carry anything, when did it last work —
// are all answerable from daily counters, and a bounded table is one nobody has
// to remember to prune.

export const sourceHealthDaily = pgTable(
  'source_health_daily',
  {
    /** The source key, matching the catalogue record or the coded source. */
    sourceKey: text('source_key').notNull(),
    /** UTC calendar day, `YYYY-MM-DD`. Text, because it is a label not an instant. */
    day: char('day', { length: 10 }).notNull(),
    /** Runs where it answered and produced at least one item. */
    ok: integer('ok').notNull().default(0),
    /** Runs where it answered and produced nothing. Not failure; not health. */
    empty: integer('empty').notNull().default(0),
    /** Runs where it did not answer, or answered with an error. */
    failed: integer('failed').notNull().default(0),
    /** Items contributed that day, before deduplication. */
    items: integer('items').notNull().default(0),
    /** The most recent error text, kept so a failure can be diagnosed at all. */
    lastError: text('last_error'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One row per source per day is the whole storage model, so it is enforced
    // by the primary key rather than by the code that writes it.
    unique('source_health_daily_pk').on(t.sourceKey, t.day),
    index('source_health_daily_day_idx').on(t.day),
  ],
)

// ── Email followers ─────────────────────────────────────────────────────────
//
// People who asked to be sent the brief. A row exists the moment somebody types
// an address, but it is pending: nothing is ever sent to it except the single
// message asking whether they meant it, and only a click on that link sets
// `confirmedAt`.
//
// That is not etiquette. Without it a subscribe box on a public platform is a
// machine for mailing strangers — and from the same domain the verification
// codes come from, so one abused form takes the whole sign-in system's
// deliverability down with it.
//
// Neither token is stored. A leaked backup of plain unsubscribe tokens is a
// leaked list of who reads us; a leaked confirm token is a way to subscribe
// somebody who declined.

export const emailFollowers = pgTable(
  'email_followers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Normalised (trimmed, lowercased). One subscription per address, ever. */
    email: text('email').notNull(),
    /** The language their brief is written in, from the interface they used. */
    locale: text('locale').notNull().default('en'),
    /** scrypt hash as "saltHex:hashHex" — never the token itself. */
    confirmTokenHash: text('confirm_token_hash').notNull(),
    /**
     * Also hashed, and deliberately long-lived: it is printed in every message
     * we ever send, so unlike the confirm token it cannot be single-use.
     */
    unsubscribeTokenHash: text('unsubscribe_token_hash').notNull(),
    /** Null until they click the link. Nothing is sent to a null row. */
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    /**
     * Set when they leave. The row is kept rather than deleted so a later
     * re-subscribe is a deliberate act, not a silently restored old one.
     */
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('email_followers_email_uq').on(t.email),
    index('email_followers_sendable_idx').on(t.confirmedAt),
    index('email_followers_pending_idx').on(t.createdAt),
  ],
)
