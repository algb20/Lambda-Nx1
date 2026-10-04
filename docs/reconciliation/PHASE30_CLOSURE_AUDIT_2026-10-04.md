# Phase 30 — Contract Recovery and Closure Audit (2026-10-04, R312 / R313)

| | |
|---|---|
| **Stage** | 30.27.8.S (operational resumption point) — preparation for the closure gate |
| **Authority** | Owner R312 (recovery audit; outputs A–F) and R313 (originals are not available; do not present a reconstruction as the original; no broad execution) |
| **Prepared by** | Claude. **This is a Claude-prepared audit, not a Master decision.** Every "Recommended" line awaits the owner. |
| **Base** | `f1ceb38` |

## 0. Basis

### 0.1 Sources

The source files are not committed (public repository); only their fingerprints are recorded.

| Code | Source | sha256 | Use here |
|---|---|---|---|
| **BP** | Build Package (reconciled Master target) | `6a056334…` | Authoritative target. Its reconciled sections (§0–§57) win over its own historical appendices (§58.1). |
| **BP-58** | BP §58 appendices — "exact historical source material" | (inside BP) | Phase 28 (§58.2, from v12) and Phase 29 (§58.3, from v13), both verbatim. v9 contract hardening §213–§273 (§58.4). Q/R/S (§58.5). S deep closure (§70.18). |
| **EP** | Execution Package | `4569844a…` | Execution contract |
| **SUP** | Missing Specification Recovery supplement | `c0e540dd…` | Second reconstruction; B/C/I/J concepts |
| **M0** | Original Master (to 2026-10-03) | `979f9c1f…` | §70.8 summaries of A–P (verbatim) |
| **REPO** | This repository, at `f1ceb38` | — | Existing System evidence (RP / RT / LO) |
| **OWNER** | Ledger R293–R313 | — | Decisions |

### 0.2 Rules applied

- **Text classes:** SOURCE-PRESERVED / CONSOLIDATED / RECONSTRUCTED. Never ORIGINAL.
- **R313:** the standalone originals of 30.26, 30.27.2–5, Phase 28, Phase 29 and the detailed A–P are **MISSING HISTORICAL SOURCE** (owner-confirmed). The BP §58 extracts are what exists. They are labelled by what the BP says they are, and Claude has no file to verify them against.
- **Reconstruction (R312 order):** Master → project documents → repository → prior decisions → standards → documentation → research. Any gap-filling by Claude below is a **CURRENT RECONSTRUCTION PROPOSAL (CRP)** and is never presented as history.
- **Statuses:** SPECIFIED ≠ IMPLEMENTED ≠ INTEGRATED ≠ TESTED ≠ EVALUATED ≠ ACCEPTED ≠ COMPLETE. Repository tests are evidence about the repository, not Master acceptance.

---

## A. Contract Recovery Matrix

### A.0 Summary

| # | Section | Best available text | Class | Spec status (BP) | Repository | Closed enough to implement? |
|---|---|---|---|---|---|---|
| 1 | 30.26 Data Contracts | BP §9; v9 §213–§237 (BP-58.4); SUP §4; M0 §6, §12 | RECONSTRUCTED / CONSOLIDATED; original MISSING HISTORICAL SOURCE | SPECIFIED — RECONSTRUCTED | 24 tables, **0** envelope fields (G01, NON-CONFORMANT) | **No** — D2 and D3 open |
| 2 | 30.27.2 UIAction + Analytical Context | BP §11; Q §69.4 (verbatim, builds on it); SUP §6 | RECONSTRUCTED | SPECIFIED — RECONSTRUCTED (owner R298: IN PROGRESS) | Preferences, URL view-state (G09, PRECURSOR weak) | **No** |
| 3 | 30.27.3 Streaming / Sync / Resume / Replay | BP §12; v9 §255, §256, §258; SUP §7 | RECONSTRUCTED | SPECIFIED — RECONSTRUCTED | `/api/world/stream`, `/api/chain/stream` SSE (G10) | **No** |
| 4 | 30.27.4 Versioning / Compatibility | BP §13; v9 §241, §259, §260; S §69.17–69.19; SUP §8 | RECONSTRUCTED | SPECIFIED — RECONSTRUCTED; SUP: version placement and sunset = DECISION REQUIRED | Migration journal only (G11) | **No** |
| 5 | 30.27.5 Idempotency / Concurrency / Pagination / PIT | BP §14; v9 §228, §246, §250; SUP §9 | RECONSTRUCTED | SPECIFIED — RECONSTRUCTED | Publisher dedup, radar fingerprints (G12–G14) | **No** — depends on 30.26 time fields (D3) |
| 6 | Phase 28 Technology Intelligence | **BP §58.2** (verbatim from v12; 28.0–28.45 with exit gate); BP §7 summary | SOURCE-PRESERVED (per BP); standalone file MISSING HISTORICAL SOURCE (R313) | SPECIFIED / AGREED — NOT IMPLEMENTED | `research` gateway (G47, weak) | **No** — depends on the World Model and 30.26 |
| 7 | Phase 29 Live Intelligence | **BP §58.3** (verbatim from v13; 29.0–29.110, including contracts, events, evaluation, failure, security, performance and acceptance gates); BP §8 | SOURCE-PRESERVED (per BP); standalone file MISSING HISTORICAL SOURCE (R313) | SPECIFIED / AGREED — NOT IMPLEMENTED | Live edge, freshness, source health, SSE, quarantine, recheck (G48) | **No** as a whole. Individual source-health items are a precursor. |
| 8 | Stage I — historical reconstruction / temporal evidence | SUP §10: "RECOVERY REQUIRED for exact historical text" | **MISSING HISTORICAL SOURCE** | — | none | **No** — CRP in A.8 |
| 9 | A–P | M0 §70.8 summaries (verbatim); BP §16–§26 (reconstructed detail); SUP §10 | Summaries SOURCE-PRESERVED; detail RECONSTRUCTED / CONSOLIDATED; B, C, J concepts RECONSTRUCTED; detailed originals MISSING HISTORICAL SOURCE | All RESEARCHED → SPECIFICATION IN PROGRESS | MCP server (6 tools), confidence by origins, cron, monitors (G15–G22) | **No** |
| 10 | 30.27.8 A–S and R_FINAL | BP §0.0, §6, §16–§29, §58.5 (Q/R/S verbatim), §70.18 (S deep closure); `…2026-09-25_R_FINAL.md` | Q/R/S SOURCE-PRESERVED (per BP); R_FINAL **MISSING HISTORICAL SOURCE** (R313: not available) | S: RESEARCHED → SPECIFICATION IN PROGRESS; closure matrix SPECIFIED — DRAFT | No closure machinery (G11, G24) | **No** — this *is* the gate |

