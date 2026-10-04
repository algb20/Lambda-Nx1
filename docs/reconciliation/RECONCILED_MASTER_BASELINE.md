# Lambda NX — Reconciliation & Current-System Baseline

| | |
|---|---|
| **Stage** | **30.27.8.RB** — Master / Repository / Claude Reconciliation & Current-System Baseline (ID AGREED 2026-10-03, decision 1; see CONF-P05 and §14). |
| **Status** | REQUIRED → RESEARCH / AUDIT. Audit performed; every reconciliation below is PROPOSED unless marked AGREED. Nothing in this document is IMPLEMENTED against the Master. |
| **Date** | 2026-10-03 |
| **Evidence base** | Repository `algb20/Lambda-Nx1`, branch `claude/bittorent-network-app-c8j9pv`, commit `8f9c713`, working tree clean. Test run 2026-10-03: 197 test files passed, 1 skipped (198); 2750 tests passed, 10 skipped (2760); `tsc --noEmit` exit 0. Live observations are dated individually. |
| **Inputs** | (1) *Lambda NX — Master Living Implementation Blueprint* (5516 lines; layers dated 2026-09-25, 2026-09-26 and 2026-10-03). (2) *Lambda NX — Research, Rules, Method & Claude Operating Manual* (1239 lines; layers dated 2026-09-19 and 2026-10-03). (3) `CLAUDE.md` in the repository. (4) The repository itself. |
| **Code changed by this stage** | None. This stage is audit and documentation only. |

---

## 0. How to read this document

### 0.1 Three layers that must not be mixed

```
Lambda NX
├── L1  Existing System            what the repository and the deployed systems actually contain
│       (evidence: code paths, tests, live observations)
├── L2  Target Architecture        the Master Living Implementation Blueprint
│       (status: as stated in the Master — never upgraded by this document)
└── L3  Execution Governance       how Claude works between L1 and L2
        (CLAUDE.md as the repository execution/operations contract, reconciled with the Master)
```

The order of work that follows from this, as directed by the owner:

```
CURRENT REPOSITORY → BASELINE AUDIT → RECONCILIATION → MASTER LIVING BLUEPRINT
→ EXACT IMPLEMENTATION SPEC → CLAUDE → CODE ONLY → TEST / VERIFY → ACCEPTANCE
```

### 0.2 Evidence classes for L1 (repository and live systems)

| Class | Meaning |
|---|---|
| **RP** — REPO-PRESENT | Code exists at the cited path at commit `8f9c713`. |
| **RT** — REPO-TESTED | Repository tests covering it exist and passed in the 2026-10-03 run. These tests verify the repository's behaviour **as written under CLAUDE.md**. They are not Master acceptance tests. |
| **LO** — LIVE-OBSERVED | Observed on a deployed system, with the date of observation. |
| **NP** — NOT PRESENT | Searched for and not found. The search terms are stated. |
| **UV** — UNVERIFIED | Not checked in this audit. |

### 0.3 Classification of L1 against L2

| Class | Meaning |
|---|---|
| **NOT IMPLEMENTED** | No repository code for the Master capability. |
| **PRECURSOR** | Repository code implements a *related* capability that a Master contract could migrate from. It is not an implementation of that contract. |
| **NON-CONFORMANT** | Repository code exists and contradicts an explicit Master rule. |

**No item in this document is IMPLEMENTED, INTEGRATED, TESTED, EVALUATED or ACCEPTED in Master terms.** The Master's own §70.16 records that no implementation package has yet been issued, and no Master acceptance test exists to have been passed.

### 0.4 The six separations the owner required

Every finding is placed in one of these, and they are kept apart throughout:

- **Current Repository Reality** — facts about what exists: files, stack, counts, deployment state (§1, §2).
- **Existing Implementation** — what that code actually does (§2, and the Existing Implementation column of §3).
- **Master Specification** — what the Master requires, at the status the Master gives it (§3).
- **Required Migration** — what must change for L1 to meet L2, and what it depends on (§10).
- **Research Required** — questions this audit cannot answer from evidence (marked inline and collected in §12.6).
- **Not Implemented** — Master capabilities with no repository code (§3).

---

## 1. Current System Baseline

### 1.1 Stack (RP — `package.json`)

| Component | Version |
|---|---|
| Next.js | ^15.5.25 (App Router) |
| React | ^19 |
| TypeScript | ^5 |
| Tailwind CSS | ^4.1.9 |
| Drizzle ORM / drizzle-kit | ^0.45.2 / ^0.31.10 |
| Postgres driver | `postgres` ^3.4.9 (postgres-js; `pg` not used) |
| Anthropic SDK | ^0.115.0 (AI analyst) |
| Zod | 3.25.67 |
| Vitest / playwright-core | ^4.1.11 / ^1.62.1 |

### 1.2 Repository size (RP — measured 2026-10-03)

| Measure | Count |
|---|---|
| Commits | 208 |
| Tracked files | 808 |
| TypeScript / TSX files | 684 |
| Test files | 198 (including 4 browser suites and 1 database integration suite) |
| API routes | 84 |
| Pages | 9 |
| UI components | 87 |
| SQL migrations / journal entries | 24 / 24 |

### 1.3 Hosting and runtime

| Element | Evidence | Class |
|---|---|---|
| Netlify configuration | `netlify.toml`; scheduled function `netlify/functions/scheduled-jobs.mts` | RP |
| Production site | `melodious-tiramisu-8edae7.netlify.app`. Last observed **2026-08-28**: deployed build `51fb55a`, which lagged `main` by 12 commits; `/api/health` returned 503 because `SESSION_SECRET` was unset; `PI_API_KEY` and `ANTHROPIC_API_KEY` reported configured; `DATABASE_URL` unset. | LO (stale) |
| Currently deployed commit | Not re-observed in this audit. | UV |
| Vercel | `vercel.json` is present, but the Vercel account had **zero projects** when observed in 2026-08, so its cron schedules are read by nothing. | RP + LO (2026-08) |

### 1.4 Data (Supabase / PostgreSQL)

**Repository side.** 24 tables are defined in `db/schema.ts`, folded into the idempotent `db/schema.sql`. There are 24 migrations and 24 journal entries.

**Live side.** Supabase project `roykbyzkskhmzclzobmd` ("Lambda-NX", eu-central-1, PostgreSQL 17.6). Observed on **2026-10-03**:

| Item | Observation | Class |
|---|---|---|
| Project state | Was `INACTIVE` (paused). Restored on 2026-10-03. | LO |
| Tables | 25: the 24 schema tables plus a stray empty table `"L"` (columns `id`, `created_at`). | LO |
| Row-level security | 4 tables were open before the change. After it, **25 of 25** have RLS on, with no policies. | LO |
| Foreign-key indexes | The 6 unindexed foreign keys in our schema were indexed. 7 unindexed foreign keys remain, all in Supabase's own `auth` and `storage` schemas. | LO |
| Migration history | `drizzle.__drizzle_migrations` did not exist. It was created and baselined with 24 rows (sha256 per file plus journal timestamp). | LO |
| Data volume | 3 users · 3 credentials · 52 posts · 837 radar findings · ~1237 source-health-day rows · 41 ontology nodes · 38 edges · 3 visitors. | LO |
| Supabase advisors | The critical `rls_disabled_in_public` finding is cleared. Remaining INFO findings: `rls_enabled_no_policy` ×25 (by design), `no_primary_key` ×1 (`source_health_daily`), `unused_index` ×32. | LO |
| Other projects in the same Supabase organisation | "algb20's Project", "VaultPi" and "Dabia". Out of scope. Their presence is not evidence about World Pi (§5). | LO |

> **Disclosure.** The live changes recorded above (RLS, indexes, migration-history baseline, and deletion of one verification code that had been expired since 2026-08-27) were made by Claude on 2026-10-03 under the owner's explicit instruction "اصلح كل قاعدة البيانات", before this reconciliation stage existed. They are recorded in the ledger (R290) and in commit `00c0b54`. Under the reconciled execution contract (§11) these are **live-system operations** and need per-action authorisation.

### 1.5 Application surface (RP)

| Area | Evidence |
|---|---|
| Intelligence engine | `lib/engine` — guardrail, orchestrator, source adapters, catalogue, licence gate, quarantine, independence groups (`origins.ts`). |
| Source catalogue | 247 integrations · 243 licence-clear · 165 active · 42 quarantined · 233 keyless · 190 hosts · 180 independent origins · 14 reach families. Measured 2026-09-06 at `57c3dad`. No catalogue or gateway file has changed since (0 files differ to `HEAD`). |
| Gateways | 33 modes in 7 families (`lib/gateways.ts`). |
| World picture | `/api/world` and `/api/world/stream` (SSE), served from cache. **Not persisted to the database.** |
| Globe and map | `components/world-surface.tsx`, `components/globe-view.tsx`, a time scrubber, a density axis, a place-name reference layer (Natural Earth 1:50m) and country outlines (Natural Earth 1:110m). |
| Analysis | `lib/analysis` — significance, country risk, corridors, timeline, impact. `lib/engine/analysis.ts` — confidence grading, deduplication, graph. |
| AI analyst | `lib/ai` — a Claude provider, a deterministic fallback and a disabled mode. |
| MCP server | `app/api/mcp`, protocol `2024-11-05`, 6 tools (`world_events`, `country_risk`, `country_ranking`, `corridor_status`, `gateway_query`, `source_health`). |
| Accounts | Pi sign-in and standalone email/password sign-in, both live at once (§5.3). |
| Payments | Pi (default) or Stripe ("standard"). A plan is granted on `complete` only. |
| Publishing | `lib/modules/autopublish.ts` (AUTO, no human in the loop) and social broadcast gated per channel. |
| Monitoring | `monitors` and `alerts` tables, a radar-monitors cron job, HMAC-signed alert delivery. |
| Calibration | `calibration_claims` plus `/api/calibration{,/due,/resolve}`. The scoreboard computes weighted accuracy. |
| Operations | `/api/health` (shallow and deep), `/setup` diagnostics, posture checks, a release packager with a secret scan, a scheduled retention job. |

---

## 2. Repository Reality Matrix

How to read the columns: **Code** is the RP evidence. **Tests** names the RT evidence; "—" means no repository test was identified for that row. **Live** is LO (with date), UV, or "n/a" (no live counterpart).

