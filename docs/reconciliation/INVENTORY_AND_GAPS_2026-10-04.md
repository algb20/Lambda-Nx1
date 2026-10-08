# Inventory, Mapping and Gap Register — 2026-10-04

| | |
|---|---|
| **Stage** | 30.27.8.RB — reconciliation (audit lane) |
| **Requested by** | Owner, 2026-10-04 (ledger R296) |
| **Task** | A. Inventory what the repository contains. B. Inventory what the documents contain. C. Extract the gaps. D. Invent nothing. E. Wait for complete specifications before implementing any affected part. |
| **Repository** | `claude/bittorent-network-app-c8j9pv` @ `e05050e` |
| **Documents** | Build Package `6a056334…` and Execution Package `4569844a…` (2026-10-04); original Master `6ffcdeda…` and rules file `e30fcd7c…` (2026-10-03) |
| **Code changed** | None |

**This is not a stop order.** Gaps do not halt Lambda NX. Each gap enters the owner's pipeline (rule 4):

```
GAP → RESEARCH REQUIRED → SPECIFICATION → CONTRACT → IMPLEMENTATION → TEST → ACCEPTANCE
```

Research, specification and preparation continue. Only *implementation of the affected part* waits for its complete specification.

---

## 0. Owner rules adopted (R296, 2026-10-04)

1. CLAUDE.md is the repository's execution rules. It cannot change the Master architecture or product decisions.
2. The Master is the highest architectural and functional reference. An incompletely specified part is not implemented. Every conflict is recorded as CONFLICT/GAP, not resolved by assumption.
3. Lambda NX exists and is developed **incrementally**.
   - No full rewrite is assumed.
   - Existing code is not assumed to conform to the Master.
   - Current System ↔ Target is mapped (§3).
4. Gaps do not stop research and preparation: each enters the pipeline above.
5. Missing texts are never invented. Before implementation they are reassembled from project documents: Phase 28, Phase 29, 30.26, 30.27.2, 30.27.3, 30.27.4, 30.27.5 and the detailed A–P.
6. Asking for those texts does not cancel earlier work. Every earlier decision stands unless a conflict is proven.
7. Conflicts follow CONFLICT → EVIDENCE → IMPACT → PROPOSED RESOLUTION → APPROVAL. A side is never chosen silently.
8. Previously researched stages keep their status (RESEARCHED / SPECIFICATION IN PROGRESS), never IMPLEMENTED.
9. Forecast stays, as an intelligence layer separate from Truth and the Canonical World State, with evidence, uncertainty, temporal/PIT controls and evaluation.
10. Keep separate:
    - Lambda NX core architecture;
    - Pi-specific integration and adapters;
    - the World Pi product, whose requirements never enter Lambda NX.
11. Now: inventory, gaps, no invention; receive complete specifications before implementing.
12. The ladder is SPECIFICATION → SCHEMA → API/CONTRACT → IMPLEMENTATION → INTEGRATION → TEST → EVALUATION → FAILURE TEST → ACCEPTANCE → COMPLETE. IMPLEMENTED and COMPLETE are used only with evidence.
13. Architecture is not changed because of a differing name, version or implementation detail until the official or project source proves it.

These rules match CLAUDE.md §0–§10 and the Execution Package. No earlier decision conflicts with them.

---

## A. Repository inventory (measured at `e05050e`, 2026-10-04)

### A.1 Size

| Measure | Value |
|---|---|
| Commits | 214 |
| Tracked files | 815 |
| TypeScript / TSX | 687 |
| Test files | 201 `*.test.ts` + 4 browser suites |
| API routes | 84 |
| Pages | 9 |
| Components | 87 |
| Tables | 24 |
| Migrations / journal entries | 24 / 24 |
| Documentation files in `docs/` | 27 |
| Last full run | 2770 tests passed, 10 skipped; `tsc` 0; `next build` OK at batch 01 (RT) |

### A.2 Stack (RP — `package.json`)