### A.1 — 30.26 Data Contracts

| Field | Content |
|---|---|
| Scope | The persistent canonical object model: envelope, quality, uncertainty, provenance, time semantics, relationships and events, extensions (BP §9.1–§9.7) |
| Existing evidence | REPO: `db/schema.ts`, 24 `pgTable`s, 24 migrations; RLS 24/24 (LO). Searches for `valid_time\|knowledge_time\|tenant_scope\|schema_version\|object_type\|source_references` find **0 hits** (G01). The engine `Evidence` type carries source URL, retrieved/published time, Admiralty and confidence: a precursor of §9.4 and §9.5. |
| Requirements | 17 envelope fields (BP §9.1); immutable IDs; updates create versions; quality has 10 dimensions; uncertainty has 11 kinds and is never one opaque score; derived objects carry a provenance graph; ≥ 6 time axes and point-in-time with no future leakage; closed schemas by default; explicit units, ISO 4217, BCP 47, CRS |
| Decisions | Owner R298: 13 more object types named. Owner R308: 30.26 is documented in part; the owner will rebuild its final version. |
| Contracts | BP §9; v9 §215 envelope, §216 provenance, §218 quality/uncertainty, §239 identity, §240 temporal, §243 confidence/probability/reliability, §267–§273 object contracts (BP-58.4) |
| Dependencies | Upstream: none. Downstream: everything — 30.27.x, A–S, Phase 28, Phase 29. |
| Alternatives | D3: (a) an additive canonical layer; (b) evolve the 24 tables in place; (c) a hybrid |
| Rejected alternatives | A destructive rewrite of existing tables (R296, R298-14) |
| Security | `classification`, `visibility`, `tenant_scope` and `policy` are envelope fields; no tenant model exists (CR: none) |
| Licensing | Every canonical object references sources whose licence travels with it. The repository's licence registry exists for catalogue records only (see B, NEW-03). |
| Failure modes | Future leakage in historical queries; collapsed uncertainty; identity drift |
| Fallback | — (a data contract has none; consumers degrade) |
| Tests | v9 §234 / §261 contract testing (BP-58.4); BP §70.18.18 tests 1–4 |
| Acceptance criteria | BP §70.18.14 A–B (specification and schema gates) |
| Implementation requirements | One migration contract per table (BP §53). D2 and D3 decided first. |
| Current repository status | NOT IMPLEMENTED. Precursor: `Evidence`, provenance-like fields, `gradeConfidence` by independent origins (RT). |
| Gaps | GAP-S1 (original text); D2 (object set, 18 vs 31 types — SC-09); D3 (tables vs canonical layer — CONF-S01) |
| Conflicts | SC-09 (object list: BP vs R298) |
| Resolution | **Owner-led** (R308: "the owner will rebuild and document the final version"). CRP: adopt BP §9 as the working text, labelled RECONSTRUCTED, with SC-09 resolved as D2(c). Not applied. |
| Status | SPECIFIED — RECONSTRUCTED; **BLOCKED for implementation** (D2, D3) |

### A.2 — 30.27.2 UIAction + Shared Analytical Context

| Field | Content |
|---|---|
| Scope | Semantic UI actions; separation of View, Analytical Context, Workspace and Execution state; cross-view invariant (BP §11) |
| Existing evidence | `/api/preferences`; URL view-state; tab layout. **No `UIAction` type, no context versioning.** The AI analyst does not mutate UI. |
| Requirements | 26 action types; per-action fields with a risk class (6 classes); AI/agent never mutates canonical truth or arbitrary UI state; an `AnalyticalContext` with 15 fields and a version; every view of the same context uses the same version |
| Decisions | Owner R298: SPECIFICATION IN PROGRESS. R302: Q builds on 30.27.2. |
| Contracts | BP §11; Q §69.4 (verbatim) |
| Dependencies | 30.26 (context references), E (authorization), 30.27.5 (idempotency for state-changing actions) |
| Alternatives | — (none recorded) |
| Rejected alternatives | Raw click/DOM state as the contract (BP §11.1) |
| Security | The action chain runs proposal → validation → policy → authorization → execute; risk classes EXTERNAL_EFFECT / HIGH_IMPACT / HUMAN_REQUIRED |
| Licensing | EXPORT / PUBLISH actions inherit source licences (R) |
| Failure modes | Cross-view semantic disagreement (S invariant 12) |
| Fallback | Not specified |
| Tests | BP §70.18.18 tests 12–13 |
| Acceptance criteria | Not specified beyond S |
| Implementation requirements | 30.26 and E first |
| Current repository status | NOT IMPLEMENTED (G09 precursor, weak) |
| Gaps | Original text; fallback; risk-class → approval mapping |
| Conflicts | SC-02 (status wording across BP / SUP / R298) |
| Resolution | Status taken as **SPECIFICATION IN PROGRESS**, the owner's later and stricter word (R298) |
| Status | SPECIFICATION IN PROGRESS; BLOCKED |

### A.3 — 30.27.3 Streaming / Incremental Sync / Resume / Replay