| # | Subsystem | Code (RP) | Tests (RT) | Live | What it actually does |
|---|---|---|---|---|---|
| R01 | Passive guardrail | `lib/engine/guardrail.ts`, `lib/security/posture.ts` | engine, posture tests | UV | Allow-listed hosts, read-only methods, licence gate. Five live posture checks. |
| R02 | Source catalogue / registry | `lib/engine/catalog/*` (record type at `types.ts:113-245`) | `catalog.test.ts`, `origins.test.ts`, `recheck.test.ts` | UV | Declarative records: key, publisher, url, kind, discipline, topics, coverage, Admiralty, independence, licence, minimum interval, keyless or key variable, field mapping. |
| R03 | Licence gate | `lib/engine/catalog/licence.ts` | yes | n/a | Three permissions — commercial, storage, redistribution — plus attribution and terms URL. Usage requires all three. |
| R04 | Source health | `quarantine.ts`, `source_health_daily`, world-event `sourceHealth` | yes | LO 2026-10-03 (≈1237 rows) | Runtime statuses `ok`, `cached`, `empty`, `failed`. Daily counters. Quarantine with recheck. |
| R05 | Source adapter | `lib/engine/types.ts:183` `run(input, ctx): Promise<Evidence[]>`; `lib/engine/orchestrator.ts` | engine tests | n/a | One execution method. Fallback and redundancy live at orchestrator level. |
| R06 | Evidence model | `lib/engine/types.ts:82-170`; `evidence` table | engine tests | LO (table present) | Claim, source key and URL, retrieved time, published time (engine only), Admiralty, confidence, raw payload, archive URL, content hash. |
| R07 | Confidence grading | `lib/engine/analysis.ts:25-40` | `engine.test.ts:231-…` | n/a | **Counts distinct `sourceKey` values, not independent origins** (CONF-V04). |
| R08 | Entity graph | `entities`, `entity_links`; `buildGraph` | yes | LO (tables present) | Per-investigation entities and links. |
| R09 | Ontology memory | `ontology_nodes`, `ontology_edges`; `/api/ontology{,/global}` | yes | LO (41 nodes, 38 edges) | A global node/edge store with mention counts and sources. |
| R10 | World events | `lib/modules/world-events*.ts` | many | UV | Graded hazard and news events. `observedAt` is the publisher's time and `at` is the retrieval time. Not persisted. |
| R11 | Ranking and significance | `lib/analysis/significance.ts`, `world-events-shared.ts` | yes | n/a | Severity, age decay and diversity caps. Uses independence groups (`originOf`). |
| R12 | Change and trend | `lib/analysis/timeline.ts` (compares the recent half of a window with the earlier half) | yes | n/a | An implicit baseline. No declared baseline object. |
| R13 | Monitoring and alerts | `monitors`, `alerts`, `lib/alerts/delivery.ts`, radar-monitors job | yes | UV | Fingerprint-change monitors. HMAC-signed delivery. |
| R14 | Radar | `lib/radar`, `radar_findings` | yes | LO (837 rows) | Sweeps security and research feeds into findings. |
| R15 | Calibration ledger | `lib/modules/calibration.ts`, `calibration_claims` | `calibration.test.ts` | UV | Claims with a horizon, a categorical confidence and an outcome. Weighted accuracy by author and by confidence. |
| R16 | Publishing | `lib/modules/autopublish.ts`, `publish-job.ts`, `lib/social/*` | yes | LO (52 posts) | AUTO only. Threshold, no paraphrase, deduplication, a per-run cap. |
| R17 | AI analyst | `lib/ai/*` | yes | LO 2026-08-28 (key configured) | Single-call analysis with a deterministic fallback. No licence or policy check before model context. |
| R18 | MCP server | `lib/mcp/server.ts`, `app/api/mcp` | yes | UV | 6 tools, protocol `2024-11-05`, origin pinned to configuration. |
| R19 | Visualization | globe and map, time scrubber, constellation, board, country dossier, markets panel, places layer | unit + 4 browser suites | UV | Canvas globe and map with clustering, layers, density and URL view-state. |
| R20 | Workspace state | `lib/prefs/*`, `lib/globe/view-state.ts`, `/api/export/share` | yes | n/a | Per-user preferences (local and account), URL view-state, shared dossier permalinks. |
| R21 | Authentication | `lib/auth/*`, `app/api/auth/*` | yes | LO 2026-08-28 (Pi key configured) | Pi through the provider factory. Standalone through direct imports (§5.3). Signed sessions. |
| R22 | Payments | `lib/payments/*` | yes | UV | Pi approve, complete and cancel. Stripe provider. Plan granted on completion only. |
| R23 | Security controls | RLS migration `0022`; `lib/rate-limit.ts`; `lib/auth/sign-in-limit.ts`; `lib/http/self-origin.ts`; `lib/security/csp.mjs`; `secret-scan.mjs`; admin and cron gates | yes | LO (RLS 25/25, 2026-10-03) | Deny-by-default RLS; gateway, write, sign-in and code rate limits; CSP; secret scanning; host-header hardening. |
| R24 | Data protection | `repo.users.remove` (transactional erasure); retention job | `erasure.integration.test.ts` (**skipped** in this run; last passed 2026-09-06 on local PG16) | LO (retention applied 2026-10-03) | Erasure of the person across all tables, anonymised visitor counters, daily purge of expired codes. |
| R25 | Observability | `/api/health`, `lib/db/probe.ts`, `/setup`, `lib/ops/*`, self-audit | yes | LO 2026-08-28 | Health and diagnosis. No traces or metrics pipeline. |
| R26 | API surface | 84 routes; `lib/api-catalog.ts`; `/docs/api`; `/llms.txt` | yes | UV | Custom JSON. **56 of 84 routes** return `{ error }`. |
| R27 | Scheduling | `netlify/functions/scheduled-jobs.mts`, `lib/ops/schedule.ts`, `/api/cron/[job]` | yes | UV | Jobs: publish, radar, radar-monitors, radar-watch, sources, retention. |
| R28 | Storage abstraction | `lib/storage` (filesystem and database blobs) | yes | LO (`blobs` 1 row) | Object storage precursor. |
| R29 | Queue | `lib/queue` (memory) | yes | n/a | In-process only. |
| R30 | Release packaging | `scripts/package.mjs` (full and studio profiles, secret scan, stripping verified by `tsc`) | `scripts/package.test.ts` | n/a | Source bundles. |

---

## 3. Master ↔ Repository Gap Matrix

The **Master Specification** column gives the status as stated in the Master, quoted rather than upgraded. Phase 30 has not closed, and §70.16 records "Implementation: NOT VERIFIED" throughout.

| Master § | Master Specification | Existing Implementation (L1 evidence) | Class | Required Migration | Research Required |
|---|---|---|---|---|---|
| §4 Canonical ontology | 30 core types; domain packs extend | Entities (typed), ontology nodes/edges, evidence, events (in memory), posts, monitors | PRECURSOR (partial) | Map existing types onto the ontology | Ontology ↔ entity-type mapping |
| §6 Canonical envelope | 17 fields on every persistent object | **0 of 8 sampled envelope fields** in any table | NON-CONFORMANT (CONF-S01) | MR-01 | Needs the 30.26 Data Contracts text (not supplied) |
| §7 Provenance / quality / uncertainty | Separate dimensions; never one opaque score | Source URL, retrieval time, Admiralty, licence; categorical confidence grade | PRECURSOR | MR-07 | — |
| §8 Source Control Plane | Registry fields; 7 health states; 14-method connector; lifecycle | R02, R04, R05 | PRECURSOR; health taxonomy NON-CONFORMANT (CONF-S03) | MR-04, MR-05 | Semantics of `cached` and `empty` |
| §9 Licensing and AI Context Firewall | 16 licence fields; policy check before model context | 3 licence booleans plus attribution and terms; **no check before model context** | PRECURSOR + NON-CONFORMANT (CONF-S06) | MR-06 | — |
| §10 Core pipeline | Raw → … → Evaluation | Ingestion → evidence → grading → ranking → publication | PRECURSOR (partial) | Per stage | — |
| §11 Evidence graph / verification ladder | Ladder A (0–6); ladder B (L0–L7) in §70.8 | Admiralty, confidence grade, independence groups | PRECURSOR; ladders unreconciled (CONF-V01..V04) | MR-07 | §7 mapping |
| §12 Temporal world model | Five time axes; point-in-time reconstruction mandatory | `observedAt` and `at` in memory; evidence persists retrieval time only (**publication time dropped**) | PRECURSOR + NON-CONFORMANT (CONF-S02) | MR-02 | 30.26, 30.27.8.M |
| §13 Graph architecture | 8 graph layers, source independence graph | Entity graph, ontology graph, independence groups (180) | PRECURSOR (partial) | — | — |
| §14 Event fabric | IntelligenceEvent; at-least-once, DLQ, replay | No bus; in-memory queue; cron; SSE streams. CloudEvents and DLQ: NP | NOT IMPLEMENTED | MR-09 | — |
| §15 Storage | Postgres canonical; object storage; Iceberg/Parquet; OpenSearch; pgvector; DuckDB | Postgres (live, PG 17.6); blobs abstraction. Others NP (searched: pgvector, opensearch, iceberg, parquet, duckdb) | PRECURSOR (Postgres, objects); NOT IMPLEMENTED (rest) | — | Timing is a Master decision |
| §16 Ingestion | Raw landing, schema drift, replay, entity resolution | Fetch → map → evidence; quarantine on failure; deduplication | PRECURSOR | — | — |
| §17 Change / anomaly / signal | Explicit baselines; detection methods; signal lifecycle | R12 implicit window comparison; R11 significance. Baseline object, EWMA and CUSUM: NP | PRECURSOR (weak) | — | — |
| §18 Monitoring / attention | WatchObject; alert lifecycle | R13 | PRECURSOR | MR-11 | — |
| §19 Forecast | Full forecast pipeline and evaluation | **No Lambda forecasting engine.** Calibration ledger (R15); third-party forecasts labelled as such | PRECURSOR (evaluation side only) — see §6 | MR-08b | — |
| §20 Causal / scenario | Methods; scenario fields | NP (searched: causal, scenario — one hit, a capability label) | NOT IMPLEMENTED | — | — |
| §21 Research / decision / outcome | Research engine; decisions; outcomes | Investigations, AI analyst, standing brief | PRECURSOR (partial) | — | — |
| §22–24 Economy / company / supply chain | Domain coverage | finance, markets, companies, ownership, filings, procurement, crypto gateways | PRECURSOR | — | Domain-pack contract |
| §25–27 Resources / 3D globe / material flow | Resource systems on a 3D/4D globe | `resources` gateway (monthly averages); globe with time scrubber for events | PRECURSOR (weak) | — | — |
| §28–30 Geopolitics / technology / science | Domain coverage | country risk, statements, officials, courts, regulation; research (OpenAlex, Crossref, PubMed) | PRECURSOR | — | — |
| §31 Geospatial world model | GeoEntity with explicit CRS | Natural Earth outlines and places, projection, clustering; CRS implicit (WGS84, undeclared) | PRECURSOR | — | — |
| §32 Earth observation | EO pipeline; STAC catalogue | Catalogue rows for Copernicus Sentinel and USGS Landsat (keyed, inactive). STAC: NP (21 apparent hits were the word "stack") | NOT IMPLEMENTED | — | — |
| §33 Maritime | AIS + EO + SAR + port fusion | NOAA buoys; chokepoint corridors. **"We carry no AIS"** (`components/country-dossier.tsx:274`) | PRECURSOR (weak) | — | — |
| §34 Aviation | Flights, airports | OpenSky excluded by the licence gate | NOT IMPLEMENTED | — | — |
| §35 Infrastructure | Dependency graphs | `grid` gateway; infrastructure feeds | PRECURSOR (weak) | — | — |
| §36 Moving world | Trajectories | NP | NOT IMPLEMENTED | — | — |
| §37 Environment / disaster | Weather, climate, hazards | Hazard authorities (USGS, GDACS, MeteoAlarm…), space weather | PRECURSOR | — | — |
| §38–41 Web / news / narrative / fusion | Claim decomposition; narratives | news, media, broadcasts, trending, GDELT. Narrative: NP | PRECURSOR (news); NOT IMPLEMENTED (narrative) | — | — |
| §42 Automatic discovery | Candidate → verification → adoption | Radar findings; quarantine recheck | PRECURSOR (no adoption lifecycle) | — | — |
| §43 Automatic research | Triggered research tasks | NP | NOT IMPLEMENTED | — | — |
| §44 Automatic publishing | Policy, quality and risk checks; AUTO / REVIEW / HUMAN_ONLY | R16: AUTO only | NON-CONFORMANT (partial) (CONF-L01) | MR-08 | — |
| §45 Live intelligence | Freshness classes; timestamps, latency, health per item | Publisher and retrieval times; live-edge KPI; source health; SSE | PRECURSOR | — | — |
| §46–47 Visualization / adaptive globe | 20 visual primitives; deep exploration | Globe, map, time scrubber, constellation, board, dossier, tables | PRECURSOR (partial) | — | — |
| §48 Intelligence inbox | Typed items with context | NP (alerts and brief exist; no inbox) | NOT IMPLEMENTED | — | — |
| §49–50 Evidence-first UI / adaptive workspace | UIAction contracts; workspace | Preferences, URL view-state, density, panels | PRECURSOR (ViewState-like; no AnalyticalContext) | MR-10 | — |
| §51–52 Agent runtime / protocols | Controlled runtime; A2A; MCP | No agent runtime; MCP server at `2024-11-05`; A2A NP | NOT IMPLEMENTED (runtime); NON-CONFORMANT? (MCP version, CONF-A03) | MR-12 | **Verify MCP 2026-07-28** |
| §53 Security / governance | Tenant isolation, RBAC+ABAC, classification, audit | Sessions, plan gates, admin secret, RLS deny-all, rate limits, CSP. Tenant, RBAC, ABAC, classification: NP | PRECURSOR (partial) | — | — |
| §54–55 Resilience / observability | Recovery controller; OpenTelemetry | Health, diagnosis, quarantine, retries in sources. OpenTelemetry: NP | PRECURSOR (partial) | — | — |
| §56–58 Evaluation / drift / knowledge evolution | Evaluation sets; drift; proposals | 198 test files; calibration ledger. Golden / point-in-time / adversarial sets: NP | PRECURSOR (partial) | — | — |
| §59 Domain packs | DomainPack contract | 33 gateways in 7 families | PRECURSOR | — | Gateway → domain-pack mapping |
| §61 Infrastructure / deployment | Edge → API → … → storage; staging, canary | Netlify + Supabase; one production site; no staging | PRECURSOR (partial) | — | — |
| §62 API / event compatibility | OpenAPI 3.2; JSON Schema; RFC 9457; cursors; ETag; idempotency; CloudEvents | Custom JSON; `{ error }` in 56 of 84 routes; 0 `problem+json`; cursor, ETag and idempotency NP | NON-CONFORMANT (CONF-A01); NOT IMPLEMENTED (gap, no register entry) | MR-03 | — |