| Component | Version |
|---|---|
| Next.js | ^15.5.25 |
| React | ^19 |
| TypeScript | ^5 |
| Tailwind | ^4.1.9 |
| Drizzle / drizzle-kit | ^0.45.2 / ^0.31.10 |
| `postgres` | ^3.4.9 |
| Anthropic SDK | ^0.115.0 |
| Zod | 3.25.67 |
| Vitest | ^4.1.11 |
| `sharp` (override) | ^0.35.5 |

### A.3 Subsystems

Rows R01–R30 of `RECONCILED_MASTER_BASELINE.md` §2 remain accurate. Changes since that baseline:

| Row | Change since `8f9c713` | Evidence |
|---|---|---|
| R07 Confidence grading | Counts independent origins (`originOf`), not source keys | M-02 |
| R02 Catalogue reach | Per-unit reach (`ReachUnit`). Live publishers 2,721,500; records reported separately | M-03 |
| R15 Calibration | Description limited to the metrics actually computed | M-04 |
| R16 Publishing | `publish` job paused (`UNSCHEDULED`); route and manual run kept | R294 |
| R21 Authentication | Factory message documents concurrent Pi and standalone | M-06 |
| Hygiene | No literal NUL bytes; `sharp` floor test | M-01, M-07 |

### A.4 Pi / World Pi separation (owner rule 10)

| Layer | What it contains (RP) |
|---|---|
| Lambda NX core | `lib/engine`, `lib/analysis`, `lib/modules`, `lib/ai`, `lib/mcp`, `db/`, `app/api/*` except Pi routes |
| Pi-specific adapters | `lib/auth/pi.ts`, `pi-client.ts`, `pi-probe.ts`, `pi-identity.ts`; `lib/payments/pi.ts`; `app/api/auth/pi`, `app/api/auth/pi/claim`; `components/pi-sign-in.tsx`, `pi-username-link.tsx`; `contexts/pi-auth-context.tsx`; `public/validation-key.txt`, `public/piapp-link-verification.txt` |
| World Pi product | **Nothing.** The logos were removed (recoverable from `6cdd821`); no code references it. |

### A.5 Live systems

| System | Observation | Class |
|---|---|---|
| Supabase `roykbyzkskhmzclzobmd` | 24 tables in `public`, all RLS on; `"L"` quarantined | LO 2026-10-03 |
| Netlify `lambdanx` | Production from `main`; auto-publishing on — owner lock pending | LO 2026-10-03 |
| Last automatic post | 2026-08-27 | LO 2026-10-03 |

---

## B. Documentation inventory

### B.1 Documents supplied to Claude

| Document | Date | Role | Kept in repository? |
|---|---|---|---|
| Original Master Living Implementation Blueprint (`6ffcdeda…`, 5,516 lines) | layers to 2026-10-03 | Historical Master | No — owner's library |
| Research / Rules / Claude Operating Manual (`e30fcd7c…`, 1,239 lines) | 2026-09-19 + 2026-10-03 | Historical rules | No |
| **Build Package** (`6a056334…`, 13,354 lines) | 2026-10-04 | **Current reconciled Master target** + verbatim appendices | No (repository is public) — fingerprint in CLAUDE.md |
| **Execution Package** (`4569844a…`, 865 lines) | 2026-10-04 | **Owner's execution contract** | No — fingerprint in CLAUDE.md |

### B.2 Library documents named but not supplied as files

Build Package §58.6 names these. Their content is quoted in part inside the Build Package; the files themselves were not supplied.

- `Lambda_NX_Master_Living_Blueprint_v12_Phase_28_Technology_Intelligence.md`
- `Lambda_NX_Master_Living_Blueprint_v13_Phase_29_Live_Intelligence.md`
- `Lambda_NX_Master_Living_Implementation_Blueprint_2026-09-26_CONSOLIDATED.md`
- `Lambda_NX_Master_Living_Blueprint_v9_Schema_API_Event_Formalization.md`
- `Lambda_NX_MASTER_PROJECT_HANDOFF.md`
- `Lambda_NX_RESEARCH_RULES_AND_CLAUDE_METHOD.md`