| Field | Content |
|---|---|
| Scope | Five transport concepts; four cursor kinds; sync lifecycle; stream contract; degraded states; replay (BP §12) |
| Existing evidence | SSE at `/api/world/stream` and `/api/chain/stream` (RP/RT); `cached` / `empty` / `failed` source states; no change cursor, checkpoint or resume |
| Requirements | At-least-once delivery with idempotent consumers; explicit ordering scope; 17 stream-contract fields; 8 degraded states; replay never repeats external side effects |
| Decisions | — |
| Contracts | BP §12; v9 §255 ordering, §256 delivery/retry/DLQ, §258 replay |
| Dependencies | 30.27.5 (cursors, PIT), K (event semantics), 30.27.6 (retry) |
| Alternatives | — |
| Rejected alternatives | A global event-chronology assumption |
| Security | Stream authorization per subscription |
| Licensing | Inherited |
| Failure modes | Cursor expiry → RESYNC_REQUIRED; out-of-order and late data (Phase 29 §29.5) |
| Fallback | SNAPSHOT re-sync |
| Tests | BP §70.18.18 test 15 (replay) |
| Acceptance criteria | Phase 29 §29.105 acceptance gate (verbatim) covers the live parts |
| Implementation requirements | 30.27.5 and K first |
| Current repository status | NOT IMPLEMENTED (G10 precursor) |
| Gaps | Original text; DLQ validation gate |
| Conflicts | SC-02 |
| Resolution | — |
| Status | SPECIFIED — RECONSTRUCTED; BLOCKED |

### A.4 — 30.27.4 Versioning / Compatibility

| Field | Content |
|---|---|
| Scope | Eight version kinds; six compatibility classes; lifecycle; Contract Change Ledger (BP §13) |
| Existing evidence | `db/migrations/meta/_journal.json`; `package.json` version; build stamp. No contract versions and no change ledger. |
| Requirements | Schema-valid ≠ semantically compatible; DRAFT → … → RETIRED; 16 ledger fields; no silent version migration |
| Decisions | SUP §8: **version placement and sunset policy = RESEARCH / DECISION REQUIRED** |
| Contracts | BP §13; v9 §241, §259, §260; S §69.17–69.19; §70.18.7 transitive compatibility |
| Dependencies | The Contract Registry (BP §49; §70.18) |
| Alternatives | Version placement: URL path / header / media-type parameter — **not decided** |
| Rejected alternatives | — |
| Security | POLICY_BREAK class |
| Licensing | `license_impact` is a ledger field |
| Failure modes | Semantic drift without a schema change (§70.18.18 test 13) |
| Fallback | — |
| Tests | §70.18.18 tests 1–2, 10, 12–13 |
| Acceptance criteria | Gate 1–3 (§70.18.13) |
| Implementation requirements | Placement and sunset decided |
| Current repository status | NOT IMPLEMENTED (G11) |
| Gaps | Placement; sunset; original text |
| Conflicts | SC-02 |
| Resolution | **DECISION REQUIRED** (owner / research) |
| Status | SPECIFICATION IN PROGRESS; BLOCKED |

### A.5 — 30.27.5 Idempotency / Concurrency / Pagination / PIT

| Field | Content |
|---|---|
| Scope | BP §14.1–§14.4 |
| Existing evidence | Publisher dedup (`lib/engine` clustering); radar fingerprints; `If-None-Match` not used; no idempotency keys; cursors not used by the public API |
| Requirements | 9 idempotency fields; same key with a different fingerprint → `IDEMPOTENCY_CONFLICT`; ETag / If-Match → 412; 409 for domain conflict; opaque, query-bound cursors that never grant authorization; ≥ 7 time axes; no future leakage |
| Decisions | — |
| Contracts | BP §14; v9 §228, §246, §250; SUP §9 (adds PIT Context fields) |
| Dependencies | 30.26 time fields (D3); E (authorization re-evaluated on cursor use) |
| Alternatives | — |
| Rejected alternatives | — |
| Security | A cursor must not grant authorization |
| Licensing | — |
| Failure modes | Duplicate external effects on retry (S invariant 13) |
| Fallback | — |
| Tests | §70.18.18 tests 15, 17 |
| Acceptance criteria | Gate B (schema / API / event) |
| Implementation requirements | 30.26 first |
| Current repository status | NOT IMPLEMENTED (G12–G14 precursors) |
| Gaps | Original text; idempotency retention period (`expires_at` policy) |
| Conflicts | SC-02 |
| Resolution | — |
| Status | SPECIFIED — RECONSTRUCTED; BLOCKED |

### A.6 — Phase 28 Technology Intelligence

| Field | Content |
|---|---|
| Scope | Technology → patent / research → company → product → adoption → market (BP §58.2 title) |
| Existing evidence | `research` gateway (OpenAlex, Crossref, PubMed, arXiv, GitHub) — RT; no technology entity, emergence or discontinuity model |
| Requirements | As in the verbatim text 28.0–28.45 (core chain, mandatory separations, entity minimum, emergence, discontinuity, Company ↔ Technology linkage, evaluation; BP §7.1–§7.8) |
| Decisions | Owner R298 / R304: Phase 28 = Technology Intelligence, SPECIFIED |
| Contracts | BP §58.2 (verbatim); BP §7 |
| Dependencies | 30.26, the World Model (BP §30), the Companies & Facilities Domain Pack (BP §37) |
| Alternatives | — |
| Rejected alternatives | — |
| Security | — |
| Licensing | Patent sources: EPO OPS is licence-blocked in this repository (`needsAgreement`) |
| Failure modes | Per 28.x |
| Fallback | Per 28.x |
| Tests | Per 28.x evaluation and exit gate |
| Acceptance criteria | 28.45 exit gate (verbatim) |
| Implementation requirements | Phase 30 closed (BP §55) |
| Current repository status | NOT IMPLEMENTED |
| Gaps | Standalone v12 file — MISSING HISTORICAL SOURCE (R313). The BP extract cannot be checked against it. |
| Conflicts | SC-01 (resolved, R298) |
| Resolution | Use BP §58.2 as the SOURCE-PRESERVED-per-BP text |
| Status | SPECIFIED; BLOCKED behind Phase 30 |

### A.7 — Phase 29 Live Intelligence

