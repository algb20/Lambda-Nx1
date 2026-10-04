# Current-System Audit — Step 2 of the resumption pipeline (2026-10-04)

| | |
|---|---|
| **Requested** | Owner, ledger R305: «ابدأ التدقيق» |
| **Lane** | Audit — read-only. **No code, configuration, database or deployment was changed.** |
| **Repository** | `claude/bittorent-network-app-c8j9pv` @ `3ce89da` (identical code to `main` @ `65e1cc6` plus documentation) |
| **Live systems** | Netlify `lambdanx`; Supabase `roykbyzkskhmzclzobmd`. Observed 2026-10-04 17:21–17:22 UTC. |
| **Rule** | Nothing is IMPLEMENTED against the Master without a test of the *target* contract. Similar code is a PRECURSOR. |

---

## 1. Repository test evidence (RT), measured at HEAD

| Check | Result |
|---|---|
| `npx vitest run` | **2780 tests: 2770 passed, 0 failed, 10 skipped.** The skips are in 5 files that need a database or the live network: `lib/db/erasure.integration.test.ts`, `ckan.test.ts`, `pubmed.test.ts`, `domain.test.ts`, `radar/watch.test.ts`. |
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | success |
| Browser suites (`tests/browser`, 4) | Not run (UV) |

These tests prove **repository behaviour**. None tests a Master contract.

---

## 2. Live observations (LO, 2026-10-04 17:21–17:22 UTC)

### 2.1 Production (Netlify `lambdanx`)

| Observation | Evidence |
|---|---|
| The published deploy is still `6ac10a06…`, built from commit **`9c19303`** (2026-10-03). The PR #74 merge (`65e1cc6`) has **not** been published. | Netlify project read |
| `/api/health` → HTTP 200, `status: degraded` | Live call |
| `session_secret` ok · `pi_api_key` ok · `ai_analyst` ok · `cron_secret` ok · `migrations` ok (24 bundled) | `/api/health` checks. Improved since 2026-08-28, when `SESSION_SECRET` was unset. |
| `mail` off · `admin_secret` off · `social_secret_key` off | `/api/health` checks |
| **Database: FAILING.** Deep check 1: `password authentication failed for user "postgres" [28P01]`. Deep check 2: `database did not answer within 5000ms`. | `/api/health?deep=1`, two calls 3 s apart |
| `/api/diagnose`: catalogue 247 declared · 165 active · 59 coded. Feeds: 135 contributing · 35 answered empty · 3 failed — `bse_india` 403, `nasa_donki` HTML instead of JSON, `si_volcano_weekly` 403. | Live call |

### 2.2 Database (Supabase)

| Observation | Value |
|---|---|
| Tables in `public` / with RLS off | 24 / **0** |
| `"L"` | still quarantined in `lambda_orphaned` |
| Migration history rows | 24 |
| Security advisor | INFO `rls_enabled_no_policy` ×25 (by design: deny-all). No other security findings. |
| `source_health_daily` | 1,454 rows. **171 rows dated 2026-10-04**, 13 dated 2026-10-03 — Production was writing to the database earlier today. |
| `posts` | **95** (last 2026-08-27; 0 in the last 7 days) |
| `radar_findings` | **962** (last 2026-08-27) |
| `ontology_nodes` / `ontology_edges` | **78 / 73** |
| `users` | 3 |
| `evidence`, `monitors`, `alerts`, `calibration_claims`, `verification_codes` | **0** each |

**Correction to earlier records.** `RECONCILED_MASTER_BASELINE.md` §1.4 reported posts 52, radar_findings 837 and ontology 41/38. Those were planner estimates, not counts. The exact counts above supersede them. The baseline's §15 had already corrected posts to 95.

---

## 3. Findings that need the owner (no action taken)