### B.3 Specification availability — the eight items in owner rule 5

**Legend:**
- **VERBATIM** — the original wording is in hand.
- **RECONSTRUCTED** — a reconciled rewrite, explicitly not byte-for-byte (Build §0 item 3).
- **SUMMARY** — short §70.8 form only.
- **SOURCE MATERIAL** — the verbatim v9 text the reconstruction was built from.

| Item | What Claude holds | Where | Availability | What reassembly still needs |
|---|---|---|---|---|
| **Phase 28** — Technology Intelligence | Verbatim extract, plus a reconciled summary | Build §58.2 (lines 3183–4046); §7 | **VERBATIM** | Nothing for the text. Its status is "SPECIFIED / AGREED — NOT IMPLEMENTED" (§58.2, 28.0). |
| **Phase 29** — Live Intelligence | Verbatim extract, plus a reconciled summary | Build §58.3 (from line 4047); §8 | **VERBATIM** | Nothing for the text. |
| **30.26** — Data Contracts | Reconstructed contract, plus the v9 contract-hardening source (§213–§237) | Build §9; §58.4 | **RECONSTRUCTED** + SOURCE MATERIAL | The **original 30.26 wording** — if it exists in the library — or owner approval of the reconstruction as authoritative (GAP-S1) |
| **30.27.2** — UIAction / Analytical Context | Reconstructed; Q §69.4 builds on it | Build §11; §58.5 | **RECONSTRUCTED** | Same (GAP-S1) |
| **30.27.3** — Streaming / Sync / Replay | Reconstructed; v9 §258 Replay as source | Build §12; §58.4 | **RECONSTRUCTED** + SOURCE MATERIAL | Same (GAP-S1) |
| **30.27.4** — Versioning / Compatibility | Reconstructed; v9 §241, §260 as source | Build §13; §58.4 | **RECONSTRUCTED** + SOURCE MATERIAL | Same (GAP-S1) |
| **30.27.5** — Idempotency / Concurrency / Pagination / PIT | Reconstructed; v9 §246, §250, §228 as source | Build §14; §58.4 | **RECONSTRUCTED** + SOURCE MATERIAL | Same (GAP-S1) |
| **Detailed A–P** | A, D, E, F/G, H, K, L, M, N, O, P as reconciled sections (12–80 lines each), plus §70.8 summaries | Build §16–§26; §58.5 | **RECONSTRUCTED** / SUMMARY. No verbatim detailed originals in either package. | The detailed originals, if they exist (GAP-S2). Letters B, C, I and J are still never named (CONF-P04). |
| Q, R, S | Verbatim full contracts, plus S deep-closure continuation §70.18 (closure matrix, blast radius, final gate) | Build §58.5 (§69.4, §69.9, §69.12–69.47, §70.18) | **VERBATIM** | §70.18 is not yet reflected in reconciled §29 (GAP-S3). |

---

## C. Mapping Current System ↔ Target, and gap register

### C.1 How to read the table

| Column | Meaning |
|---|---|
| **Target status** | Status as the Build Package states it. Never upgraded here. |
| **Current System** | Repository evidence class (§0.2 of the baseline). |
| **Fit** | **PRECURSOR** = related code that a contract could migrate from · **NON-CONFORMANT** = existing code contradicts an explicit target rule · **NONE** = no code |
| **Next stage** | The owner's pipeline stage the gap is at now |

### C.2 The table