| Field | Content |
|---|---|
| Scope | "Real-Time Intelligence Fabric + Live Coverage + Source Synchronization + Broadcast Intelligence" (BP §58.3) |
| Existing evidence | First-light tier; live edge; freshness; `source_health_daily`; quarantine plus daily recheck (`/api/cron/sources`); SSE; broadcast-monitor gateway (RT; G48) |
| Requirements | Freshness classes; ingestion pipeline; synchronization; late / out-of-order data; failure behaviour; broadcast intelligence; adaptive acquisition; evaluation (BP §8; §29.99–§29.105) |
| Decisions | R300 / R304 / R309: Phase 29 = Live Intelligence |
| Contracts | 29.99 contracts, 29.100 events (verbatim) |
| Dependencies | 30.27.3, 30.27.5, K, O |
| Alternatives | — |
| Rejected alternatives | Fake realtime (BP §52) |
| Security | 29.103 security gate |
| Licensing | Per source (catalogue licence gate) |
| Failure modes | 29.102 failure tests |
| Fallback | Per 29.x; repository: cache, quarantine, independent-origin redundancy |
| Tests | 29.101–29.105 |
| Acceptance criteria | 29.105 (verbatim) |
| Implementation requirements | 30.27.3 and 30.27.5 closed |
| Current repository status | NOT IMPLEMENTED against 29.x; strong precursors |
| Gaps | Standalone v13 file MISSING HISTORICAL SOURCE (R313); CONF-S03 (`cached` / `empty` vs the target health set) |
| Conflicts | SC-08 → resolved (R304, R309) |
| Resolution | BP §58.3 is the text |
| Status | SPECIFIED; BLOCKED behind Phase 30 |

### A.8 — Stage I (historical reconstruction / temporal evidence)

| Field | Content |
|---|---|
| Scope | Known only by name and position: between H and J in the owner's sequence (R302). SUP §10: "historical reconstruction / temporal evidence". |
| Existing evidence | None in any supplied text beyond the name |
| Requirements / Decisions / Contracts | **MISSING HISTORICAL SOURCE** |
| **CURRENT RECONSTRUCTION PROPOSAL** (not history) | The scope that the surrounding *specified* text already requires is: PIT queries with no future leakage (BP §14.4, §9.5, S invariant 9); supersession that preserves historical evidence (BP §19); evidence removal → uncertainty and coverage change, not invented certainty (§70.18.18 test 17); temporal relations and precision (BP §23.1–§23.2). **CRP-I:** define I as the contract that binds these existing clauses into one *historical reconstruction query* — the "as-known-at" view of any canonical object or evidence set — without adding requirements beyond them. **Status: CRP — needs owner approval. Not a historical decision.** |
| Dependencies | 30.26 (time axes), 30.27.5 (PIT), M (temporal) |
| Alternatives | (a) CRP-I; (b) merge I into M (temporal) and record I as unused; (c) leave I MISSING |
| Rejected alternatives | — (none decided) |
| Security / Licensing | A historical view must respect the licence at the time *and* now — **DECISION REQUIRED** |
| Failure modes / Fallback / Tests | §70.18.18 test 17; S invariant 9 |
| Acceptance criteria | Not specified |
| Implementation requirements | Owner decision on (a)/(b)/(c) |
| Current repository status | NONE |
| Gaps | The entire text |
| Conflicts | SC-04 (B, C, I, J absent from the BP sequence) |
| Resolution | **DECISION REQUIRED** |
| Status | MISSING HISTORICAL SOURCE + CRP |

### A.9 — A–P (one row per stage)

| Stage | Text and class | Key requirements (BP) | Repository | Gaps / conflicts | Status |
|---|---|---|---|---|---|
| A Agent Schema & Capability Binding | M0 §70.8 (SP) + BP §16 (RC) | `AgentDefinition` (33 fields); capability ceiling; tool side-effect ceiling; agent output = candidate | MCP server (6 tools), AI analyst (G15, MIXED) | Detailed original | SPEC IN PROGRESS |
| B Agent Runtime / Execution Boundary | SUP §10 concepts (RC) | — | — | **Text MISSING; concepts only** (SC-04) | RECONSTRUCTED concepts |
| C Tool Contract / Invocation | SUP §10 + BP §18 gate (RC) | Invocation gate | MCP tool schemas | SC-04 | RECONSTRUCTED concepts |
| D Handoff / Context Transfer | SP summary + BP §17 | `HandoffContract`; delegation ceilings; external content untrusted | None | — | SPEC IN PROGRESS |
| E Security / Credential / Sandbox | SP + BP §18 | Five identity layers; credential broker; tool-execution gate (15 steps) | Session cookies, RLS, licence gate, guardrail, CSP (G42) | SPIFFE "strong candidate" — undecided | SPEC IN PROGRESS |
| F Tool Result / Artifact | merged F/G (BP §19); SUP split | Structural / integrity / provenance / policy validation | Engine `Evidence`; fetch-guard | **F/G split not consolidated** (R302 W1) | SPEC IN PROGRESS |
| G Evidence Verification / Truth | BP §19 | L0–L7 gates; independence first-class; corroboration ≠ agreement | `gradeConfidence` by origins (RT); 180 independence groups | PI-01 / CONF-V01 ladders | SPEC IN PROGRESS |
| H Promotion | SP + BP §20 | No direct canonical mutation; 13 promotion prerequisites | None (no canonical layer) | D3 | SPEC IN PROGRESS |
| I | — | — | — | A.8 | MISSING + CRP |
| J Source independence graph | SUP §10 concepts | — | `lib/engine/catalog/origins.ts` (RT) | SC-04 | RECONSTRUCTED concepts |
| K Canonical Event Semantics | SP + BP §21 | 13 separated kinds; Lambda event + CloudEvents + AsyncAPI | World events, syndication dedup (RT) | — | SPEC IN PROGRESS |
| L Event → … → Inference | SP + BP §22 | 11-step pipeline; inference levels I0–I8 | Radar findings, nexus | D6 (forecast chain vs L) | SPEC IN PROGRESS |
| M Temporal + Causal | SP + BP §23 | 8 time fields; 10 relations; causal model; counterfactual | Time fields on evidence | SC-03 (pointer) | SPEC IN PROGRESS (history) |
| N Trigger Orchestration | SP + BP §24 | — | Cron jobs (`lib/ops/schedule.ts`) | — | SPEC IN PROGRESS |
| O Monitoring / Watch / Alert | SP + BP §25 | — | Monitors, alerts tables and routes | — | SPEC IN PROGRESS |
| P Inbox / Attention / Decision | SP + BP §26 | — | None | — | SPEC IN PROGRESS |