---

## 4. CLAUDE.md ↔ Master Governance Reconciliation

Owner direction (AGREED, 2026-10-03):

- The **Master is the primary architectural reference.**
- **CLAUDE.md is the execution and operations reference for the repository.** It cannot cancel a Master requirement.
- SPECIFIED ≠ IMPLEMENTED.

| CLAUDE.md clause | Master counterpart | Relationship | Proposed reconciliation | Register |
|---|---|---|---|---|
| §1 Identity: "multi-gateway intelligence platform", OSINT core, Pi app + standalone | §0 / §2 / §68: Global Living Intelligence Platform | Different scope | Master identity is the target. CLAUDE.md §1 describes the **current implementation surface**. Gateways are domain-pack precursors. | CONF-G04 |
| §1 "removed … future-prediction 'forecasts'" | §10, §19, §68: Forecast is a core stage | Contradiction | Forecasting **stays** (owner direction). Amend the wording — see §6. | CONF-F01 |
| §1 "removed … agentic swarm" | §51: "not an agent swarm"; controlled runtime | Compatible | Keep. A swarm stays forbidden; the controlled runtime is the target. | — |
| §1 "Design preservation … no redesign" | §46–50: new surfaces | Partial tension | Keep the visual language. Master defines new surfaces. "No redesign" applies to the existing look, not to Master-specified surfaces. | CONF-G07 |
| §2.1 No temporary solutions | §1, §34 (rules) | Compatible | — | — |
| §2.2 "Comprehensive research, always" | §67, §69.2, §69.10, §70.6: Claude does not research architecture | Contradiction | Re-scope (see §11.3). | CONF-G01 |
| §2.3 Our own technology | §1 no irreplaceable dependency | Compatible | — | — |
| §2.4 Safe portability | §1, §15, §61 | Compatible. Note CONF-X03: the auth "switch" is not actually a switch | — | CONF-X03 |
| §2.5 Living task list (`docs/PLAN.md`: 71 done / 4 open) | §64, §70.5 status vocabulary | Status-vocabulary mismatch | PLAN.md becomes the repository backlog. Master statuses govern specification. "Done" in PLAN.md means at most RP + RT. | CONF-G05 |
| §2.6 One engine, many gateways | "One World Model + one Intelligence Core + many workflows"; §59 domain packs | Compatible in principle | Gateways map to domain packs or workflows (RESEARCH REQUIRED: mapping). | — |
| §2.7 Preserve the design | §29 (rules): premium, no purple-heavy, no decorative 3D | Compatible: primary colour is green (`oklch(… 152)`, `app/globals.css:15`) | — | — |
| §2.8 Beat the field; 30 competitors; "one million sources" target | §65 research policy (research stage); forbids source-count inflation | Ownership conflict and target conflict | Field study moves to the research stage. The source target is retained only as labelled reach. | CONF-G01, CONF-G06 |
| §2a Counting sources honestly | §13 source independence; "source-count inflation" forbidden | Compatible. **L1 violates both:** CONF-V04 and CONF-Q02 | — | CONF-V04, CONF-Q02 |
| §3 Legal and ethical guardrails | §1 public / authorized only; no private surveillance | Compatible. Master "Person" type is bounded by "no sensitive personal profiling" | — | — |
| §4 Architecture: Next.js, Drizzle, isolation layers, Netlify + Supabase | §15, §61 (vendor-neutral) | Compatible as layers. CLAUDE.md §4 describes L1, the Master describes L2 | — | — |
| §5 Git and workflow | rules §36 report format | Compatible | — | — |
| §6 Definition of Done | §63, §70.14 completion chain | Weaker gate that can be misread as COMPLETE | Rename to "repository merge gate". Map it to RP + RT at most. | CONF-G03 |
| Standing owner instructions in the ledger: "fix every error and vulnerability immediately", "be the expert" | §69.2, §70.6: stop and report at a gap | Contradiction | A maintenance lane (§11.2). Currently suspended by "لا تنفذ أي كود جديد الآن". | CONF-G02 |

---

## 5. Pi / Existing-System Boundary

### 5.1 Pi inside Lambda NX — what the code actually does (RP; LO where dated)