| # | Target (Build §) | Target status | Current System (evidence) | Fit | Gap | Next stage | Waiting on |
|---|---|---|---|---|---|---|---|
| G01 | §9.1 Canonical envelope (17 fields) | SPECIFIED — RECONSTRUCTED | 24 application tables; 0 envelope fields (RP) | NON-CONFORMANT | Envelope absent; evolve the tables or add a canonical layer | CONTRACT | GAP-S1; the evolve-vs-alongside decision (CONF-S01) |
| G02 | §9.4 Provenance record | SPECIFIED — RECONSTRUCTED | Evidence has a source URL, retrieval time, Admiralty, content hash and archive URL (RP) | PRECURSOR | No `derived_from`, `transformation_chain` or model/version fields | CONTRACT | GAP-S1 |
| G03 | §9.5 / §14.4 / §23.1 Time semantics (6 axes) and PIT | SPECIFIED — RECONSTRUCTED / IN PROGRESS | Engine `publishedAt`, world `observedAt` / `at` in memory; **the evidence table drops publication time** (RP) | NON-CONFORMANT | Axes not persisted; no PIT queries | CONTRACT | GAP-S1; M (SPEC IN PROGRESS) |
| G04 | §9.2–9.3 Quality and uncertainty (multi-dimensional) | SPECIFIED — RECONSTRUCTED | Categorical confidence plus Admiralty (RP, RT) | PRECURSOR | No dimensional quality or uncertainty | CONTRACT | GAP-S1 |
| G05 | §10.2 REST contract; §10.1 OpenAPI 3.2.1 | SPECIFIED | 84 routes; `lib/api-catalog.ts`; `/docs/api` (RP) | PRECURSOR | No OpenAPI document; no per-route schema contract | CONTRACT | 30.27 base text is RECONSTRUCTED |
| G06 | §10.6 / §15 Problem Details error API | SPECIFIED / IN PROGRESS | `{ error }` in 56 of 84 routes; 0 `problem+json` (RP) | NON-CONFORMANT | Different error shape; breaking change | SPECIFICATION | 30.27.6 SPEC IN PROGRESS |
| G07 | §10.4 Job API (202 + job_id, 9 states) | SPECIFIED | Cron route, synchronous runs, in-memory queue (RP) | PRECURSOR | No durable jobs | CONTRACT | GAP-S1 |
| G08 | §10.5 / §21 Events (semantic + CloudEvents) | SPECIFIED / IN PROGRESS | SSE streams; no event bus (RP / NP) | NONE | Event fabric absent | SPECIFICATION | K SPEC IN PROGRESS |
| G09 | §11 UIAction + Analytical Context | SPECIFIED — RECONSTRUCTED | Preferences, URL view-state, density, panels (RP, RT) | PRECURSOR (view state only) | No UIAction contract; no AnalyticalContext | CONTRACT | GAP-S1; Q |
| G10 | §12 Streaming / resume / replay | SPECIFIED — RECONSTRUCTED | `/api/world/stream` SSE (RP) | PRECURSOR | No cursors, checkpoints or resync; degraded-state set differs | CONTRACT | GAP-S1 |
| G11 | §13 Versioning and Contract Change Ledger | SPECIFIED — RECONSTRUCTED | Migration journal; no contract versions (RP) | NONE | No contract registry or ledger | CONTRACT | GAP-S1; §49 |
| G12 | §14.1 Idempotency | SPECIFIED — RECONSTRUCTED | Publisher dedup; radar fingerprints (RP) | PRECURSOR | No idempotency keys on commands | CONTRACT | GAP-S1 |
| G13 | §14.2 ETag / If-Match | SPECIFIED — RECONSTRUCTED | NP | NONE | — | CONTRACT | GAP-S1 |
| G14 | §14.3 Opaque cursors | SPECIFIED — RECONSTRUCTED | NP | NONE | — | CONTRACT | GAP-S1 |
| G15 | §16–§18 Agent / handoff / security boundary | IN PROGRESS | No agent runtime. AI analyst is single-call; MCP has 6 tools (RP) | NONE / PRECURSOR (MCP) | Agent registry, credential broker, sandbox | SPECIFICATION | A, D, E; GAP-S2 |
| G16 | §19 Evidence boundary and ladder L0–L7 | IN PROGRESS | Admiralty, confidence by independent origins, 180 independence groups (RP, RT) | PRECURSOR | No gate pipeline; ladders unresolved | SPECIFICATION | F/G; **PI-01 / CONF-V01** |
| G17 | §20 Promotion boundary | IN PROGRESS | NP — no canonical layer | NONE | — | SPECIFICATION | H; G01 |
| G18 | §22 Event → Signal → Situation → Inference | IN PROGRESS | Significance ranking, timeline, correlation, stories (RP, RT) | PRECURSOR | No situation / hypothesis / inference objects | SPECIFICATION | L |
| G19 | §23 Temporal + causal reasoning | IN PROGRESS | Timeline half-window comparison; causal NP | PRECURSOR (temporal) / NONE (causal) | — | SPECIFICATION | M |
| G20 | §24 Trigger orchestration | IN PROGRESS | Cron schedule (6 jobs) (RP, RT) | PRECURSOR | Only one trigger type (schedule) | SPECIFICATION | N |
| G21 | §25 Monitoring / watch / alert | IN PROGRESS | `monitors`, `alerts`, HMAC delivery, radar-monitors job (RP, RT) | PRECURSOR | No NO_DATA / STALE states, hysteresis or alert lifecycle | SPECIFICATION | O |
| G22 | §26 Inbox / attention | IN PROGRESS | Alerts, standing brief; no inbox (RP / NP) | NONE | — | SPECIFICATION | P |
| G23 | §27 Workspace / multi-view sync | IN PROGRESS (Q verbatim) | URL view-state, shared dossier permalinks (RP) | PRECURSOR | No server-authoritative context | SPECIFICATION | Q; 30.27.2/.3/.5 (GAP-S1) |
| G24 | §28 Artifact / publication / share | IN PROGRESS (R verbatim) | Autopublish (paused), export/share, social broadcast (RP) | PRECURSOR / NON-CONFORMANT (AUTO only) | Modes, gates, idempotency, audit | SPECIFICATION | R — the production pause depends on it |
| G25 | §29 / §70.18 S closure gate | IN PROGRESS; **BLOCKED** (§29.4) | NP | NONE | Closure matrix and registry absent | SPECIFICATION | PI-01; GAP-S1/S2/S3 |
| G26 | §30 Canonical World Model and graph layers | SPECIFIED (target) | Entity graph, ontology nodes/edges (41/38 live), independence groups (RP, LO) | PRECURSOR | Typed canonical objects absent | CONTRACT | G01 |
| G27 | §31 Source Control Plane | SPECIFIED (target) | 247-record catalogue, licence gate, quarantine, `ok/cached/empty/failed` (RP, RT) | PRECURSOR / NON-CONFORMANT (health set) | 14 capabilities; registry fields; 7 health states | CONTRACT | CONF-S03 (`cached`/`empty` semantics) |
| G28 | §32 TruthStatus (11 values) | SPECIFIED (target) | NP — categorical confidence only | NONE | — | CONTRACT | PI-01 |
| G29 | §33 Geospatial / EO | SPECIFIED (target) | Natural Earth, projection; Sentinel/Landsat rows keyed and inactive; STAC NP | PRECURSOR (weak) | EO pipeline | RESEARCH REQUIRED → SPECIFICATION | Domain pack |
| G30 | §34 Maritime / aviation / infrastructure | SPECIFIED (target) | Buoys, chokepoint corridors, grid; "we carry no AIS"; OpenSky excluded by licence | PRECURSOR (weak) | AIS and aviation sources need licence decisions | RESEARCH REQUIRED | Source selection (research owner) |
| G31 | §35 Resources | SPECIFIED (target) | `resources` gateway (RP) | PRECURSOR (weak) | — | SPECIFICATION | Domain pack |
| G32 | §36 Financial / IPO | SPECIFIED (target) | finance, markets, crypto, filings, sanctions gateways (RP, RT) | PRECURSOR | IPO chain absent | SPECIFICATION | Domain pack |
| G33 | §37 Company & facility | SPECIFIED (target) | companies, ownership, filings, procurement (RP, RT) | PRECURSOR | Facility object absent | SPECIFICATION | Domain pack |
| G34 | §38 Supply chain | SPECIFIED (target) | Corridors; impact analysis (RP) | PRECURSOR (weak) | — | SPECIFICATION | Domain pack |
| G35 | §39 Information world | SPECIFIED (target) | news, GDELT, trending, broadcasts, syndication dedup (RP, RT) | PRECURSOR | Narrative and claim propagation absent | SPECIFICATION | — |
| G36 | §40 Discovery and research | SPECIFIED (target) | Radar, quarantine recheck, investigations (RP, RT) | PRECURSOR | Bounded research tasks absent | SPECIFICATION | — |
| G37 | §41 Forecast / scenario (owner rule 9) | SPECIFIED (target) | Calibration ledger of attributed forward-looking claims; third-party forecasts ingested; **no forecasting engine** (RP, RT) | PRECURSOR (evaluation side) | Forecast object, PIT cutoff, intervals, calibration metrics | SPECIFICATION | D-03 terminology |
| G38 | §42 Multimodal evidence | SPECIFIED (target) | Text and structured records; media gateway (RP) | PRECURSOR (weak) | Evidence anchors | SPECIFICATION | — |
| G39 | §43 AI Context Firewall | SPECIFIED (target) | `lib/ai` — no licence or policy check before model context (RP) | NON-CONFORMANT | Firewall absent; licence lacks AI-processing rights | CONTRACT | MR-06 |
| G40 | §44 Evaluation sets | SPECIFIED (target) | 201 test files; calibration; no golden/PIT/adversarial sets (RP, RT) | PRECURSOR | — | SPECIFICATION | — |
| G41 | §45 Resilience / recovery controller | SPECIFIED (target) | Health, diagnosis, quarantine, fallback (RP, RT) | PRECURSOR | Recovery controller absent | SPECIFICATION | — |
| G42 | §46 Security / legal | SPECIFIED (target) | Passive guardrail, licence gate, RLS 24/24, rate limits, CSP (RP, RT, LO) | PRECURSOR (strong) | Tenant, RBAC/ABAC and classification absent | SPECIFICATION | E |
| G43 | §47–§48 Visualization / workspace | SPECIFIED (target) | Globe, map, scrubber, constellation, board, dossier, places layer (RP, RT) | PRECURSOR | Primitives such as causal graph, diff view and inbox absent | SPECIFICATION | Q |
| G44 | §49 Contract Registry | SPECIFIED (target) | NP | NONE | — | CONTRACT | S |
| G45 | §50 Domain packs | SPECIFIED (target) | 33 gateways in 7 families (RP, RT) | PRECURSOR | Gateway → domain-pack mapping | RESEARCH REQUIRED | Research owner |
| G46 | §51 One-million target | Retained (owner) | 2,721,500 live publishers; 121,500 without GLEIF; 247 integrations; 180 origins (RT) | PRECURSOR | Breadth beyond one family | SPECIFICATION | `SOURCE_POPULATION_PLAN.md` decisions |
| G47 | §7 Phase 28 Technology Intelligence | SPECIFIED / AGREED — NOT IMPLEMENTED | research gateway (OpenAlex, Crossref, PubMed); tech radar docs (RP) | PRECURSOR (weak) | TechnologyObject; emergence; discontinuity | CONTRACT | Domain pack |
| G48 | §8 Phase 29 Live Intelligence | SPECIFIED | Live edge, freshness, source health, SSE, quarantine (RP, RT) | PRECURSOR | Freshness classes; late-data policy; reconciliation | CONTRACT | G10 |