| ID | Finding | Evidence | Impact | Owner action / decision |
|---|---|---|---|---|
| **AF-1** | **Production cannot reach the database now.** Writes succeeded earlier today (171 source-health rows on 2026-10-04); now credentials are rejected (28P01), or the connection times out. | §2.1, §2.2 | Sign-in, persistence, radar and source-health writes fail on the live site. Most likely cause (**UV**): the database password was rotated and Netlify's `DATABASE_URL` still holds the old one. | Update `DATABASE_URL` on Netlify: the pooler host, with the password percent-encoded. Netlify functions read environment variables at deploy time, so a **redeploy** is needed, which touches the Production pause (AF-2). |
| **AF-2** | **Production runs pre-pause code.** Deploy `9c19303` predates batch 01 and R294. It still schedules the `publish` job every 20 minutes (`cron_secret` configured — "auto-publishing can run"), and it still carries `sharp` 0.35.3. | §2.1; `git log 9c19303..65e1cc6` | Once the database answers again, the **old** Production code may resume automatic publishing, contrary to owner decision 4 and R294. The `sharp` advisory remains live. | Decide between: (a) keep Production locked and leave `DATABASE_URL` unchanged until R closes; (b) deploy `main` (`65e1cc6`), which brings the `publish` pause and the `sharp` fix, as an authorised one-off exception to the deploy pause; (c) remove `CRON_SECRET` from Production. The default under the pause is (a). |
| **AF-3** | Three live feeds fail: `bse_india` 403, `nasa_donki` returns HTML, `si_volcano_weekly` 403. | `/api/diagnose` | Coverage gaps, already visible in source health | A maintenance-batch candidate (quarantine and recheck exist in code) |
| **AF-4** | Several features have **zero live data**: evidence, monitors, alerts, calibration claims. | §2.2 | Their code is REPO-TESTED, but their production use is unproven (LO = none) | Information only |
| **AF-5** | Mail, admin and social secrets are unset on Production. | §2.1 | Email sign-up and reset return 503; admin routes return 503 | Owner (environment variables) |

---

## 4. Per-row evidence — the 48 mapping rows

**Columns:**
- **Code** and **Tests** — key paths.
- **Live** — what §2 shows.
- **Class** — the evidence class (RP / RT / LO / NP).
- **Fit** — PRECURSOR / NON-CONFORMANT / NONE.

**Absence searches** used the target's own vocabulary across all tracked source files. "0 hits" means the term occurs nowhere in source.