SP = SOURCE-PRESERVED summary (M0 §70.8 / BP §58.5). RC = RECONSTRUCTED / CONSOLIDATED (as labelled by BP).

**For every row:** requirements as in the cited BP section; security per E; licensing per the R and E chain; tests per §70.18.18; acceptance per §70.18.14; implementation requires S. Detailed originals: MISSING HISTORICAL SOURCE (R313).

### A.10 — 30.27.8 Q, R, S and R_FINAL

| Field | Content |
|---|---|
| Scope | Q workspace / multi-view; R artifact / export / publication / share; S cross-contract closure gate |
| Existing evidence | Q: preferences, URL state. R: `/api/export`, `/api/export/share`, `publish` job (**paused**, R294). S: none. |
| Requirements | Q §69.4; R §69.9; S §29, §69.12–§69.47, §70.18: closure matrix, dependency graph, blast radius, five gates, 20 acceptance tests |
| Decisions | Production paused until R closes (owner decision 4; CLAUDE.md §9); resumption = S (R302) |
| Contracts | BP §27–§29; §58.5; §70.18 |
| Dependencies | S depends on **all** of 1–9 above |
| Alternatives / Rejected | — |
| Security / Licensing | R: publication must not strengthen truth status; licences travel |
| Failure modes | Closure UNKNOWN treated as PASS (§70.18.18 test 20) |
| Fallback | PARTIAL closure only with an explicit degradation policy (§70.18.12) |
| Tests | §70.18.18 (20 tests) |
| Acceptance criteria | §70.18.14 A–H |
| Implementation requirements | §29.4: S is BLOCKED until source contracts are supplied or consolidated and conflicts decided |
| Current repository status | NOT IMPLEMENTED |
| Gaps | **R_FINAL (`…Blueprint_2026-09-25_R_FINAL.md`) — MISSING HISTORICAL SOURCE (R313).** The BP §58.5 Q/R/S text is the latest available R material. |
| Conflicts | GAP-S3 (§70.18 not folded into §29) |
| Resolution | Treat §29 + §70.18 together as the S text (both SOURCE-PRESERVED per BP; §70.18 is "additive") |
| Status | S: SPECIFICATION IN PROGRESS; BLOCKED |

---

## B. Conflict Matrix

**Status values:**
- OPEN — no decision.
- DECISION REQUIRED — options are ready.
- RESOLVED — by an owner decision, cited.
- FIXED — repository, with evidence.

| ID | Conflict | Evidence | Impact | Status / resolution |
|---|---|---|---|---|
| SC-01 | Phase 28 identity (SUP §2 "Geopolitical" vs BP "Technology") | SPEC_SOURCE_INVENTORY §2.1 | Phase identity | **RESOLVED** R298 / R304 |
| SC-02 | 30.27.2–5 status wording across BP / SUP / owner | §2.4–2.7 there | Readiness claims | **RESOLVED (working rule):** the strictest wording — SPECIFICATION IN PROGRESS where the owner said so |
| SC-03 | M as "continuation target" vs S | CONTINUITY_M_S | Resumption point | **RESOLVED** R302: resumption = S; M is history |
| SC-04 | B, C, I, J absent from the BP sequence | BP §0.0, §6 vs R302 | Closure matrix completeness | **OPEN:** places decided (R302); texts B, C, J RECONSTRUCTED concepts; I MISSING (A.8) |
| SC-08 | Phase 29 identity | R300 / R304 / R309 | Phase identity | **RESOLVED** (Live Intelligence) |
| SC-09 / D2 | 30.26 object set: BP 18 vs owner + 13 | BP §9, §30; R298 | Canonical model scope | **DECISION REQUIRED** — options in `S_DECISION_DOSSIER` D2 (not a source) |
| CONF-S01 / D3 | Evolve 24 tables vs an additive canonical layer | G01; R296, R298-14 | Every data contract | **DECISION REQUIRED** |
| PI-01 / CONF-V01 / D4 | Ladder A (0–6) vs L0–L7 vs TruthStatus vs Admiralty vs repository grade | W2 | Verification crosswalk | **OPEN** — R302: preserve and map, no conversion |
| D5 | F/G split | R302 W1 | Stage text | **OPEN** — consolidation work |
| D6 | Forecast chain vs L pipeline | R302 W4; BP §22 | Pipeline order | **OPEN** |
| D7 | Phase 29 coverage mapping (19 pairs) | RECORD_PHASE_SEQUENCE_R304 §3 | Coverage | **DECISION REQUIRED** |
| CONF-S03 / D8 | `cached` / `empty` vs the target health set | RT; BP §31 | Live health semantics | **DECISION REQUIRED** |
| GAP-S1 | Originals of 30.26, 30.27.2–5 | R313 | Text class | **RESOLVED as MISSING HISTORICAL SOURCE** (R313); the working text needs an owner decision (D1) |
| GAP-S2 | Detailed A–P originals | R313 | Text class | **RESOLVED as MISSING HISTORICAL SOURCE** |
| GAP-S3 | §70.18 not folded into §29 | BP | S text | **RESOLVED (reading rule):** both together, §70.18 additive per its own text |
| GAP-S4 | B, C, I, J never named in BP | SC-04 | — | see SC-04 |
| **NEW-01** | **BP §58.6 says the texts are "not lost … confirmed in the Project/Library". R313: the owner does not have them as files.** | BP §58.6; R313 | Recovery path | **RESOLVED by the later owner statement (R313).** BP §58.6 is superseded as to availability and kept as history (CLAUDE.md §7). |
| **NEW-02** | **BP §0.0 / §0(8) / §52: "Claude is code-only … must not own research, source selection, contradiction resolution, gap resolution". R312: research, verification and correction are authorised; architecture invention is not.** | BP; R312 | Working method | **RESOLVED for execution by the later owner decision (R312)**, under the governance split R301-2 (CLAUDE.md governs execution). BP §52's *prohibitions* (invent architecture / fields / schemas; fake data; bypass authorization; claim statuses without evidence) remain in force and are compatible with R312. **Owner may wish to update BP §0(8) in the Master.** |
| **NEW-03** | **Coded sources have no licence gate.** The catalogue licence registry covered catalogue records only. The coded `opensky` source called a licence-refused API. | Batch 05 M5-05 | S invariant 4 | **FIXED** for OpenSky (batch 05). The structural check is the first executable unit (F). A licence registry for coded sources is a **GAP**. |
| **NEW-04** | BP §58.7 lists Next.js 15.5.25 | `package.json` now `^15.5.27` (batch 02) | Fact staleness | **FIXED in repository**; BP fact stale — informational |
| **NEW-05** | The engine ignores provider `Retry-After` and has no retry budget; BP §15 requires both | RATE_LIMITS §3 | S invariant 13, §15 | **DECISION REQUIRED** (recommended: honour `Retry-After` as the earliest next call) |
| **NEW-06** | Publication carries **no** truth status (posts and broadcasts have no confidence field), while R requires epistemic status to travel and not strengthen | `lib/social/*` (RP) | S invariant 11 | **GAP** — the publish job is paused (R294), so there is no live impact |
| **NEW-07** | `nasa_donki` comment claimed 30 / h and 50 / day; NASA returned limit 10, Retry-After ~5 h | Batch 05 M5-03 | Stale assumption | **FIXED** (comment) |
| **NEW-08** | Open-Meteo free API is non-commercial, but was recorded as CC BY | Batch 05 M5-04 | Licence | **FIXED** |
| **NEW-09** | TED v3 is POST-only; the catalogue adapter is GET-only | Batch 04 NI-04-3 | One source | **DECISION REQUIRED** |
| **NEW-10** | ReliefWeb appname approval; NASA key | Batches 04 and 05 | Two sources | **OWNER ACTION** (deployment environment, not Git) |
| C2-R308 | Phase 29 label in R308 | R309 | — | **RESOLVED** |