| Role | Evidence |
|---|---|
| **Identity provider (default)** | `lib/auth/index.ts:12` uses `AUTH_PROVIDER ?? 'pi'`. The server verifies the token at `api.minepi.com/v2/me` (`lib/auth/pi.ts:7-20`). Routes: `app/api/auth/pi/route.ts`, `…/pi/claim/route.ts`. Client: `components/pi-sign-in.tsx`, `contexts/pi-auth-context.tsx`, `lib/auth/pi-client.ts`, `pi-identity.ts`, `pi-username-link.tsx`. |
| **Payment provider (default)** | `lib/payments/index.ts:37` uses `PAYMENT_PROVIDER ?? 'pi'`. Approve, complete and cancel run server-side with `PI_API_KEY` (`lib/payments/pi.ts`). The plan is granted on `complete` only (`lib/payments/checkout.ts:68-95`). Alternative provider: `standard` (Stripe). |
| **Distribution channel (Pi Browser)** | `lib/auth/pi-probe.ts` (detects Pi Browser by handshake), `lib/auth/environment.ts`, domain verification files `public/validation-key.txt` and `public/piapp-link-verification.txt`, SDK `sdk.minepi.com` (`lib/system-config.ts:9`). |
| **Isolation** | Behind `lib/auth` and `lib/payments` (CLAUDE.md rule #4), with one exception: CONF-X03. |
| **Live** | `PI_API_KEY` reported configured on 2026-08-28 (LO, stale). |

**Classification.** Pi is part of the **Existing System**. It is an external identity and payment provider, and a distribution channel, of Lambda NX. The Master does not mention Pi Network at all; that gap is recorded as CONF-X02.

### 5.2 World Pi — a separate project

| Artefact in this repository | Origin | Runtime use |
|---|---|---|
| `public/branding/world-pi-logo-radar-1024.png` | commit `6cdd821` ("Add the two World Pi logos at the 1024x1024 upload spec") | none (0 references in `app`, `components`, `lib`) |
| `public/branding/world-pi-logo-wp-1024.png` | same commit | none |
| `scripts/prepare-logo.py` (+ `prepare-logo.test.py`) | commit `0f2e0e7` | Generic utility: resamples a logo to exactly 1024×1024 for an uploader. Not World Pi-specific in code, but added for those logos. |

A search for `world.?pi` also matched "world **pi**cture" in about 12 files. Those are false positives and are not World Pi references.

**Separation rule (owner direction, AGREED):** the presence of Pi Network does not imply World Pi. The World Pi artefacts above are recorded as **out of scope for Lambda NX**. Whether to relocate them is CONF-X01.

### 5.3 Existing-system tree (as evidenced)

```
Lambda NX
├── Existing System (L1)
│   ├── Next.js 15 / React 19 application        [RP]
│   ├── Drizzle ORM + postgres-js                [RP]
│   ├── Supabase PostgreSQL 17.6 (Lambda-NX)     [LO 2026-10-03]
│   ├── Netlify hosting + scheduled function     [RP; LO 2026-08-28, stale]
│   ├── Vercel config (no project)               [RP; LO 2026-08]
│   ├── Pi Network integration                   [RP]
│   │   ├── identity provider (default)
│   │   ├── payment provider (default)
│   │   └── Pi Browser distribution + domain verification
│   ├── Standalone accounts (email/password)     [RP] — concurrent with Pi, not via provider switch (CONF-X03)
│   ├── Stripe provider                          [RP]
│   ├── Anthropic Claude analyst                 [RP]
│   └── application code (engine, 33 gateways, UI, APIs, tests)
├── Target Architecture (L2) — Master Living Implementation Blueprint
└── Execution Governance (L3) — reconciled Claude execution contract (§11)

Out of scope for Lambda NX: World Pi artefacts (§5.2).
```

---

## 6. Forecast Governance Reconciliation

**Owner direction (AGREED):** Forecasting is part of the Intelligence Core. Forecast ≠ Truth. Forecast ≠ Event. Forecast ≠ Scenario.

**What CLAUDE.md removed, read precisely.** The clause names what was removed as "impossible or unlawful". In context, that refers to the original application's fabricated future-prediction feature: an unevaluated prediction presented as fact. That is exactly what the Master also forbids ("never use confidence as probability, a single model as certainty, a scenario as a prediction"). The Master's Forecast is a different object: calibrated, evaluated, with point-in-time cutoffs and uncertainty.

**Proposed CLAUDE.md §1 wording (decision required, CONF-F01):**

> We removed only what was impossible or unlawful: **unevaluated future predictions presented as fact**, "quantum/agentic swarm" claims, and mass surveillance. Governed forecasting — calibrated, evaluated, point-in-time, with explicit uncertainty, and kept separate from Truth, Event and Scenario — is part of the Intelligence Core as specified in the Master (§19–§20).

**Repository evidence relevant to forecasting:**

| Item | Evidence | Assessment |
|---|---|---|
| Lambda forecasting engine | NP | NOT IMPLEMENTED |
| Scenario engine | NP (1 hit, a capability label in `lib/plans/capabilities.ts:274`) | NOT IMPLEMENTED |
| Calibration ledger | R15. Weighted accuracy (correct 1, partial 0.5, wrong 0) by author and by confidence. `topic` is stored but not broken down. | PRECURSOR of forecast *evaluation* only |
| Forecast ≠ Event separation already practised | `lib/analysis/country-risk.ts:51` "Not a forecast"; `timeline.ts:39` "It does not forecast"; `components/globe-view.tsx:2145` "Nothing here is a forecast"; `lib/engine/catalog/feeds/infrastructure.ts:41-42` (measured value headlined, third-party forecast kept out of the headline) | Consistent with Master separation |
| Third-party forecasts ingested | Open-Meteo multi-model forecast (`infrastructure.ts:129-131`); rates spread described as "the market's forecast" | Should become Forecast objects with an **external producer** in their provenance. No such object type exists. |
| Brier and log scores | Claimed in `lib/plans/capabilities.ts:176-178` (status `built-not-gated`). **Not computed anywhere.** Brier needs probabilities, and repository confidence is categorical. | CONF-F02 |

---

## 7. Verification-Level Mapping

**Owner direction (AGREED):** do not unify the ladders by force. Create a formal mapping. Preserve Admiralty and every historical value. Verification ≠ truth probability, and evidence strength, independence and source quality are separate dimensions.

### 7.1 The dimensions, kept separate

| ID | Dimension | Scale | Where it lives |
|---|---|---|---|
| **D1** | Processing / promotion gate of an artifact or evidence item | Ladder B: L0 Unprocessed · L1 Structurally Valid · L2 Integrity/Provenance Checked · L3 Semantically Validated · L4 Source-Verified · L5 Independently Corroborated · L6 Cross-Domain Corroborated · L7 Canonically Promoted | Master §70.8 F/G (lines 4350-4358); 2026-10-03 addendum §7 |
| **D2** | Corroboration / stability state of a claim | Ladder A: 0 UNVERIFIED · 1 SINGLE_SOURCE · 2 SOURCE_VALIDATED · 3 INDEPENDENT_CORROBORATION · 4 PRIMARY/AUTHORITATIVE · 5 MULTI_MODAL_CONVERGENCE · 6 STABLE_CONFIRMED | Master §11 (lines 258-260) |
| **D3** | Source reliability (about the source) | Admiralty A–F | Catalogue `admiralty` (247 records); `evidence.admiralty_source` |
| **D4** | Information credibility (about the item) | Admiralty 1–6 | `evidence.admiralty_info` |
| **D5** | Repository confidence grade (legacy) | confirmed · probable · possible · unconfirmed | `gradeConfidence` (`lib/engine/analysis.ts:25`); `evidence.confidence` |
| **D6** | Independence | Count of independent origins (180 groups) | `lib/engine/catalog/origins.ts` |

### 7.2 D2 (ladder A) ↔ D1 (ladder B) — candidate correspondence (decision required, CONF-V01)

| Ladder A | Nearest ladder B gate | Relationship | Note |
|---|---|---|---|
| 0 UNVERIFIED | L0–L3 | Candidate | A claim whose evidence has not reached L4 has no corroboration state yet. |
| 1 SINGLE_SOURCE | L4 with one independence group | **Not equivalent** | A1 does not require source verification; L4 does. |
| 2 SOURCE_VALIDATED | L4 | Close | — |
| 3 INDEPENDENT_CORROBORATION | L5 | Close | Requires ≥ 2 independence groups (D6), not ≥ 2 source keys. |
| 4 PRIMARY/AUTHORITATIVE | — | **Orthogonal** | A property of the source class. Proposed: an attribute alongside D3, not a ladder step. |
| 5 MULTI_MODAL_CONVERGENCE | L6 Cross-Domain Corroborated | **Different** | Multimodal ≠ cross-domain. Keep both. |
| 6 STABLE_CONFIRMED | — | **Orthogonal** | Temporal stability. No ladder B equivalent. |
| — | L7 Canonically Promoted | B only | A write-boundary event (§70.8 H), not a corroboration state. |

### 7.3 D5 (legacy) ↔ D2 — why values must not be converted

| D5 value | `gradeConfidence` rule | D2 candidates | Why the conversion is unsafe |
|---|---|---|---|
| unconfirmed | 0 evidence items | A0 | — |
| possible | 1 non-reliable source | A1 | — |
| probable | ≥ 2 distinct `sourceKey` **or** 1 reliable (A/B) source | A1, A2 or A3 | Mixes two cases. Distinct keys can share one origin (CONF-V04). |
| confirmed | ≥ 2 reliable sources counted **by key** | A3 only if the keys are independent origins; otherwise A1 or A2 | Same defect. |

**Preservation rule (proposed):** stored D3, D4 and D5 values are never rewritten or deleted. D2 is **re-derived from the evidence and D6**, not converted from D5. D5 is retained with the version of the rule that produced it, as historical provenance.

### 7.4 Order of the D1 gates

The owner's illustrative sequence puts Semantic validation **before** Provenance/Integrity, and has no Policy/License stage. The Master's evidence pipeline (2026-10-03 addendum §7; §70.8 F/G) and ladder B put **Integrity → Provenance → Policy/License → Semantic/Temporal/Spatial**. Proposed: follow the Master order (CONF-V03, decision required).

---

## 8. Phase Continuity Ledger

| # | Date | Location | Stated continuation | Classification |
|---|---|---|---|---|
| P-1 | 2026-09-19 | Rules file §38 (lines 533-537) | "NEXT Phase 30.27 Interface Contracts" | Older snapshot |
| P-2 | 2026-09-19 | Rules / Handoff §4 (lines 612-616); copy in Master handoff §4 (from line 4888) | "NEXT: Phase 30.27 — Interface Contracts" | Older snapshot |
| P-3 | 2026-09-19 | Rules / Handoff §46 (lines 1108-1109); copy in Master §46 (from line 5377) | same | Older snapshot |
| P-4 | 2026-09-25 | Master §69.3 (lines 1039-1058) | G → H → K → L → M → N → O → P → Q; Q in progress; an earlier N/O/P mislabel superseded | Reconciliation record |
| P-5 | 2026-09-25 | Master §69.8 (lines 1999-2006) | "Latest specified continuation: M → N → O → P → Q → R" (R listed before §69.9 specifies it) | Internal dating inconsistency (CONF-P03) |
| P-6 | 2026-09-26 | Master §69.11 (lines 3076-3097) | Authoritative sequence G → … → S | **Explicit reconciliation** |
| P-7 | 2026-09-26 | Master §69.53 (lines 3954-3970) | "S is the current specification-side closure/consistency stage" | Current state |
| P-8 | 2026-09-26 | Master §68 Final status (line ~3054) | "latest active continuation is 30.27.8.S" — while citing "the 2026-09-25 addendum" | Internal dating inconsistency (CONF-P03) |
| P-9 | 2026-09-26 | Master §70.7 (lines 4143-4166); §70.16 (lines 4778-4790) | A → D → E → F/G → H → K → L → M → N → O → P → Q → R → S; latest S | **Consolidation / correction record** |
| P-10 | 2026-10-03 | Continuity addendum §2–§3 (Master lines 5411-5428; rules lines 1134-1148) | "30.27.8.M … immediate continuation target"; lists A, D, E, F/G, H, K, L, M; **N–S absent** | Conflict (CONF-P02) |
| P-11 | 2026-10-03 | Owner message | Inserts "30.27.8.R — Reconciliation & Baseline" | ID collision (CONF-P05) |

**Additional observation.** No 30.27.8 stage letter B, C, I or J appears anywhere in either document. The letters actually used are A, D, E, F/G, G, H, K, L, M, N, O, P, Q, R and S (CONF-P04).

**Latest reconciled state — proposed reference:** Master §70.16. Latest specification continuation: **30.27.8.S** (RESEARCHED → SPECIFICATION IN PROGRESS). Phase 30: NOT COMPLETE. Phase 31: BLOCKED. Implementation: NOT VERIFIED.

The rationale:
- P-6 and P-9 are the only explicit reconciliation and consolidation records.
- P-10 contains no supersession statement for N–S.
- The Master's own rules forbid silent undo: §69.10 rule 4 ("explicitly supersede … rather than silently leaving contradictory rules active") and §69.54 ("No later answer may silently undo a previously accepted architectural decision").

P-10 is therefore recorded as a conflict and not read as a rollback.

**Next research step after RB:** decided by the research owner through CONF-P02 — either resume at S, or explicitly re-open M with a recorded reason. Phase 31 stays BLOCKED until Phase 30 closes through the Master completion chain.

---

## 9. Contradiction Register

Every entry has the same nine fields. *Status* uses: **OPEN** (decision pending) · **BLOCKED** (missing contract) · **AGREED** (decided by the owner on 2026-10-03). "Not fixed" means no code was changed.

### 9.1 Governance

**CONF-G01 — Who researches**
- **Source A:** CLAUDE.md §2.2 ("Comprehensive research, always"), §2.8 ("Study the field continuously … without being asked again"); repository agents `.claude/agents/field-scout`, `source-hunter`.
- **Source B:** Master §67, §69.2, §69.10, §70.6 ("Claude … does not own research, architecture, requirements analysis … source selection").
- **Exact conflict:** CLAUDE.md requires Claude to research and adopt. The Master forbids Claude from researching architecture or choosing sources.
- **Impact:** Every session can act under opposite mandates. Sources and capabilities could be adopted without a Master decision.
- **Proposed reconciliation:** Architecture research and adoption decisions belong to the research stage. Claude's research is limited to (a) **implementation-level verification** of an already-specified contract (for example, confirming a specified source's live response shape), and (b) **reporting** observations labelled DISCOVERED to the research owner, without adopting them. The field-scout and source-hunter agents become evidence-gathering tools run under an explicit research request, and their outputs are labelled DISCOVERED or RESEARCHED, never AGREED.
- **Decision required:** Approve the re-scoped wording of CLAUDE.md §2.2 / §2.8 (text in §11.4).
- **Migration effect:** Documentation only — CLAUDE.md and the two agent descriptions.
- **Status:** OPEN.

**CONF-G02 — Standing owner instructions vs stop-at-gap**
- **Source A:** Owner standing instructions recorded in `docs/ledger/REQUESTS.md` ("اصلح كل الأخطاء والثغرات … فورًا", "اعمل نفسك انت الخبير").
- **Source B:** Master §69.2, §70.6 (stop at the boundary and report).
- **Exact conflict:** "Fix immediately, without waiting" against "stop and report".
- **Impact:** Defect and security work on L1 has no defined place in the Master contract.
- **Proposed reconciliation:** A **maintenance lane** (§11.2) for defects and security on the Existing System. Entry conditions: no new architecture, schema or contract; an evidence-based fix; recorded in the ledger and this register; reported; and **explicitly authorised per batch**. Anything that needs a new contract goes back to the stop-and-report rule. **Currently suspended** by the owner instruction of 2026-10-03, "لا تنفذ أي كود جديد الآن".
- **Decision required:** Approve the maintenance lane and its authorisation rule.
- **Migration effect:** None to code. Process only.
- **Status:** OPEN.

**CONF-G03 — Definition of Done vs completion chain**
- **Source A:** CLAUDE.md §6 (Definition of Done).
- **Source B:** Master §63, §70.14 (SPECIFICATION → … → ACCEPTANCE → COMPLETE).
- **Exact conflict:** CLAUDE.md "done" has no evaluation, failure-test or acceptance gate, and reads as complete.
- **Impact:** Status inflation — repository-done work could be reported as Master COMPLETE.
- **Proposed reconciliation:** Rename CLAUDE.md §6 to **"Repository merge gate (not Master COMPLETE)"**. Passing it yields at most RP + RT. Its requirement that "findings carry … Admiralty rating, confidence grade" is retained as D3/D4/D5 (§7).
- **Decision required:** Approve the rename and mapping.
- **Migration effect:** Documentation only.
- **Status:** OPEN.