**Totals (48 rows):** NONE 9 · PRECURSOR 32 · NON-CONFORMANT 6 (including the two marked "PRECURSOR / NON-CONFORMANT") · mixed NONE/PRECURSOR 1 (G15). **IMPLEMENTED against the target: 0.**

### C.3 Specification gaps — owner rule 5

| ID | Gap | Proposed resolution | Approval needed |
|---|---|---|---|
| **GAP-S1** | The original wording of 30.26 and 30.27.2–5 is not supplied. The Build Package provides reconstructions (RECONSTRUCTED/CONSOLIDATED) plus the v9 source material. | Either (a) the owner supplies the originals from the library, or (b) the owner approves the reconstructions as the authoritative contract text. | **Yes** — (a) or (b) |
| **GAP-S2** | Detailed originals for A–P are not supplied. Reconciled §16–§26 and §70.8 summaries exist. | Supply the originals if they exist; otherwise record that §16–§26 is the authoritative form. | **Yes** |
| **GAP-S3** | S deep-closure §70.18 (closure matrix, dependency graph, blast radius, final Phase 30 gate) sits in the appendix but is not reflected in reconciled §29. | Fold §70.18 into §29, or mark it superseded. | **Yes** (research owner) |
| **GAP-S4** | Letters B, C, I and J of 30.27.8 are never named (CONF-P04). | Record them as unused, merged or lost. | **Yes** |