---

## C. Existing-System Inventory

**Classification:**
- EXISTING — present.
- KEEP — keep as is.
- MIGRATE — map to a target contract.
- REPLACE / DEPRECATE — only with an explicit decision (none taken).
- REQUIRED — target needs it and it is absent.
- UNKNOWN — not verifiable.

| Item | Evidence | Class | Target relation |
|---|---|---|---|
| **Pi Network** | `contexts/pi-auth-context.tsx`; `lib/auth/pi.ts`, `pi-client.ts`, `pi-identity.ts`, `pi-probe.ts`; `app/api/auth/pi` and `/claim`; `lib/payments/pi.ts`; `app/api/payments`; `public/validation-key.txt` (Pi domain verification); `lib/auth/environment.ts` (runtime choice of Pi vs standalone sign-in in **one** build) | **EXISTING / KEEP** | Lambda NX's identity provider, payment provider and Pi Browser distribution channel (CLAUDE.md §10; BP §2.4). **Not World Pi.** Behind `lib/auth` and `lib/payments` (portability rule 4). |
| Standalone auth / payments | `lib/auth/standalone*.ts`, `password.ts`, `code-flow.ts`; `lib/payments/stripe.ts`, `checkout.ts` | EXISTING / KEEP | The same interfaces; CONF-X03 registration in the factory still OPEN (MR-13) |
| Next.js 15.5.27 / React 19 | `package.json` | EXISTING / KEEP | Existing implementation constraint (R298), not architecture |
| Netlify (`lambdanx`) | `netlify.toml`, `netlify/functions/scheduled-jobs.mts` | EXISTING / KEEP | **Production LOCKED on `9c19303`** (R306) |
| Vercel config | `vercel.json` (publish cron removed, R294) | EXISTING / KEEP (alternative host) | Portability |
| Supabase (Postgres 17.6) | project `roykbyzkskhmzclzobmd`; reached only via `lib/db` | EXISTING / KEEP | Portability; Production `DATABASE_URL` failing and left unrepaired (R306) |
| Drizzle + postgres-js | `db/schema.ts`, `drizzle.config.ts` | EXISTING / KEEP | — |
| Schema | 24 tables, RLS 24/24 (deny-all), `lambda_orphaned."L"` quarantined | EXISTING / **MIGRATE** (per D3) | 0 envelope fields (G01) |
| Migrations | 24 in `db/migrations` | EXISTING / KEEP | The future migration contract per table (BP §53) |
| API routes | 84 `route.ts` under `app/api` | EXISTING / **MIGRATE** | BP §10.2: no table semantics as public contract; Problem Details, version and idempotency all **REQUIRED** |
| Middleware | `middleware.ts`: caller limit + `no-store` on all `/api` | EXISTING / KEEP | Limits now in `config/rate-limits.json` (batch 05) |
| Source registry | 247 catalogue records (`lib/engine/catalog`), 117 coded sources (`lib/engine/sources`), licence registry, quarantine (39), daily recheck, 180 independence groups | EXISTING / **MIGRATE** | BP §31 Source Control Plane; licence for coded sources **REQUIRED** (NEW-03) |
| Ingestion | Sweeps via `/api/world`, `/api/cron/[job]`, host budget, fetch-guard | EXISTING / MIGRATE | Phase 29 pipeline; retry contract REQUIRED (NEW-05) |
| UI | 9 pages, tab shell, shadcn/ui | EXISTING / KEEP (design preservation) | 30.27.2 / Q are REQUIRED |
| Connectors (AI) | `lib/ai` (Anthropic SDK 0.115.0), MCP server `app/api/mcp` (6 tools) | EXISTING / MIGRATE | A / C / E gates are REQUIRED |
| Mail / social | `lib/mail` (Brevo / Postmark / Resend / SMTP), `lib/social` | EXISTING / KEEP | `publish` **paused** (R294) |
| Queue / storage | `lib/queue` (memory), `lib/storage` (database / filesystem) | EXISTING | Durable job API (BP §10.4) REQUIRED |
| `CLAUDE.md` | Updated R312 | EXISTING / KEEP | Governs execution |
| Environment variables | Names only (`.env.example`): `ADMIN_SECRET`, `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `AUTH_PROVIDER`, `BREVO_API_KEY`, `CRON_SECRET`, `DATABASE_URL`, `MAIL_FROM`, `MAIL_PROVIDER`, `NEXT_PUBLIC_AUTH_MODE`, `PAYMENT_PROVIDER`, `PI_API_KEY`, `POSTMARK_TOKEN`, `QUEUE_PROVIDER`, `RESEND_API_KEY`, `SESSION_SECRET`, `SMTP_URL`, `SOCIAL_SECRET_KEY`, `STORAGE_PROVIDER`, `STRIPE_SECRET_KEY`. Plus optional source keys (`NASA_API_KEY`, `RELIEFWEB_APPNAME`, `OPENAQ_API_KEY`, `EIA_API_KEY`, `ENTSO_E_TOKEN`, `COMPANIES_HOUSE_API_KEY`, `EPO_OPS_KEY`, `ENGINE_CONTACT`). | EXISTING / KEEP | Values live only in the deployment (S2); **never in Git**. Secrets scan of tracked files: 0 (R310). |
| Tests | 203 unit / integration files (2,799 passing); 4 browser suites (13 / 13) | EXISTING / KEEP | Repository evidence only — not Master TESTED |
| Deployment config | `netlify.toml`, `vercel.json`, `lib/ops/schedule.ts` (`publish` in `UNSCHEDULED`) | EXISTING / KEEP | Production deploy paused |

**Nothing is classified REPLACE or DEPRECATE.** No explicit migration or replacement decision exists (R298).

---

## D. Phase 30 Closure Matrix

S closure checks (BP §29.2) against the evidence above.

**Columns:**
- **Spec** — is a specified text available?
- **Decided** — are its conflicts settled?
- **Repo** — Existing-System state.
- **Closure** — Gate 1–4 state, per §70.18.13.

| Closure check | Spec | Decided | Repo | Closure |
|---|---|---|---|---|
| API contracts | BP §10 (SPECIFIED) | Version placement open (A.4) | 84 routes, none conformant | **BLOCKED** |
| Event contracts | BP §10.5, §21; v9 §253–§258 | — | World events (precursor) | **BLOCKED** (depends on 30.26) |
| Job / workflow contracts | BP §10.4; v9 §252 | — | Cron jobs, memory queue | **BLOCKED** |
| UIAction | BP §11 (RC) | IN PROGRESS (R298) | — | **BLOCKED** |
| Analytical Context | BP §11.3 | IN PROGRESS | — | **BLOCKED** |
| Streaming / replay | BP §12 | — | SSE | **BLOCKED** |
| Versioning | BP §13 | Placement / sunset open | — | **BLOCKED** |
| Idempotency | BP §14 | — | — | **BLOCKED** |
| Error / retry | BP §15 — **SPECIFICATION IN PROGRESS** | NEW-05 | No retry | **BLOCKED** |
| Agent / tool | BP §16–§18 IN PROGRESS; B, C concepts only | SC-04 | MCP, AI analyst | **BLOCKED** |
| Evidence / provenance | BP §19–§20 | D4, D5 | Evidence, origins (RT) | **BLOCKED** |
| Temporal / causal | BP §23; I MISSING | A.8 | Time fields | **BLOCKED** |
| Monitoring | BP §25 | — | Monitors / alerts | **BLOCKED** |
| Attention / decision | BP §26 | — | — | **BLOCKED** |
| Artifact / publication / share | BP §28, §69.9 | NEW-06 | Export, paused publish | **BLOCKED** |
| Security / policy / licence | BP §18, §46 | NEW-03 (coded-source licence) | Guardrail, RLS, licence registry (RT) | **BLOCKED** |

**Result:** 16 of 16 closure checks are BLOCKED. That is not 16 independent failures. Most trace to four roots:
1. **D3** (canonical layer).
2. **D2** (object set).
3. The missing originals plus D1 (which text is the working contract).
4. The "IN PROGRESS" specifications: 30.27.2, 30.27.4, 30.27.6, A–P.

---

## E. S-Gate Decision

| # | Criterion (owner R312) | Met? | Evidence |
|---|---|---|---|
| 1 | Data contracts complete enough for implementation | **No** | A.1: D2, D3 open; owner to rebuild 30.26 (R308) |
| 2 | Interface contracts complete enough | **No** | A.2–A.5: three IN PROGRESS; version placement open |
| 3 | Cross-contract dependencies resolved | **No** | D: dependency roots unresolved |
| 4 | Contradictions explicitly resolved | **No** | B: 9 OPEN or DECISION REQUIRED |
| 5 | Repository reality mapped | **Yes** | C; INVENTORY_AND_GAPS (48 rows); CURRENT_SYSTEM_AUDIT |
| 6 | Missing implementation-critical decisions identified | **Yes** | B (DECISION REQUIRED rows); A.8 CRP-I |
| 7 | Tests and acceptance criteria exist | **Partly** | BP §70.18.18 (20 tests) and §70.18.14 (draft gate) exist as specification; no executable closure tests |
| 8 | Security / licensing / provenance / failure semantics covered | **Partly** | Specified in BP §15, §18–§20, §46. §15 IN PROGRESS; coded-source licence GAP (NEW-03) |
| 9 | No required field / API / event behaviour ambiguous | **No** | Version placement, idempotency retention, error-to-HTTP mapping, F/G split |
| 10 | Resulting Build Package internally consistent | **No** | NEW-01, NEW-02 (BP vs later owner decisions); SC-04 (sequence) |

**DECISION: S is NOT CLOSED.**
- Phase 30 = NOT COMPLETE.
- Phase 31 = BLOCKED.
- No Master subsystem may be implemented (BP §29.4, §55; R313: no broad execution).

**What would move S:**
1. Owner decisions D1, D2, D3 (the three roots).
2. The owner's final 30.26 (R308).
3. A decision on Stage I (A.8: CRP-I, merge into M, or leave MISSING).
4. Decisions NEW-05 and NEW-09.
5. Closing the SPECIFICATION IN PROGRESS items 30.27.2, 30.27.4 and 30.27.6 in the Master.

---

## F. Build Package — first executable unit

S is not closed, so **no Master subsystem is executable**. The first unit therefore stays inside what is already closed: the **S cross-contract invariants (BP §29.3)**. They are SOURCE-PRESERVED per BP, have no open decision against them, and several can be checked against the Existing System **today** without inventing a field, schema or architecture. The unit adds verification, not capability. It is an S closure output ("Test Matrix", BP §29.4) for the Existing System.

| # | Field (BP §53) | Content |
|---|---|---|
| 0 | Task ID | **S-INV-EX-01 — Existing-System conformance tests for the S cross-contract invariants** |
| 1 | Objective | Turn the S invariants that already have a repository precursor into executable checks. Record the rest honestly as NOT APPLICABLE (no such subsystem) or GAP. |
| 2 | Existing repository facts | C above. The licence registry covers catalogue records only. Client components import server modules only as `import type`. The refusal-is-not-empty rule is tested (`lib/engine/no-laundered-refusals.test.ts`, enforcing `lib/engine/fetch-guard.ts`). |
| 3 | Target contract | BP §29.3 invariants 1–15 (verbatim in BP). This unit checks **3, 4, 10, 15** against the Existing System. |
| 4 | Canonical objects | None created |
| 5 | Schema changes | **None** |
| 6 | API changes | **None** |
| 7 | Event changes | None |
| 8 | Job / workflow changes | None |
| 9 | UIAction / context changes | None |
| 10 | Storage / migrations | None |
| 11 | Sources / connectors | None changed. The check reads the catalogue licence registry and every exported gateway source list. |
| 12 | Security / policy / licence | INV-3: a client component (`'use client'`) must not take a **value** import from a server-only module (`@/lib/db`, `@/lib/auth/server`, `@/lib/auth/session`, `@/lib/payments`, `postgres`, `drizzle-orm`), and must not read a non-`NEXT_PUBLIC_` environment variable. INV-4: no source in any gateway list may call a host whose catalogue licence the gate refuses. |
| 13 | Provenance | n/a |
| 14 | Observability | Test names cite the invariant number |
| 15 | Failure / retry / degradation | n/a |
| 16 | Fallback | n/a |
| 17 | Tests | `lib/conformance/s-invariants.test.ts`: INV-3 (static scan of client files); INV-4 (licence-host cross-check, including a negative control showing the check would have caught the pre-batch-05 OpenSky state); INV-10 and INV-15 mapped to their existing tests |
| 18 | Evaluation | n/a (deterministic) |
| 19 | Failure tests | INV-4 negative control: a synthetic gateway list containing the OpenSky adapter must fail the check |
| 20 | Acceptance criteria | All new tests pass; full suite green; `tsc` 0; the invariant matrix (below) is updated |
| 21 | Migration / rollback | Delete the test file — no runtime effect |
| 22 | Files allowed | `lib/conformance/*` (new), this document, the ledger |
| 23 | Files forbidden | Everything else |
| 24 | Dependencies | None |
| 25 | Status before | No executable S-invariant checks |
| 26 | Expected status after | INV-3, INV-4: **REPO-TESTED for the Existing System** — not Master TESTED / ACCEPTED |
| 27 | Verification evidence | Test output, commit |

### F.1 Invariant matrix (Existing System)

| Inv. | Text (BP §29.3) | Existing-System applicability | Check |
|---|---|---|---|
| 1 | Canonical ownership is unique | No canonical layer | NOT APPLICABLE (D3) |
| 2 | Derived projections never become canonical truth | No canonical layer | NOT APPLICABLE |
| 3 | UI never bypasses API / security boundaries | Client components vs server modules | **S-INV-EX-01** |
| 4 | Agent / tool never bypasses authorization / policy / licence | Gateway sources vs licence registry | **S-INV-EX-01** (+ NEW-03 gap) |
| 5 | Evidence verification precedes promotion | No promotion | NOT APPLICABLE |
| 6 | Event semantics distinct from observations and broker messages | — | NOT APPLICABLE |
| 7 | Replay causes no unintended external side effects | `publish` paused; no replay | NOT APPLICABLE (R294 pause test) |
| 8 | Version compatibility checked before consumer change | No contract versions | GAP |
| 9 | Historical queries point-in-time safe | No PIT queries | GAP |
| 10 | Monitoring degradation is visible | Source refusals reported as `failed` | existing `lib/engine/no-laundered-refusals.test.ts` (RT) |
| 11 | Publication cannot strengthen truth status | Publication carries no status | **GAP (NEW-06)** |
| 12 | Cross-view states cannot silently disagree | `world-consistency.browser.ts` checks map vs list counts | precursor (browser RT) |
| 13 | Failure / retry preserve idempotency and provenance | No retry | GAP (NEW-05) |
| 14 | Confidence is never treated as probability / truth | Grades are labels | NOT TESTED — no precise contract to test without inventing one |
| 15 | Missing data is never "no event" | Refusals throw; empty ≠ failure | existing `lib/engine/no-laundered-refusals.test.ts` (RT), which enforces `lib/engine/fetch-guard.ts` |

### F.2 Implementation report — S-INV-EX-01 (format: Execution Package §31)

| Item | Result |
|---|---|
| **IMPLEMENTED** | `lib/conformance/s-invariants.test.ts` — checks for invariants 3 and 4, a negative control for each, and the invariant 10 / 15 mapping |
| **TESTED** | 7 / 7. **Run against the commit before batch 05 (`9e5d63d`): 1 failed, with exactly `opensky → opensky-network.org: refused by opensky_states (commercial)`.** The check detects the defect it was written for. Full suite **2806 passed, 0 failed, 10 skipped**; `tsc` 0. |
| **NOT IMPLEMENTED** | Invariants 1, 2, 5, 6, 7 (not applicable); 8, 9, 11, 13 (gaps); 14 (no precise contract to test) — matrix §F.1 |
| **BLOCKED** | Every Master subsystem (§E: S NOT CLOSED) |
| **CHANGED** | Test code only. No runtime, schema, API or UI change in this unit. |
| **RESEARCHED** | Licence terms: Open-Meteo, OpenSky (official pages); provider limits (RATE_LIMITS §2) |
| **NEW DEPENDENCY** | None |
| **NEW ISSUE** | NEW-03 (no licence registry for coded sources); NEW-05 (retry / `Retry-After`); NEW-06 (publication carries no truth status) |
| **Status after** | Invariants 3 and 4: **REPO-TESTED for the Existing System.** Not Master TESTED, EVALUATED or ACCEPTED. Phase 30 NOT COMPLETE; Phase 31 BLOCKED. |