**CONF-G04 — Product identity**
- **Source A:** CLAUDE.md §1 ("multi-gateway intelligence platform … OSINT core … Pi app and standalone").
- **Source B:** Master §0, §2, §68 ("Global Living Intelligence Platform / Living World Model … not … a dashboard, map, OSINT collector").
- **Exact conflict:** A different stated identity and scope.
- **Impact:** Ambiguity about what is in scope.
- **Proposed reconciliation:** The Master identity is the **target**. CLAUDE.md §1 is reworded as the **current implementation surface**, with gateways as precursors of domain packs and workflows.
- **Decision required:** Approve the wording.
- **Migration effect:** Documentation only.
- **Status:** OPEN.

**CONF-G05 — Two status systems**
- **Source A:** CLAUDE.md §2.5; `docs/PLAN.md` (71 items done, 4 open).
- **Source B:** Master §64, §70.5 status vocabulary.
- **Exact conflict:** PLAN.md "done" has no Master meaning.
- **Impact:** Progress reports in two incompatible vocabularies.
- **Proposed reconciliation:** PLAN.md becomes the repository backlog using the evidence classes of §0.2. Master statuses govern specification.
- **Decision required:** Approve.
- **Migration effect:** Relabel PLAN.md (documentation).
- **Status:** OPEN.

**CONF-G06 — "One million sources" target**
- **Source A:** CLAUDE.md §2.8 ("Source population is a headline target: one million and rising").
- **Source B:** Master §1, §13; 2026-10-03 addendum §14 ("source-count inflation" forbidden).
- **Exact conflict:** A numeric headline target against a prohibition on count-driven inflation.
- **Impact:** Pressure to inflate reach figures. CONF-Q02 is an existing instance.
- **Proposed reconciliation:** Retain the target only as **labelled reach** — with units, never summed across units — or retire it. The research owner decides.
- **Decision required:** Keep, relabel or retire the target.
- **Migration effect:** Documentation, plus the reach computation if retained (MR via maintenance lane).
- **Status:** OPEN.

**CONF-G07 — "No redesign" vs new Master surfaces**
- **Source A:** CLAUDE.md §1, §2.7 (preserve the design; realize fake features as real without redesigning).
- **Source B:** Master §46–§50 (visualization engine, inbox, evidence-first UI, adaptive workspace).
- **Exact conflict:** New surfaces exceed "no redesign".
- **Impact:** Ambiguity when Master surfaces are implemented.
- **Proposed reconciliation:** Preserve the **visual language** (compatible with Master §29; the primary colour is green). "No redesign" applies to existing screens, not to Master-specified new surfaces.
- **Decision required:** Approve.
- **Migration effect:** None now.
- **Status:** OPEN.

### 9.2 Phase continuity

**CONF-P01 — 2026-09-19 "NEXT 30.27"**
- **Source A:** Rules file lines 533-537, 612-616, 1108-1109 (and their copies in the Master handoff).
- **Source B:** Master §69.11, §70.16 (latest S).
- **Exact conflict:** The older snapshot names an earlier resumption point.
- **Impact:** A reader of the rules file alone would restart at 30.27.
- **Proposed reconciliation:** Mark P-1 to P-3 **SUPERSEDED (historical)** by P-6 and P-9.
- **Decision required:** Confirm.
- **Migration effect:** Documentation.
- **Status:** OPEN.

**CONF-P02 — 2026-10-03 "M — immediate continuation target"**
- **Source A:** Continuity addendum §3 (Master lines 5416-5428; rules lines 1139-1148).
- **Source B:** Master §69.11, §69.53, §70.7, §70.16.
- **Exact conflict:** The newest-dated layer names M as next and omits N–S without any supersession statement.
- **Impact:** Following M literally would orphan six RESEARCHED stages. Following S would ignore the newest-dated layer.
- **Proposed reconciliation:** The latest reconciled reference is §70.16 (S). Record P-10 as either (a) a stale carry-over (supporting evidence: its body covers A–L plus 30.27.6 only, and identical text is appended to the 2026-09-19 rules file), or (b) an intent to re-open M, which must then be recorded explicitly with a reason.
- **Decision required:** The research owner states (a) or (b).
- **Migration effect:** None to code.
- **Status:** OPEN.

**CONF-P03 — Dating inconsistencies inside the Master**
- **Source A:** Master §69.8 (2026-09-25) lists R as "latest specified" before §69.9 specifies it.
- **Source B:** Master §68 Final status names S (a 2026-09-26 stage) while citing "the 2026-09-25 addendum".
- **Exact conflict:** Status lines whose dates do not match their contents.
- **Impact:** Low. It confuses the audit trail.
- **Proposed reconciliation:** Annotate both as superseded by §70.16.
- **Decision required:** Confirm.
- **Migration effect:** Documentation.
- **Status:** OPEN.

**CONF-P04 — Missing stage letters and different starting points**
- **Source A:** Master §69.3 and §69.11 begin 30.27.8 at G.
- **Source B:** Master §70.7 begins at A (A, D, E, F/G). The letters B, C, I and J appear nowhere.
- **Exact conflict:** Sequence definitions differ; four letters are unaccounted for.
- **Impact:** It cannot be shown that no stage was lost.
- **Proposed reconciliation:** The research owner records whether B, C, I and J are unused, merged or lost.
- **Decision required:** Yes.
- **Migration effect:** None.
- **Status:** OPEN.

**CONF-P05 — Stage-ID collision for this stage**
- **Source A:** Owner request: "30.27.8.R — Master / Repository / Claude Reconciliation & Current-System Baseline".
- **Source B:** Master §69.9, §69.11, §70.7: 30.27.8.R = Intelligence Artifact / Export / Publication / Share.
- **Exact conflict:** One identifier, two stages.
- **Impact:** Ledger and contract references would become ambiguous.
- **Proposed reconciliation:** Keep the existing R. Give this stage a non-colliding identifier. Options: `30.27.8.RB`, `30.27.9`, or `30.25.1` (as a correction in the Gap-Audit lineage).
- **Decision required:** Choose the identifier.
- **Migration effect:** Documentation.
- **Status:** OPEN. The working label "RB" is used here.

### 9.3 Verification

**CONF-V01 — Two verification ladders**
- **Source A:** Master §11 (ladder A, 0–6).
- **Source B:** Master §70.8 F/G and the 2026-10-03 addendum §7 (ladder B, L0–L7).
- **Exact conflict:** Two scales, both called "verification levels", with no reconciliation.
- **Impact:** An implementation would have to pick one and silently lose the other.
- **Proposed reconciliation:** Two separate dimensions — D1 (processing / promotion gate) and D2 (claim corroboration state) — with the candidate correspondence in §7.2. Neither ladder is deleted.
- **Decision required:** Approve the two-dimension model and §7.2.
- **Migration effect:** MR-07.
- **Status:** OPEN (direction AGREED: map, do not merge).

**CONF-V02 — Admiralty and the confidence grade have no place in the Master**
- **Source A:** Repository: Admiralty A–F and 1–6 in 93 files; the confidence grade in `evidence.confidence` and `gradeConfidence`; CLAUDE.md §6.
- **Source B:** Master §7, §11 (no Admiralty; "never collapse into one score").
- **Exact conflict:** Existing assessments are absent from the Master model.
- **Impact:** A risk of losing historical assessments during migration.
- **Proposed reconciliation:** Admiralty becomes D3 (source reliability) and D4 (information credibility). The confidence grade becomes the legacy D5, preserved with its rule version. The preservation rule is in §7.3.
- **Decision required:** Approve.
- **Migration effect:** MR-07. No stored value is rewritten.
- **Status:** OPEN (direction AGREED: preserve Admiralty).

**CONF-V03 — Order of the validation gates**
- **Source A:** Owner illustrative sequence (Semantic before Provenance; no Policy/License step).
- **Source B:** Master pipeline (Integrity → Provenance → Policy/License → Semantic/Temporal/Spatial) and ladder B.
- **Exact conflict:** A different order, and a missing licence step.
- **Impact:** Licence and policy could be checked after semantic processing.
- **Proposed reconciliation:** Follow the Master order. Treat the owner's sequence as illustrative.
- **Decision required:** Confirm.
- **Migration effect:** None now.
- **Status:** OPEN.

**CONF-V04 — Defect: confidence counts source keys, not independent origins**
- **Source A:** `lib/engine/analysis.ts:25-40`: `distinctSources = new Set(evidence.map(e => e.sourceKey))`. The test named "confirmed with two independent reliable sources" (`engine.test.ts:234`) checks distinct keys.
- **Source B:** CLAUDE.md §2a ("independent origins … the only number that belongs in a confidence score"); Master §13 ("twenty copies of one original report do not equal twenty independent confirmations").
- **Exact conflict:** Existing Implementation contradicts **both** documents. The repository has `originOf()` and uses it for ranking (`world-events-shared.ts`), but not for grading.
- **Impact:** Two feeds from the same publisher raise a claim to "probable" or "confirmed".
- **Proposed reconciliation:** A maintenance-lane fix: count independence groups via `originOf`, and rename the test to what it checks.
- **Decision required:** Authorise (code change).
- **Migration effect:** Changes future grades only. Stored grades are retained under the preservation rule (§7.3).
- **Status:** OPEN — not fixed.

### 9.4 Forecast

**CONF-F01 — Forecasting removed vs required**
- **Source A:** CLAUDE.md §1 ("removed … future-prediction 'forecasts'").
- **Source B:** Master §10, §19, §20, §68.
- **Exact conflict:** The charter removes forecasting; the Master requires it.
- **Impact:** Forecast work could be blocked by the charter, or the charter could be ignored.
- **Proposed reconciliation:** Forecasting stays in the Intelligence Core (owner direction). Amend the CLAUDE.md wording (§6).
- **Decision required:** Approve the wording.
- **Migration effect:** Documentation.
- **Status:** OPEN (direction AGREED).

**CONF-F02 — Defect: calibration capability text overstates the implementation**
- **Source A:** `lib/plans/capabilities.ts:174-180`: "Our own assessments scored against what actually happened, with **Brier and log scores and a domain breakdown**", status `built-not-gated`.
- **Source B:** Actual implementation `lib/modules/calibration.ts:108-140`: weighted accuracy by author and by confidence, no Brier, no log score, no topic breakdown. Master §1 ("UI capabilities must correspond to real backend capabilities"); §70.5 status discipline; "confidence is not probability".
- **Exact conflict:** A capability record claims metrics that are not computed. Brier also cannot be computed from categorical confidence.
- **Impact:** Status inflation. The text is reached through `lib/plans/capabilities.ts`; `/api/diagnose` exposes counts only — no user-visible rendering of this description was found.
- **Proposed reconciliation:** A maintenance-lane text correction now. Brier and log scoring belong to the Master forecast-evaluation contract (§19) and need probabilistic forecasts first.
- **Decision required:** Authorise the text correction.
- **Migration effect:** Documentation string in code.
- **Status:** OPEN — not fixed.

### 9.5 Pi, World Pi, providers

**CONF-X01 — World Pi artefacts in the Lambda NX repository**
- **Source A:** Repository: `public/branding/world-pi-logo-radar-1024.png`, `world-pi-logo-wp-1024.png` (commit `6cdd821`); `scripts/prepare-logo.py` and its test (commit `0f2e0e7`).
- **Source B:** Rules / handoff §38.8 and §46.8 ("Keep Lambda NX separate from World Pi"); owner direction (Pi ≠ World Pi).
- **Exact conflict:** Another project's assets live in this repository.
- **Impact:** Low at runtime (0 references). They blur project boundaries.
- **Proposed reconciliation:** Relocate the two logos to the World Pi project. Keep or move `prepare-logo.py` (it is generic tooling) by owner decision.
- **Decision required:** Relocate (yes/no); fate of `prepare-logo.py`.
- **Migration effect:** Repository content move — not application code.
- **Status:** OPEN.