| Row | Target | Code (RP) | Tests (RT) | Live (LO) | Class | Fit | Absence evidence |
|---|---|---|---|---|---|---|---|
| G01 | §9.1 envelope | `db/schema.ts` (24 `pgTable`) | `db/schema-sql.test.ts`, `lib/db/rls.test.ts` | 24 tables | RP RT LO | NON-CONFORMANT | `valid_time\|knowledge_time\|tenant_scope\|schema_version\|object_type\|source_references`: **0 hits** |
| G02 | §9.4 provenance | `db/schema.ts` evidence (`content_hash`, `archive_url`, `retrieved_at`); `lib/engine/types.ts` | `lib/engine/engine.test.ts` | evidence: **0 rows** | RP RT | PRECURSOR | `derived_from\|transformation_chain`: 0 hits |
| G03 | §9.5 / §14.4 time + PIT | `lib/engine/types.ts` (`publishedAt`); `lib/modules/world-events*.ts` (`observedAt`, `receivedAt`). The evidence table persists `retrieved_at` and `created_at` only. | `lib/alerts/rules.test.ts` and others | — | RP RT | NON-CONFORMANT | `knowledge_time\|valid_time\|pointInTime`: 0 hits. Publication time not persisted (`db/schema.ts` evidence block). |
| G04 | §9.2–9.3 quality / uncertainty | `lib/engine/analysis.ts`, `lib/analysis/confidence.ts` | `engine.test.ts`, `confidence.test.ts` | — | RP RT | PRECURSOR | `fitness_for_use\|measurementUncertainty`: 0 hits |
| G05 | §10.1–10.2 REST / OpenAPI | 84 `route.ts`; `lib/api-catalog.ts`; `/docs/api` | `lib/api-catalog.test.ts` | Routes answer (diagnose / health) | RP RT LO | PRECURSOR | "OpenAPI" appears once, in a comment about a competitor (`app/llms.txt/route.ts:14`). No OpenAPI document. |
| G06 | §10.6 / §15 problem details | `NextResponse.json({ error … })` in **56 / 84** routes | Route tests assert the current shape (e.g. `app/api/auth/register/route.test.ts`) | `/api/health` JSON | RP RT LO | NON-CONFORMANT | `problem+json`: **0** routes |
| G07 | §10.4 job API | `app/api/cron/[job]/route.ts`, `lib/ops/schedule.ts`, `lib/queue` (memory) | `lib/cron/auth.test.ts`, `lib/ops/schedule.test.ts` | `cron_secret` ok | RP RT LO | PRECURSOR | No 202 + `job_id` pattern |
| G08 | §10.5 / §21 events | `lib/stream/sse.ts`, `lib/stream/broadcast.ts`, `lib/stream/route.ts` | `lib/stream/sse.test.ts`, `broadcast.test.ts` | — | RP RT | NONE (bus) / PRECURSOR (SSE) | `CloudEvent\|specversion`: 0 hits |
| G09 | §11 UIAction + context | `lib/prefs/*`, `lib/globe/view-state.ts`, `components/density-control.tsx` | `lib/globe/view-state.test.ts`, `lib/prefs/schema.test.ts` | — | RP RT | PRECURSOR | `UIAction\|AnalyticalContext`: 0 hits |
| G10 | §12 streaming / resume / replay | `lib/stream/sse.ts`, `lib/stream/use-live.ts` | `lib/stream/sse.test.ts` | — | RP RT | PRECURSOR | `Last-Event-ID\|resumePosition\|CHANGE_CURSOR`: 0 hits |
| G11 | §13 versioning / change ledger | `db/migrations/meta/_journal.json`, `lib/db/probe.ts` | `lib/db/rls.test.ts` (journal reachability) | Migration history 24 | RP RT LO | NONE (contracts) | `ContractRegistry\|contract_version`: 0 hits |
| G12 | §14.1 idempotency | Publisher dedup (`lib/modules/publish-job.ts`), radar fingerprints, evidence dedup | `engine.test.ts`, `ontology.test.ts` | — | RP RT | PRECURSOR | `Idempotency-Key`: 0 hits |
| G13 | §14.2 ETag / If-Match | — | — | — | NP | NONE | `If-Match\|ETag\|If-None-Match`: 0 hits |
| G14 | §14.3 opaque cursors | — | — | — | NP | NONE | `nextCursor\|encodeCursor`: 0 hits |
| G15 | §16–§18 agent / handoff / security | `lib/mcp/server.ts` (6 tools, protocol `2024-11-05`); `lib/ai/claude.ts` (single call) | `lib/mcp/server.test.ts`, `lib/ai/claude.test.ts` | `ai_analyst` ok | RP RT LO | NONE (runtime) / PRECURSOR (MCP) | `AgentDefinition\|CapabilityBinding\|ToolBinding\|credentialBroker`: 0 hits |
| G16 | §19 evidence boundary / L0–L7 | `lib/engine/analysis.ts` (`originOf`), `lib/engine/catalog/origins.ts`, Admiralty fields | `engine.test.ts`, `origins.test.ts` | evidence: 0 rows | RP RT | PRECURSOR | `VerificationLevel\|verification_level`: 0 hits |
| G17 | §20 promotion | — | — | — | NP | NONE | `PromotionGate\|canonical_write`: 0 hits |
| G18 | §22 event → inference | `lib/analysis/significance.ts`, `correlation.ts`, `stories.ts` | `significance.test.ts`, `correlation.test.ts` | — | RP RT | PRECURSOR | `situation_id\|hypothesis_id`: 0 hits |
| G19 | §23 temporal / causal | `lib/analysis/timeline.ts` | `timeline.test.ts` | — | RP RT | PRECURSOR (temporal) / NONE (causal) | `causal_graph\|counterfactual\|confounder`: 0 hits |
| G20 | §24 triggers | `lib/ops/schedule.ts` (6 jobs; `publish` paused), `netlify/functions/scheduled-jobs.mts` | `lib/ops/schedule.test.ts` | Production runs the **old** schedule (AF-2) | RP RT LO | PRECURSOR | `TriggerDecision\|EVENT_TRIGGER`: 0 hits |
| G21 | §25 monitoring / alert | `app/api/alerts`, `lib/alerts/delivery.ts` (HMAC), radar-monitors job | `lib/alerts/delivery.test.ts`, `rules.test.ts` | monitors 0, alerts 0 | RP RT | PRECURSOR | `NO_DATA\|hysteresis\|alert_lifecycle`: 0 hits |
| G22 | §26 inbox / attention | `app/api/brief`, `app/api/alerts` | `lib/alerts/*.test.ts` | alerts 0 | RP RT | NONE | "inbox" occurs only as an *email* inbox (`lib/auth/verification.ts`); `AttentionItem`: 0 hits |
| G23 | §27 workspace sync | `app/api/export/share`, `lib/globe/view-state.ts`, `app/p/[id]` | `view-state.test.ts`, `self-origin.test.ts` | — | RP RT | PRECURSOR | `AnalyticalContext\|context_version\|workspace_id`: 0 hits |
| G24 | §28 publication | `lib/modules/autopublish.ts`, `publish-job.ts`, `lib/social/*` | `lib/ops/schedule.test.ts` (pause), broadcast tests | posts 95, last 2026-08-27; social channels 0; **Production still schedules `publish`** (AF-2) | RP RT LO | NON-CONFORMANT (AUTO-only) — paused in code, **not on Production** | `PublicationMode\|HUMAN_ONLY`: 0 hits |
| G25 | §29 / §70.18 S closure | — | — | — | NP | NONE | `ClosureMatrix\|blast_radius`: 0 hits |
| G26 | §30 world model / graphs | `entities`, `entity_links`, `ontology_*` tables; `buildGraph` | `engine.test.ts`, `ontology.test.ts` | ontology 78 / 73 | RP RT LO | PRECURSOR | `CanonicalObject\|world_model_version`: 0 hits |
| G27 | §31 source control plane | `lib/engine/catalog/*`, `quarantine.ts`, `licence.ts` | `catalog.test.ts`, `recheck.test.ts` | 165 active; 135 contributing / 35 empty / 3 failed; source-health rows today | RP RT LO | PRECURSOR / NON-CONFORMANT (health set) | `HEALTHY\|DEGRADED\|STALE\|OFFLINE` as health states: 0 hits |
| G28 | §32 TruthStatus | — | — | — | NP | NONE | `TruthStatus\|CORROBORATED\|CONTESTED`: 0 hits |
| G29 | §33 geo / EO | `lib/geo/atlas.ts`, `places.ts`; Sentinel/Landsat keyed rows (`feeds/keyed.ts`, incl. Copernicus `…/stac/search` URL, inactive) | `lib/geo/atlas.test.ts`, `places.test.ts` | — | RP RT | PRECURSOR (weak) | No STAC client; the only "stac" is an inactive catalogue URL |
| G30 | §34 maritime / aviation / infra | `lib/analysis/corridors.ts`, `lib/engine/sources/maritime.ts`, `aviation.ts` | `corridors.test.ts`, `maritime.test.ts` | — | RP RT | PRECURSOR (weak) | AIS appears only in the statement "we carry no AIS" (`components/country-dossier.tsx`, `corridors.ts`) |
| G31 | §35 resources | `resources` gateway; `feeds/national.ts` | gateway tests | — | RP RT | PRECURSOR (weak) | — |
| G32 | §36 finance / IPO | markets, crypto, filings, sanctions sources and boards | `board-view.test.ts`, source tests | — | RP RT | PRECURSOR | `prospectus\|offering_status`: 0 hits |
| G33 | §37 C&F (domain pack, R301-1) | `app/api/intelligence/companies`, `filings`, `ownership`, `procurement` | `companies.test.ts`, `ontology.test.ts` | — | RP RT | PRECURSOR | `Facility\|facility_id`: 0 hits |
| G34 | §38 supply chain (domain coverage, R304) | `lib/analysis/corridors.ts`, `impact.ts` | `corridors.test.ts`, `impact.test.ts` | — | RP RT | PRECURSOR (weak) | `SupplyChain\|supplier_id`: 0 hits |
| G35 | §39 information world | news, GDELT, trending, broadcasts; syndication dedup | `broadcasts.test.ts`, news tests | GDELT answered empty today (`/api/diagnose`) | RP RT LO | PRECURSOR | `narrative_id\|claim_propagation`: 0 hits |
| G36 | §40 discovery / research | `lib/radar/*`, `catalog/recheck.ts`, investigations | `recheck.test.ts`, radar tests | radar_findings 962, last 2026-08-27 | RP RT LO | PRECURSOR | `ResearchTask\|research_depth`: 0 hits |
| G37 | §41 forecast (evaluation side) | `lib/modules/calibration.ts`, `app/api/calibration`, `components/calibration-scoreboard.tsx` | `calibration.test.ts` | calibration_claims **0** | RP RT | PRECURSOR (evaluation record, D-03) | `ForecastObject\|predictionInterval`: 0 hits. `brier` appears only in a test asserting its absence. |
| G38 | §42 multimodal | Text and structured evidence; media gateway | source tests | — | RP RT | PRECURSOR (weak) | `EvidenceAnchor\|bbox`: 0 hits |
| G39 | §43 AI context firewall | `lib/ai/claude.ts`, `lib/ai/suggestions.ts` (SDK imports) | `lib/ai/claude.test.ts`, `prompt.test.ts` | `ai_analyst` ok | RP RT LO | NON-CONFORMANT | `ContextFirewall\|ai_processing`: 0 hits |
| G40 | §44 evaluation sets | 201 test files | all | — | RT | PRECURSOR | `golden_set\|adversarial_set`: 0 hits |
| G41 | §45 resilience | `/api/health`, `/api/diagnose`, `lib/deployment/diagnose.ts`, quarantine, fallback | `lib/deployment/diagnose.test.ts`, `lib/db/errors.test.ts` | Health correctly reports the DB failure (AF-1) | RP RT LO | PRECURSOR | `RecoveryController`: 0 hits |
| G42 | §46 security / legal | Guardrail, licence gate, `RateLimiter`, CSP, RLS migration 0022 | `lib/db/rls.test.ts`, `probe.test.ts`, posture tests | RLS 24/24; advisors: INFO only | RP RT LO | PRECURSOR (strong) | `tenant_id\|rbac\|abac`: 0 hits |
| G43 | §47–§48 visualization | globe, map, scrubber, constellation, board, dossier, places | `board-view.test.ts`, `workspace-tabs.test.ts`; 4 browser suites (not run, UV) | — | RP RT | PRECURSOR | `CausalGraph\|DiffView`: 0 hits |
| G44 | §49 contract registry | — | — | — | NP | NONE | `ContractRegistry`: 0 hits |
| G45 | §50 domain packs | `lib/gateways.ts` (33 gateways / 7 families) | `lib/gateways.test.ts`, `board-view.test.ts` | — | RP RT | PRECURSOR | `DomainPack\|leading_indicators`: 0 hits |
| G46 | §51 one-million target | `lib/engine/catalog/families.ts` (`ReachUnit`, `reachByUnit`) | `catalog.test.ts` | 165 active integrations live | RP RT LO | PRECURSOR | — |
| G47 | Phase 28 technology | `lib/engine/sources` OpenAlex / Crossref / PubMed; `families.ts` | `pubmed.test.ts` (skipped offline), `research.test.ts` | — | RP RT | PRECURSOR (weak) | `TechnologyObject\|patent_family`: 0 hits |
| G48 | Phase 29 live | Live edge, source health, `lib/stream/*`, quarantine | `sse.test.ts`, `recheck.test.ts`, `adapter.test.ts` | source-health rows written today | RP RT LO | PRECURSOR | `watermark` occurs only as the *brand* watermark (`components/watermark`); `freshness_class\|allowed_lateness`: 0 hits |

### 4.1 Result

| Fit | Rows |
|---|---|
| NONE | G08 (bus), G13, G14, G17, G22, G25, G28, G44, and G11 (contracts) — **9** |
| PRECURSOR | **32** |
| NON-CONFORMANT | G01, G03, G06, G24, G27 (health), G39 — **6** |
| Mixed NONE / PRECURSOR | G15 — **1** |
| **IMPLEMENTATION-VERIFIED against the target** | **0** |

The step-1 classification (`INVENTORY_AND_GAPS_2026-10-04.md` §C.2) is **confirmed row for row** by file, test and absence evidence. What changed is the live evidence (§2) and the findings AF-1 to AF-5.

---

## 5. Pipeline status

| Step | Status |
|---|---|
| 1. Canonical Reconciliation | CLOSED for W1, W2, W4, W5 (R302) |
| **2. Current-System Audit** | **DONE for the 48 rows (repository + live).** Open: browser suites not run (UV); the AF items need owner decisions. |
| 3. Missing-spec recovery | Waits on the files listed in `CANONICAL_RECONCILIATION.md` §5.3 |
| 4. Contract consolidation | Feeds S |
| Resumption point | 30.27.8.S — no code (R299) |