---

## D. Open conflicts

Each conflict follows CONFLICT → EVIDENCE → IMPACT → PROPOSED RESOLUTION → APPROVAL.

| ID | Conflict | Evidence | Impact | Proposed resolution | Approval |
|---|---|---|---|---|---|
| PI-01 / CONF-V01 | Three verification scales; ladder A neither superseded nor mapped | Build §19, §32; §58.4 line 7348 | Blocks G16, G28 and S | Supersede ladder A by TruthStatus + ladder B, or map it (baseline §7.2) | Owner / research owner |
| CONF-S03 | `cached` and `empty` have no target health state | `quarantine.ts`; Build §31 | G27 | `cached` → a freshness attribute, not a health state; `empty` → never "no event" (Build §29.3 invariant 15). Proposal only. | Research owner |
| CONF-S01 | Evolve the 24 tables vs a canonical layer alongside them | Baseline §9.6 | G01, G17, G26 | Decision belongs to the Master | Owner / research owner |
| CONF-P04 | B, C, I, J never named | Build §6, §0.0 | Audit completeness | See GAP-S4 | Research owner |
| D-03 | Calibration claims called "forecasts" in UI, "assessments" in pricing | `PACKAGE_INTAKE_2026-10-04.md` PI-03 | G37 terminology | Decide whether attributed forward-looking claims are Forecast objects (Build §41) | Research owner |
| CONF-G07 | "No redesign" vs new target surfaces | Baseline §9.1 | G43 | Visual language preserved; new surfaces allowed | Owner |
| CONF-X02 | Pi absent from the original Master | Build §2.4 now records it | — | **RESOLVED** by Build §2.4 | — |