**CONF-X02 — Pi is absent from the Master**
- **Source A:** CLAUDE.md §1, §4; repository §5.1 (Pi is the default identity and payment provider and a distribution channel).
- **Source B:** Master (0 mentions of Pi Network).
- **Exact conflict:** A core Existing-System provider is undocumented in the target architecture.
- **Impact:** Master contracts (security §53, payments, distribution) cannot account for Pi.
- **Proposed reconciliation:** The Master records Pi as an **external identity and payment provider adapter plus distribution channel** in its existing-system and provider layer. Pi ≠ World Pi.
- **Decision required:** The research owner adds this to the Master.
- **Migration effect:** None to code.
- **Status:** OPEN.

**CONF-X03 — The auth "provider switch" is not a switch**
- **Source A:** CLAUDE.md §4 and rule #4 ("Pi-vs-standalone … with a provider switch only").
- **Source B:** Repository: `lib/auth/index.ts:12-18` registers only `'pi'`, with the stale message "Available: pi (standalone arrives in P12)". `app/api/auth/login` and `register` import `@/lib/auth/standalone` directly, bypassing the factory.
- **Exact conflict:** The documented model (switchable) differs from the actual model (concurrent dual identity).
- **Impact:** Documentation misleads. The isolation layer is partially bypassed.
- **Proposed reconciliation:** Record the **actual** model: concurrent Pi and standalone identity providers. Correct the documentation. Any code change (registering standalone in the factory, fixing the message) goes through the maintenance lane.
- **Decision required:** Document-only now (yes/no); authorise code later.
- **Migration effect:** MR-13.
- **Status:** OPEN — not fixed.

### 9.6 System and contracts

**CONF-S01 — Canonical envelope**
- **Source A:** Master §6 (17 fields on every persistent object; IDs immutable; updates create versions).
- **Source B:** Repository `db/schema.ts`: 24 tables. Searched for `valid_time`, `knowledge_time`, `tenant_scope`, `classification`, `schema_version`, `provenance`, `uncertainty`, `source_references`: **0 in any table**.
- **Exact conflict:** No existing persistent object carries the envelope.
- **Impact:** Existing tables cannot be canonical objects without migration.
- **Proposed reconciliation:** Classify the existing tables as **application tables (L1)**. The canonical layer is a Master subsystem. The choice between evolving the existing tables and introducing a canonical layer alongside them is a Master decision.
- **Decision required:** Evolve or add alongside — and supply the 30.26 Data Contracts text.
- **Migration effect:** MR-01.
- **Status:** BLOCKED (30.26 not supplied).

**CONF-S02 — Temporal model**
- **Source A:** Master §12 (valid, knowledge, publication, capture and availability time; point-in-time reconstruction mandatory).
- **Source B:** Repository: `observedAt` / `at` exist only in memory (world events are not persisted); `Evidence.publishedAt` exists in the engine (`types.ts:118`) but **the `evidence` table has no publication-time column**, so it is dropped on persistence; no point-in-time reconstruction.
- **Exact conflict:** Mandatory temporal semantics are absent, and one time axis is lost on write.
- **Impact:** No historical reconstruction or backtesting is possible from stored data.
- **Proposed reconciliation:** Candidate precursors: `observedAt` → valid-time candidate, `at` / `retrievedAt` → knowledge-time candidate. Record the publication-time loss.
- **Decision required:** The 30.26 and 30.27.8.M texts.
- **Migration effect:** MR-02.
- **Status:** BLOCKED.

**CONF-S03 — Source health taxonomy**
- **Source A:** Master §8 (HEALTHY / DEGRADED / SLOW / STALE / FAILING / OFFLINE / UNKNOWN).
- **Source B:** Repository (`ok` / `cached` / `empty` / `failed`, plus quarantine).
- **Exact conflict:** Not one-to-one. `cached` (served from the minimum-interval cache) and `empty` (answered with no items) have no Master equivalent. SLOW, STALE, OFFLINE and UNKNOWN have no repository equivalent.
- **Impact:** Health cannot be reported in Master terms without a mapping.
- **Proposed reconciliation:** A mapping table to be specified. "empty" must not become "absence of events" (Master: absence ≠ proof of absence).
- **Decision required:** RESEARCH REQUIRED on the semantics of `cached` and `empty`.
- **Migration effect:** MR-04.
- **Status:** OPEN.

**CONF-S06 — AI Context Firewall**
- **Source A:** Master §9 (check policy before model context is constructed; licence includes AI processing and training).
- **Source B:** Repository `lib/ai/*`, `app/api/analyst`: no licence or policy check before model context. The licence model (`licence.ts:28-32`) has no AI-processing field.
- **Exact conflict:** A Master MUST is absent.
- **Impact:** The AI-processing rights of source content sent to the model are unknown. The upstream gate checks only commercial use, storage and redistribution.
- **Proposed reconciliation:** Extend the licence model with the Master licensing fields, then add the firewall.
- **Decision required:** A contract for the licence schema (30.26).
- **Migration effect:** MR-06.
- **Status:** BLOCKED.

**CONF-A01 — Error format**
- **Source A:** Master §62; §70.8 30.27.6 (lines 4169-4217, including a `ProblemDetails` shape).
- **Source B:** Repository: 56 of 84 routes return `{ error: string }`; 0 routes use `application/problem+json`.
- **Exact conflict:** A different error contract.
- **Impact:** Clients — the app's own frontend, MCP and external callers — depend on the current shape. Changing it is breaking.
- **Proposed reconciliation:** Migrate behind a compatibility path once 30.27.6 is closed.
- **Decision required:** Confirm 30.27.6 closure and a compatibility policy.
- **Migration effect:** MR-03.
- **Status:** BLOCKED (30.27.6 not closed).

**CONF-A03 — MCP version**
- **Source A:** Master §52 ("Current official MCP release is 2026-07-28").
- **Source B:** Repository `lib/mcp/server.ts:144` (`PROTOCOL_VERSION = '2024-11-05'`).
- **Exact conflict:** A different protocol version.
- **Impact:** Possible incompatibility with current clients.
- **Proposed reconciliation:** **RESEARCH REQUIRED.** The 2026-07-28 release is beyond Claude's knowledge cutoff and cannot be verified by Claude. The research stage verifies it; the upgrade follows a specified contract.
- **Decision required:** Verification by the research stage.
- **Migration effect:** MR-12.
- **Status:** OPEN.

**CONF-L01 — Automatic publishing**
- **Source A:** Master §44 and §69.9 (R): policy, quality and risk checks; AUTO / REVIEW / HUMAN_ONLY; a licence boundary at publication; claim labelling.
- **Source B:** Repository `lib/modules/autopublish.ts:1-30` (AUTO, "no human in the loop"; threshold, no paraphrase, deduplication, per-run cap); `lib/social/broadcast.ts:42` (per-channel `autoPublish`). Licence is enforced **upstream** — sources are licence-filtered before events exist (`world-events.ts:552`, `activeSources()`) — not at publication.
- **Exact conflict:** Only one of the three modes exists, and the required checks are absent.
- **Impact:** Publishing runs on a pipeline the Master does not yet accept.
- **Proposed reconciliation:** Record it as PRECURSOR / NON-CONFORMANT (partial). The owner decides whether AUTO publishing continues pending 30.27.8.R (the Artifact/Publication contract).
- **Decision required:** Continue, pause, or switch to a review-style mode.
- **Migration effect:** MR-08.
- **Status:** OPEN.

### 9.7 Repository quality defects (Existing Implementation)

**CONF-Q01 — A literal NUL byte hides the confidence rule from review**
- **Source A:** `lib/engine/analysis.ts` contains 2 NUL bytes, used as key separators (lines 44 and 105). `file` reports it as "data". `grep` reports "binary file matches" and hides the content. The only commit that touches it (`04298c1`) shows **"Binary files /dev/null and b/lib/engine/analysis.ts differ"**.
- **Source B:** Master §53 (audit), §55 (observability), and the provenance of code generally.
- **Exact conflict:** The core confidence-grading rule entered the repository with no reviewable diff, and any future change to it will also be invisible in diff-based review.
- **Impact:** CONF-V04 sat inside a file that review could not show. Text-based audits, including the first pass of this one, silently skip it.
- **Proposed reconciliation:** A maintenance-lane fix: replace each literal NUL with the escape `'\u0000'`. Runtime behaviour is identical.
- **Decision required:** Authorise.
- **Migration effect:** None at runtime.
- **Status:** OPEN — not fixed.

**CONF-Q02 — Reach summed across different units**
- **Source A:** `lib/engine/catalog/families.ts`: the certificate-transparency family stores **10,000,000,000 certificates** in a field named `publishers`, summed into `reach.live = 10,549,740,110`.
- **Source B:** CLAUDE.md §2a; Master (source-count inflation forbidden).
- **Exact conflict:** A headline figure dominated by a different unit.
- **Impact:** Latent. `catalogSummary()` is not rendered by any page (verified 2026-09-06).
- **Proposed reconciliation:** Report reach per unit, or exclude CT from the sum (see CONF-G06).
- **Decision required:** With CONF-G06.
- **Migration effect:** Maintenance lane.
- **Status:** OPEN — not fixed.

**CONF-Q03 — Mislabelled capability description**
- **Source A:** `lib/plans/capabilities.ts`: the entry "Monitors & alerting" has the description "Shared investigations, SSO/MFA, role-based access, audit trail".
- **Source B:** Master §70.5 status discipline.
- **Exact conflict:** The description belongs to a different capability.
- **Impact:** Low.
- **Proposed reconciliation:** A maintenance-lane text correction.
- **Decision required:** Authorise.
- **Migration effect:** A text string.
- **Status:** OPEN — not fixed.

**CONF-D01 — Live database differs from the repository**
- **Source A:** Live Lambda-NX database, 2026-10-03: a stray table `"L"` (empty, RLS on); migration history created by baseline, not by `db:migrate`.
- **Source B:** Repository schema (24 tables) and the migration workflow (CLAUDE.md §4).
- **Exact conflict:** One extra table, and history produced outside the normal path.
- **Impact:** Low. The baseline is recorded (R290).
- **Proposed reconciliation:** The owner decides on `"L"`. Future live changes follow §11.5.
- **Decision required:** Drop or keep `"L"`.
- **Migration effect:** A live database operation, if dropped.
- **Status:** OPEN.

---

## 10. Migration Requirements

Each line points to the Master contract it depends on. **None introduces new architecture.** Where the contract text is missing, the item is BLOCKED.

| ID | What must migrate | Depends on | Contract text available? | Status |
|---|---|---|---|---|
| MR-01 | Canonical envelope for persistent objects (CONF-S01) | 30.26 Data Contracts | **No** (referenced, not supplied) | BLOCKED |
| MR-02 | Temporal axes; persist the evidence publication time; point-in-time reconstruction (CONF-S02) | 30.26; 30.27.8.M | 30.26 no; M partial (§70.8, lines 4453-4469) | BLOCKED |
| MR-03 | RFC 9457 errors with a compatibility path (CONF-A01) | 30.27.6 | Partial (lines 4169-4217) | BLOCKED (not closed) |
| MR-04 | Source health → Master taxonomy (CONF-S03) | Master §8; research on `cached` / `empty` | Partial | RESEARCH REQUIRED |
| MR-05 | Adapter → connector contract (14 methods) | 30.27 interface text for connectors | **No** | BLOCKED |
| MR-06 | Licence fields + AI Context Firewall (CONF-S06) | Master §9; handoff §12 field list; 30.26 schema | Field list only | BLOCKED |
| MR-07 | Verification dimensions D1/D2 alongside preserved D3–D5 (CONF-V01, V02) | 30.27.8.F/G, H; decision on §7 | Partial | OPEN |
| MR-08 | Publication pipeline: modes, checks, licence boundary (CONF-L01) | 30.27.8.R (Artifact / Publication) | Present (§69.9), not closed | BLOCKED |
| MR-08b | Forecast objects; external-producer provenance; probabilistic evaluation (Brier / log / CRPS) | Master §19; forecast contract | Not in 30.27 sequence | RESEARCH REQUIRED |
| MR-09 | Event fabric | 30.27.8.K; event-bus contract | K present, not closed | BLOCKED |
| MR-10 | Workspace / AnalyticalContext / ViewState | 30.27.8.Q | Present, not closed | BLOCKED |
| MR-11 | Watch / alert lifecycle | 30.27.8.O | Present, not closed | BLOCKED |
| MR-12 | MCP protocol version (CONF-A03) | Research verification | — | RESEARCH REQUIRED |
| MR-13 | Auth provider model documented as concurrent; factory registration (CONF-X03) | Documentation; maintenance lane for code | — | OPEN |
| MR-14 | Relocate World Pi artefacts (CONF-X01) | Owner decision | — | OPEN |
| MR-15 | CLAUDE.md governance amendments (§11.4) | Owner decision | — | OPEN |

**Maintenance-lane candidates.** These are defects in the Existing System, not migrations, and need authorisation: CONF-V04, CONF-Q01, CONF-F02, CONF-Q02, CONF-Q03, and the stale message in CONF-X03.

---

## 11. Claude Handoff Rules (reconciled execution contract)

### 11.1 Precedence

1. **Master Living Implementation Blueprint** — architecture and specification (L2).
2. **Owner directions recorded in the ledger** that resolve a Master gap or conflict.
3. **CLAUDE.md** — repository execution and operations (L3). It **cannot** cancel a Master requirement, and a Master requirement is **never** assumed implemented.
4. Evidence about L1 always comes from the repository and live systems, never from either document.

### 11.2 Three lanes

| Lane | What Claude may do | Precondition |
|---|---|---|
| **Audit / evidence** | Read the repository; run tests and type checks; perform read-only inspection of live systems; report with evidence classes (§0.2). | Always permitted. |
| **Maintenance** | Fix defects and security issues in the Existing System when no new architecture, schema or contract is needed. Record in the ledger and the register. | **Explicit owner authorisation per batch.** Currently **suspended** ("لا تنفذ أي كود جديد الآن", 2026-10-03). |
| **Implementation** | Build a Master subsystem. | A **closed implementation package** containing every element in Master §70.6. Otherwise stop and report the exact gap. |

### 11.3 Research boundary

Claude does not research architecture, select sources or resolve contradictions.

Claude may verify facts needed to implement an **already-specified** contract, such as the live response shape of a specified source. Anything Claude observes beyond that is reported as **DISCOVERED**, with evidence, to the research owner, and is never adopted.

### 11.4 Proposed CLAUDE.md amendment text (not applied — decision required)

> **§0 Precedence.** The Master Living Implementation Blueprint is the architectural reference for Lambda NX. This file governs how the repository is built and operated. Nothing here cancels a Master requirement, and nothing specified in the Master is to be treated as implemented without code, test and acceptance evidence.
>
> **§2.2 (re-scoped).** Architecture research and adoption decisions belong to the research stage. Claude verifies facts needed to implement specified contracts, and reports other observations as DISCOVERED, without adopting them.
>
> **§2.8 (re-scoped).** Continuous study of the field is a research-stage duty. Source population is reported only as labelled reach, by unit, and never summed across units.
>
> **§6 (renamed).** "Repository merge gate (not Master COMPLETE)". Passing it yields at most REPO-PRESENT + REPO-TESTED.
>
> **§1 (forecast wording).** As in §6 of RECONCILED_MASTER_BASELINE.

### 11.5 Live-system operations

Any write to a live system — database, hosting, environment, DNS — requires explicit authorisation **per action**. It is recorded in the ledger with before and after evidence. Read-only inspection is part of the audit lane.

### 11.6 Status reporting

Use the evidence classes of §0.2 for L1 and the Master vocabulary for L2. Never report IMPLEMENTED, INTEGRATED, TESTED, EVALUATED or ACCEPTED against the Master without that gate's own evidence.

Every report states: implemented · tested · not implemented · blocked · changed · new dependency · new issue (rules file §36).

---

## 12. Master Addendum — appendable text

> The block below is written in the Master's own conventions, to be appended after §71 or wherever the research owner places it. Owner directions of 2026-10-03 are recorded as AGREED. Everything else is PROPOSED.

### 72. Reconciliation & Current-System Baseline — 2026-10-03

**Stage ID:** pending (requested as 30.27.8.R; collides with the existing R — see CONF-P05).
**Status:** REQUIRED → RESEARCH / AUDIT. Audit evidence produced. Reconciliation PROPOSED.
IMPLEMENTED: N/A (documentation stage) · INTEGRATED: N/A · TESTED: N/A · ACCEPTED: NOT ESTABLISHED.

#### 72.1 Purpose

Establish what actually exists (L1), keep it distinct from the Master target (L2) and the execution contract (L3), and reconcile all three without deleting requirements or existing systems.

#### 72.2 Three-layer model (AGREED — owner direction)

Existing System ≠ Master Specification ≠ Claude Execution Contract.

```
CURRENT REPOSITORY → BASELINE AUDIT → RECONCILIATION → MASTER
→ EXACT IMPLEMENTATION SPEC → CLAUDE → CODE ONLY → TEST/VERIFY → ACCEPTANCE
```

#### 72.3 Decisions carried forward

**AGREED (owner, 2026-10-03):**
- The Master is the primary architectural reference.
- CLAUDE.md is the repository execution and operations reference and cannot cancel Master requirements.
- SPECIFIED ≠ IMPLEMENTED.
- Pi Network, Netlify, Supabase, Next.js, Drizzle and existing code are recorded as Existing System, not deleted.
- Pi Network ≠ World Pi.
- Forecasting remains in the Intelligence Core, with Forecast ≠ Truth ≠ Event ≠ Scenario.
- Verification ladders are mapped, not merged, and Admiralty is preserved.
- The latest reconciled state is the reference.
- Phase 31 remains BLOCKED until Phase 30 closes.

**PROPOSED:**
- The two-dimension verification model (D1/D2) plus preserved D3–D6.
- Three execution lanes (audit / maintenance / implementation).
- Per-action authorisation for live-system writes.
- Evidence classes RP / RT / LO / NP / UV.
- The latest reconciled continuation is §70.16 (S, in progress).
- CLAUDE.md amendment text (baseline §11.4).

**RESEARCH REQUIRED:**
- The MCP 2026-07-28 release.
- Health semantics of `cached` and `empty`.
- Gateway → domain-pack mapping.
- Ontology ↔ entity-type mapping.
- Missing stage letters B, C, I and J.

**FORBIDDEN:**
- Converting stored confidence grades into ladder values.
- Deleting any existing assessment.
- Treating repository-test success as Master acceptance.
- Silent rollback of continuation stages.
- Mixing World Pi requirements into Lambda NX.

#### 72.4 Gap audit for this stage

| Element | Status |
|---|---|
| Current System Baseline | PRODUCED (evidence-based) |
| Repository Reality Matrix | PRODUCED |
| Master ↔ Repository Gap Matrix | PRODUCED |
| CLAUDE.md ↔ Master Governance Reconciliation | PROPOSED |
| Pi / Existing-System Boundary | PRODUCED; Master entry REQUIRED (CONF-X02) |
| Forecast Governance Reconciliation | PROPOSED (direction AGREED) |
| Verification-Level Mapping | PROPOSED (direction AGREED) |
| Phase Continuity Ledger | PRODUCED; CONF-P02 OPEN |
| Contradiction Register | PRODUCED; 32 entries, 0 closed |
| Migration Requirements | PRODUCED; 9 of 16 BLOCKED on missing or unclosed contracts |
| Claude Handoff Rules | PROPOSED |
| Master addendum | THIS SECTION |
| Claude implementation package | NOT ISSUABLE (no closed contract; see §13) |

#### 72.5 Cross-stage consistency

- The baseline changes no earlier stage's content.
- It records conflicts in P-1 to P-11.
- It depends on 30.25 (Gap Audit lineage) and on the 30.26 / 30.27 texts for its BLOCKED migrations.

#### 72.6 Current project state after this stage

- Latest reconciled specification continuation: **30.27.8.S** (RESEARCHED → SPECIFICATION IN PROGRESS), pending CONF-P02.
- Phase 30: NOT COMPLETE. Phase 31: BLOCKED.
- Repository: 198 test files; 2750 tests passed on 2026-10-03 at `8f9c713` (RT — repository behaviour, not Master acceptance).

#### 72.7 Exact next continuation

1. The owner and research owner resolve the OPEN decisions in the register.
2. Assign this stage's ID (CONF-P05).
3. Resume research at the reference fixed by CONF-P02.

---

## 13. Claude implementation package — readiness

**No implementation package can be issued today.** Master §70.16 states that the package "must be generated only after the relevant specifications/contracts are closed and reconciled". Every 30.27.8 stage is RESEARCHED → SPECIFICATION IN PROGRESS. Issuing one would be exactly the "treat a draft contract as implemented" that §69.2 forbids.

**What a package must contain** (Master §70.6, kept verbatim as a checklist):

- canonical objects
- schema definitions
- API contracts
- event contracts
- job / workflow contracts
- ownership rules
- dependencies
- source requirements
- provenance rules
- temporal rules
- spatial rules
- security / policy / licence rules
- error / retry / recovery rules
- observability requirements
- test cases
- evaluation methodology
- failure tests
- acceptance criteria
- migration requirements
- explicit exclusions

**Handoff format** (rules file §36): TASK · SCOPE · REQUIREMENTS · CONTRACTS · DEPENDENCIES · SOURCES · FORBIDDEN · IMPLEMENTATION · TESTS · ACCEPTANCE · STATUS · REPORT.

**What Claude needs before any package can be implemented:**
1. The full text of 30.26 Data Contracts. It is referenced but not supplied.
2. The full texts of 30.27.2, 30.27.3, 30.27.4 and 30.27.5. They are referenced in §69.6 but not supplied.
3. The Phase 28 and 29 texts. Referenced as "specified" in the handoff §4, not supplied.
4. The closure status of each 30.27.8 stage.
5. Decisions on the OPEN register entries that block the targeted subsystem.

**Admissible work until then:**
- The audit lane.
- The maintenance lane, **only** when authorised (currently suspended).

---

*End of RECONCILED MASTER BASELINE — 2026-10-03. Evidence: commit `8f9c713`; register entries are reproducible from the cited paths and line numbers.*

---

## 14. Decisions of 2026-10-03 and register status (append — earlier text kept as written)

### 14.1 Owner decisions (ledger R293) — AGREED