## E. What proceeds now, and what waits

| Proceeds (no implementation) | Waits |
|---|---|
| Owner decisions on GAP-S1–S4, PI-01, CONF-S01, CONF-S03, D-03 | Implementation of any G-row — each waits for its contract text to be approved and a §53 task sheet |
| Research-owner specification work on the RESEARCH REQUIRED / SPECIFICATION rows | Production publishing (R) |
| Maintenance batches the owner authorises (e.g. D-01 Next.js 15.5.27) | Phase 31 |
| Owner actions: Netlify deploy lock; source-population decisions | — |

---

## F. Update after the Recovery Supplement (ledger R297)

See `SUPPLEMENT_INTAKE_2026-10-04.md`.

| Item | Change |
|---|---|
| **B.3 Phase 28 / 29** | Unchanged: VERBATIM in the Build Package (Technology; Real-Time/Live). The Supplement's "Phase 28 — Geopolitical / Phase 29 — Technology" are Master **sections** §28/§29, not phases. **SC-01** awaits approval. |
| **B.3 30.27.2–5** | Status recorded at the more conservative value — **SPECIFICATION IN PROGRESS** — until GAP-S1 is decided (**SC-02**). 30.26 stays SPECIFIED (reconstructed). |
| **C.2 rows** affected by SC-02 — G09, G10, G11, G12, G13, G14 | "Next stage" moves from CONTRACT to **SPECIFICATION** |
| **GAP-S2** | The Supplement confirms that exact B, I, J, N, O and P texts are not in current files: **RECOVERY REQUIRED** |
| **GAP-S4** | Partly answered: B, C, I and J existed as stages (**SC-04**). The sequence needs amending by the research owner. |
| Resumption | Still **S** (owner decision 2). The Supplement's "M continuation target" is the superseded pointer (**SC-03**). |