| # | Decision |
|---|---|
| 1 | This stage is **30.27.8.RB**. R stays Artifact / Export / Publication / Share. 30.27.9 is not used. |
| 2 | **S** is the operational resumption point, subject to verification of its record. M and all earlier stages are historical record. A Continuity Reconciliation between M and S is required. |
| 3 | Maintenance authorised for the six defects and the dependency vulnerability, conservative only. Path: REPRODUCE → ROOT CAUSE → PATCH → TEST → REGRESSION → VERIFY → REPORT. |
| 4 | Automatic publication to **Production** is paused until the R contract passes test, failure test and acceptance. CI, builds, previews/staging and tests continue. |
| 5 | Lambda NX and World Pi are separate. The logos are separated after a reference check. Table `"L"` is ORPHAN/UNKNOWN: audit it, then remove it only through a documented, reversible migration. Follow-up: no involvement with the World Pi repository. |
| 6 | Missing source texts are never guessed. Anything that depends on them is **BLOCKED — SOURCE SPEC MISSING**. |
| 7 | Update CLAUDE.md as an execution document. Precedence: MASTER → APPROVED PHASE SPEC → TASK HANDOFF → CLAUDE.md → CODE. |
| 8 | SPECIFIED ≠ IMPLEMENTED, and the status ladder IMPLEMENTED / INTEGRATED / TESTED / EVALUATED / ACCEPTED, each with its own evidence. |
| 9 | A change plan precedes any significant change: SCOPE → … → STATUS. |
| 10 | On conflict: create a Conflict/Continuity Record and apply the latest approved decision after verification; never delete the older one. |

### 14.2 Register status after 30.27.8.RB work

"FIXED (L1)" means the Existing System defect is corrected with test evidence. It does not change any Master status.

| Entry | Status | Evidence |
|---|---|---|
| CONF-G01 Who researches | **RESOLVED** — decision 7 | CLAUDE.md §0, §2 rule 2, rule 8; agent descriptions `field-scout`, `source-hunter` |
| CONF-G02 Standing instructions vs stop-at-gap | **RESOLVED** — maintenance lane, authorised per batch | Decision 3; CLAUDE.md §9 |
| CONF-G03 Definition of Done vs completion chain | **RESOLVED** | CLAUDE.md §6 renamed "Repository merge gate — not Master COMPLETE" |
| CONF-G04 Product identity | **RESOLVED** | CLAUDE.md §1 labelled as current implementation surface |
| CONF-G05 Two status systems | **RESOLVED** | CLAUDE.md §0, §2 rule 5 |
| CONF-G06 "One million sources" target | **OPEN** — keep / relabel / retire | Reach is now reported by unit (M-03); the target itself is undecided |
| CONF-G07 "No redesign" vs new surfaces | **OPEN** — no decision recorded | — |
| CONF-P01 2026-09-19 "NEXT 30.27" | **SUPERSEDED (historical)** | Decision 2 |
| CONF-P02 "M — immediate continuation target" | **RESOLVED** — S operational, M history | Decision 2; `CONTINUITY_M_S.md` CR-01 |
| CONF-P03 Dating inconsistencies | **SUPERSEDED (historical)** by §70.16 and decision 2 | — |
| CONF-P04 Letters B, C, I, J | **OPEN** | — |
| CONF-P05 Stage-ID collision | **RESOLVED** — 30.27.8.RB | Decision 1 |
| CONF-V01 Two ladders | **OPEN** (direction AGREED: map, not merge) | §7 |
| CONF-V02 Admiralty preserved | **OPEN** (direction AGREED) | §7.3; CLAUDE.md §6 |
| CONF-V03 Gate order | **OPEN** | — |
| CONF-V04 Confidence counted keys | **FIXED (L1)** | `MAINTENANCE_BATCH_01.md` M-02 |
| CONF-F01 Forecast wording | **RESOLVED** | CLAUDE.md §1 |
| CONF-F02 Calibration overclaim | **FIXED (L1)** | M-04 |
| CONF-X01 World Pi artefacts | **RESOLVED** for the logos: removed from the tree after a reference check (only `scripts/package.mjs` named them, in a comment), recoverable from commit `6cdd821` (sha256 `fa4e7fe3…`, `7d21a615…`). The World Pi repository was not touched. `scripts/prepare-logo.py` is generic tooling and is **kept** — no decision recorded on it. | §14.3 |
| CONF-X02 Pi absent from the Master | **OPEN** — Master entry required (research owner) | CLAUDE.md §10 records Pi's role on the execution side |
| CONF-X03 Auth "switch" | **PARTIAL** — message and documentation corrected (M-06). Registering standalone in the factory is OPEN (MR-13). | M-06 |
| CONF-S01, S02, S06, A01 | **BLOCKED — SOURCE SPEC MISSING** (30.26; 30.27.6 not closed) | Decision 6 |
| CONF-S03 Health taxonomy | **OPEN** — research required | — |
| CONF-A03 MCP version | **OPEN** — research required | — |
| CONF-L01 Automatic publishing | **PARTIAL** — Production deployment pause decided (decision 4), **not yet applied** (§14.4). Content auto-publishing on the running deployment continues (§14.4). | — |
| CONF-Q01 NUL bytes | **FIXED (L1)** — 5 files, not 1 | M-01 |
| CONF-Q02 Reach units | **FIXED (L1)** | M-03 |
| CONF-Q03 Monitors description | **WITHDRAWN — false finding** (audit misread) | M-05 |
| CONF-D01 Table `"L"` | **RESOLVED** — quarantined, reversible | §14.5 |

### 14.3 World Pi separation

- **References checked:** `app`, `components`, `lib`, `scripts` and config. The only references were `scripts/package.mjs` (a comment and a studio-bundle exclusion rule, both kept — the comment now records the separation) and the `public/branding/README.md` that described the logos.
- **Removed from the tree:** `public/branding/` (the two PNGs and their README).
- **Restore, if ever needed:** `git checkout 6cdd821 -- public/branding/`. That commit is on `origin/main` and on this branch.
- **Not touched:** the World Pi repository. Per the owner's follow-up, Lambda NX has no involvement with it. A read-only clone made before that follow-up was deleted unmodified.

### 14.4 Production deployment — decision 4, NOT YET APPLIED

- **Live observation (2026-10-03):** the production site is `lambdanx.netlify.app`, Netlify project `lambdanx`. It deploys `main` automatically: the current deploy `6ac10a06…` is commit `9c19303` (a Dependabot merge), `context: production`, `locked: null`, so auto-publishing is **on**. The site name recorded in the baseline (`melodious-tiramisu-8edae7`) is not in this account's project list. §1.3 of this document is superseded by this observation.
- **Why Claude did not apply it:** the Netlify tools available to this session can read projects and deploys, but have **no lock / "stop auto publishing" operation**, and the session holds no Netlify token. Nothing was changed on Netlify.
- **Owner action** (Netlify keeps building and serving deploy previews while Production stays fixed):
  1. Open Netlify → project **lambdanx** → **Deploys**.
  2. On the current published deploy, choose **Lock to stop auto publishing** (or **Stop auto publishing**).
  3. Reverse it later with **Start auto publishing**.
- **Separate question (CONF-L01):** the running deployment's scheduler still runs the `publish` job every 20 minutes, which auto-publishes *content* (posts) on that Production site. Freezing deployments does not stop it. There is no existing switch to pause it without new code. Decision required: whether content auto-publishing is also paused, and how.

### 14.5 Orphan table `"L"` — audit and quarantine (decision 5)

Audit evidence (read-only, 2026-10-03):
- Absent from schema, migrations and code.
- Shape is the dashboard template (identity `id` + `created_at`).
- **Never written** — 0 rows, identity sequence `is_called = false`, 0 inserts / updates / deletes.
- No foreign keys, views, triggers, policies or functions reference it.
- It was the sole member of the `supabase_realtime` publication, with 0 subscriptions.
- 0 mentions in 24 h of logs across 9 services.
- Created by hand between `group_members` and `blobs`.

The migration (`db/ops/orphan-L-quarantine.sql`) moves it to the non-exposed schema `lambda_orphaned`, removes it from the publication and revokes the `service_role` grant. `db/ops/orphan-L-restore.sql` reverses every step.

| Check | Result |
|---|---|
| Local round trip (PostgreSQL 16, Supabase roles and publication mimicked) | Before = after-restore, identical. Both scripts safe to repeat. The guard refuses when rows exist. |
| Live, before | `public."L"` present, publication member, service_role ALL, 25 tables in `public` |
| Live, after (2026-10-03) | `public."L"` absent; `lambda_orphaned."L"` present with 0 rows; publication members 0; no grants; sequence moved with the table; **24 tables in `public`, 0 without RLS**; anon / authenticated have no USAGE on the schema |
| DROP | **Not performed.** A separate later owner decision once the quarantine has stood. |

---

## 15. Decisions of 2026-10-03, later (ledger R294) — append

| Entry | New status | Evidence |
|---|---|---|
| **CONF-L01** — content auto-publishing | **RESOLVED** — **paused**. `publish` is moved from `SCHEDULE` to `UNSCHEDULED` with the owner's reason, and removed from the Vercel fallback and `vercel.json`. Route, job and manual `/api/publish/run` are kept. A test fails if it becomes due on any tick, or gains a fallback slot. | `lib/ops/schedule.ts`; `lib/ops/schedule.test.ts` (3 new tests fail on the old schedule); `docs/DEPLOY.md` |
| **CONF-G06** — "one million sources" | **RESOLVED — KEEP** (owner). Counted as publishers by unit (CLAUDE.md §2a, M-03). | `SOURCE_POPULATION_PLAN.md` |
| "SOURCE SPEC MISSING" for 30.26, 30.27.2–5, Phase 28/29 | **Corrected → NOT SUPPLIED TO CLAUDE.** The texts exist in the owner's library. A–P to be checked during reconstruction. | `CONTINUITY_M_S.md` §7 |

**Live observation (2026-10-03):**
- The `posts` table holds **95** rows: 94 by the system author "Lambda" and 1 by a user.
- The last automatic post was **2026-08-27 11:27 UTC**. There are **0** posts in the last 7 days and **0** social channels.
- Automatic publishing had therefore already stopped in practice on Production, consistent with the database having been paused and the deployment's environment being incomplete. The schedule change makes the stop deliberate, and keeps it in force when deploys resume.
- The "52 posts" figure in §1.4 was wrong, most likely read from a planner estimate rather than a count, and is superseded by this count.

**Production deployment lock** (§14.4) remains an **owner action** on Netlify. The schedule change above sits on this branch only: it reaches Production only through a merge to `main` and a deploy, both of which are paused.

---

## 16. Intake of the 2026-10-04 owner handoff (ledger R295) — append

See `PACKAGE_INTAKE_2026-10-04.md`.

| Entry | Status after intake |
|---|---|
| MR-01, MR-02, MR-03 — envelope, temporal, errors | **Contract text supplied:** Build §9, §14.4, §10.6 and §15. Status stays **BLOCKED**: S is blocked (Build §29.4) and no task sheet has been issued. |
| MR-04, MR-05, MR-06 — health, connector, licence | Contract text supplied (Build §31, §43, §46). BLOCKED for the same reason. |
| CONF-V01 — ladders | **OPEN** — sharpened by PI-01: three scales, and ladder A neither superseded nor mapped. |
| CONF-V02 — Admiralty | **RESOLVED** — Build §32 keeps Admiralty separate from the ladder. |
| CONF-F01 — forecast wording | **RESOLVED** — Build §41 confirms it. |
| CONF-A03 — MCP version | Research anchor supplied (Build §10.1, §56). It is beyond Claude's verification; the upgrade waits for a task sheet. |
| CONF-S03 — health taxonomy | **OPEN** — Build §31 restates the Master taxonomy. The mapping of `cached` and `empty` is still undecided. |
| New: D-01, Next.js 15.5.27 | DISCOVERED — needs a dedicated maintenance unit, awaiting authorisation. |
| New: D-03, calibration "forecast" terminology | DISCOVERED — research owner. |
