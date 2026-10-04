# GAP / CONFLICT List — Architecture Freeze (2026-10-04)

| | |
|---|---|
| **Instruction** | Owner, ledger R303: put execution into **Architecture Freeze**, not redesign. Produce a GAP/CONFLICT list only. No code, no Phase 31. Invent nothing. Do not replace earlier Lambda decisions without explicit approval. Wait for the Canonical Reconciliation document before editing CLAUDE.md or restructuring code. |
| **This document** | A list. It decides nothing. CLAUDE.md is **not** edited by this entry. |
| **Code changed** | None |

**Classes** (one or more per item):

| Class | Meaning |
|---|---|
| **SOURCE-AVAILABLE** | The specification text is in a file supplied to Claude. The note says whether it is verbatim, consolidated or reconstructed. |
| **SOURCE-MISSING** | No supplied file contains it. This means *not available to Claude* — not that it is absent from the project. The owner's library may hold it (R303). Recorded as SOURCE-MISSING / RESEARCH REQUIRED. |
| **CONFLICT** | Two sources or decisions say different things. |
| **NEEDS-RECONCILIATION** | Requires a formal reconciliation decision before use. |
| **IMPLEMENTATION-VERIFIED** | Code **and** tests prove the item against its own specification. |
| **IMPLEMENTATION-NOT-VERIFIED** | No such proof. Similar code is not proof. |

**Files supplied to Claude:**

| Code | File |
|---|---|
| U1 | Original Master Blueprint |
| U2 | Rules / Claude manual |
| U3 | Build Package 2026-10-04 |
| U4 | Execution Package |
| U5 | Recovery Supplement |
| U6 | Owner chat statements |

---

## 1. The continuity reference given in R303, checked against earlier decisions and sources

R303 states a *temporary continuity reference*:

| Phase | R303 says |
|---|---|
| Phase 28 | Technology Intelligence |
| Phase 29 | Companies & Facilities Intelligence |
| Phase 30 | Supply Chain Intelligence |
| 30.25 | Gap Audit |
| 30.26 | Data Contracts |
| 30.27 | Interface Contracts |

| # | Item | Classes | Evidence |
|---|---|---|---|
| **C1** | **Phase 28 = Technology Intelligence** | SOURCE-AVAILABLE (verbatim) · IMPLEMENTATION-NOT-VERIFIED | U3 §58.2 `# PHASE 28 — Technology Intelligence …` (line 3185, 28.0–28.45). The same in R298, R300 and R303. **No conflict.** |
| **C2** | **Phase 29 = Companies & Facilities Intelligence** (R303) | **CONFLICT** · NEEDS-RECONCILIATION · SOURCE-AVAILABLE (Live, verbatim) · SOURCE-MISSING (a C&F *phase* document) · IMPLEMENTATION-NOT-VERIFIED | **Earlier explicit owner decisions on 2026-10-04:** R300 — «اعتمد Phase 29 = Live Intelligence كما في النص الحرفي»; R301-1 — Companies & Facilities is a **Domain Pack, not a phase**. **Source:** U3 §58.3 `# PHASE 29 — Real-Time Intelligence Fabric + Live Coverage + Source Synchronization + Broadcast Intelligence` (line 4049, 110 subsections, from library file `…v13_Phase_29_Live_Intelligence.md`). Companies & Facilities appears in U3 as domain **section §37** ("Phase 29/30 company coverage must ultimately model …"), not as a phase heading. No supplied file has a document titled "Phase 29 — Companies & Facilities". **Not applied.** R303 itself forbids replacing earlier decisions without explicit approval, so R300 / R301-1 remain recorded until the owner states which holds. |
| **C3** | **Phase 30 = Supply Chain Intelligence** (R303) | **CONFLICT** · NEEDS-RECONCILIATION · SOURCE-MISSING (a Supply Chain *phase 30* document) · IMPLEMENTATION-NOT-VERIFIED | In every supplied source, **Phase 30** is the contract-hardening and closure phase: 30.25 → 30.26 → 30.27 → 30.27.8 … S; "Phase 30 = NOT COMPLETE; Phase 31 BLOCKED" (U3 §0.0, §55, §70.14; U1 §69.3, §70.16). The verbatim Phase 28 text says **"This connects Phase 25 supply-chain intelligence with Phase 28 technology intelligence"** (U3 line 3393). That places Supply Chain at **Phase 25**. Supply Chain also appears as U3 domain **section §38**. R303 also lists 30.25 / 30.26 / 30.27 under Phase 30's numbering, so "Phase 30 = Supply Chain" collides with its own sub-phases. **Not applied.** |
| **C4** | **30.25 Gap Audit** | SOURCE-MISSING (text) · IMPLEMENTATION-NOT-VERIFIED | Referenced only as a sequence step and a status: U2 line 613 "Gap Audit: completed/specification state"; U5 line 265 "recorded". **No supplied file contains the 30.25 text.** |
| **C5** | **30.26 Data Contracts** | SOURCE-AVAILABLE (RECONSTRUCTED/CONSOLIDATED) · SOURCE-MISSING (original) · CONFLICT (object list) · NEEDS-RECONCILIATION · IMPLEMENTATION-NOT-VERIFIED | U3 §9 ("not a claim of byte-for-byte recovery"); U5 §4; U6 R298 list; v9 source §213–§237 (U3 §58.4, verbatim extract). Object list differs between U3 and U6 (SC-09). Repository: 24 tables, 0 envelope fields (G01). |
| **C6** | **30.27 Interface Contracts** (base) | SOURCE-AVAILABLE (RECONSTRUCTED) · SOURCE-MISSING (original) · IMPLEMENTATION-NOT-VERIFIED | U3 §10; U5 §5. The original 30.27 base document is not supplied. |

---

## 2. The specifications listed under 30.27 in R303

R303 lists them "among" those prepared. The list is **not exhaustive**: N, O, P, Q, R and S, and the letters added in R302, remain recorded (§3).

| # | R303 item | Corresponding stage | Classes | Evidence |
|---|---|---|---|---|
| **I1** | Capability & Conformance | **Not identified** | **SOURCE-MISSING** · RESEARCH REQUIRED · IMPLEMENTATION-NOT-VERIFIED | The phrase appears in **no** supplied file (U1–U5). Its stage number (30.27.1?) is unknown and is **not assumed**. |
| **I2** | UIAction / Shared Analytical Context | 30.27.2 | SOURCE-AVAILABLE (RECONSTRUCTED) · SOURCE-MISSING (original) · CONFLICT (status, SC-02) · IMPLEMENTATION-NOT-VERIFIED | U3 §11; U5 §6; U6 R298. Repository precursor only: view-state (G09). |
| **I3** | Streaming / Incremental Sync / Resume / Replay | 30.27.3 | same as I2 | U3 §12; U5 §7; v9 §255–§258. Precursor: SSE (G10). |
| **I4** | API Versioning / Compatibility | 30.27.4 | same as I2 | U3 §13; U5 §8; v9 §241, §259–§260. Precursor: migration journal only (G11). |
| **I5** | Idempotency / Concurrency / Pagination / Point-in-Time | 30.27.5 | same as I2 | U3 §14; U5 §9; v9 §228, §246, §250. Precursors G12–G14. |
| **I6** | Error / Retry / Timeout / Failure Semantics | 30.27.6 | SOURCE-AVAILABLE (verbatim §70.8 summary, 49 lines, incl. ProblemDetails; U3 §15) · IMPLEMENTATION-NOT-VERIFIED | Repository: `{ error }` in 56 of 84 routes, 0 `problem+json` (G06, non-conformant). |
| **I7** | Agent / Tool / Workflow Contracts | 30.27.8 (umbrella) | SOURCE-AVAILABLE (summaries) · NEEDS-RECONCILIATION (letter sequence) · IMPLEMENTATION-NOT-VERIFIED | U1 / U3 §70.8 summaries; letter sequence per R302. No agent runtime in the repository (G15). |
| **I8** | Agent Schema & Capability Binding | A | SOURCE-AVAILABLE (verbatim summary + RECONSTRUCTED U3 §16) · SOURCE-MISSING (detailed original) · IMPLEMENTATION-NOT-VERIFIED | — |
| **I9** | Agent Handoff / Context Transfer | D | same as I8 (U3 §17) | — |
| **I10** | Security / Credential / Sandbox Boundary | E | same as I8 (U3 §18) | Repository: security controls exist, no credential broker or sandbox (G42) |
| **I11** | Tool Result / Artifact / Evidence Boundary | F | SOURCE-AVAILABLE (merged F/G only) · NEEDS-RECONCILIATION (F/G split, R302) · SOURCE-MISSING (separate F text) · IMPLEMENTATION-NOT-VERIFIED | U3 §19; U5 §10 F |
| **I12** | Evidence Verification / Corroboration / Independence / Truth Status | G | same as I11 · plus the verification taxonomy (§4) | U3 §19, §32; U5 §10 G |
| **I13** | Evidence → Canonical Object Promotion | H | same as I8 (U3 §20) | No canonical layer in the repository (G17) |
| **I14** | Canonical Event Semantics | K | same as I8 (U3 §21) | No event bus (G08) |
| **I15** | Event → Signal → Situation → Research → Inference | L | same as I8 (U3 §22) · NEEDS-RECONCILIATION (L chain vs the W4 forecast chain, R302 §5.1) | Precursors: significance, timeline, stories (G18) |
| **I16** | Temporal / Causal Reasoning | M | same as I8 (U3 §23) | Temporal precursor; causal reasoning absent (G19) |

**Status of every item in §1–§2:** RESEARCHED / SPECIFICATION IN PROGRESS, or SPECIFIED as each source states — **never IMPLEMENTED** (R303).

---

## 3. Stages not in R303's list but recorded earlier (kept, not removed)

| Stage | Classes | Evidence |
|---|---|---|
| B, C, J | SOURCE-MISSING (text) · SOURCE-AVAILABLE (concept index only, U5 §10) · IMPLEMENTATION-NOT-VERIFIED | Places in the sequence per R302 |
| I | SOURCE-MISSING ("RECOVERY REQUIRED", U5 §10) · IMPLEMENTATION-NOT-VERIFIED | — |
| N, O, P | SOURCE-AVAILABLE (verbatim summary + U3 §24–§26) · SOURCE-MISSING (detailed original) · IMPLEMENTATION-NOT-VERIFIED | Precursors G20–G22 |
| Q, R, S (+ §70.18) | SOURCE-AVAILABLE (verbatim, U3 §58.5) · IMPLEMENTATION-NOT-VERIFIED | S is the resumption point (R302); BLOCKED (U3 §29.4) |

---

## 4. Cross-cutting items in R303

| # | Item | Classes | Evidence / record |
|---|---|---|---|
| **X1** | **Existing System Reality vs Target Architecture** — Pi Network, Netlify, Supabase, Next.js, Drizzle are not, by being present, canonical architecture | NEEDS-RECONCILIATION (the canonical-architecture role of each) | Already recorded: R298 rule 10; R301-2; CLAUDE.md §0. Nothing in code or configuration was changed. |
| **X2** | **Pi Network integration vs World Pi separation** — separating from World Pi does not imply removing Pi Network | NEEDS-RECONCILIATION (an independent architectural decision on Pi's place in the target) | **No Pi integration was removed.** The only items removed were two World Pi *logo files* and their README (R293-5; recoverable from `6cdd821`). Pi auth, payments and adapters are untouched (`INVENTORY_AND_GAPS` §A.4). |
| **X3** | **Forecasting** — a removal from CLAUDE.md does not cancel the requirement | SOURCE-AVAILABLE (U1 §19–§20; U3 §41; Phase 29 extract) · IMPLEMENTATION-NOT-VERIFIED (no forecasting engine) · SOURCE-MISSING (four owner-cited forecasting requirements, R302 §5.1) | **CLAUDE.md no longer removes forecasting.** It was amended on 2026-10-03 (R293). Current §1: "Governed forecasting stays in the Intelligence Core … Forecast ≠ Scenario ≠ Truth ≠ Event". Forecast and Scenario are separate from Truth and Canonical World State (R302 W4). |
| **X4** | **Verification Taxonomy Reconciliation** — no mapping between any numeric ladder and L0–L7; Admiralty kept as a source-assessment framework, not equated with Lambda's evidence verification | NEEDS-RECONCILIATION · SOURCE-AVAILABLE (each ladder separately) · IMPLEMENTATION-VERIFIED **only for the repository's Admiralty / confidence fields as Existing System**, not for any Lambda ladder | Matches R302 W2: preserve first, reconcile in S, with the Verification-Level Crosswalk. Claude's earlier mapping proposal is **not adopted** (R302 §5.1). The repository stores Admiralty A–F / 1–6 and the confidence grade (RT). No L0–L7 gate exists in code. |
| **X5** | **Edits to CLAUDE.md before the Canonical Reconciliation document** | **CONFLICT** (timing) · NEEDS-RECONCILIATION | CLAUDE.md was edited under owner decisions R293, R296, R298, R301 and R302, all before R303. Its current §7 records "Phase 29 = Live Intelligence (R300)" and "Companies & Facilities is a Domain Pack (R301-1)", which conflict with C2. **Per R303, CLAUDE.md is not edited now.** Its R300 / R301-1 lines stay as written until the owner resolves C2 in the Canonical Reconciliation. |
| **X6** | **Files named by the owner but not supplied to Claude** | SOURCE-MISSING (to Claude) | `…Blueprint_2026-09-25_R_FINAL.md`; `…v12_Phase_28_…` (full file); `…v13_Phase_29_…` (full file); `…v9_Schema_API_Event_Formalization.md` (full file; the U3 extract ends abruptly at line 8782); `…2026-09-26_CONSOLIDATED.md`; `Lambda_NX_MASTER_PROJECT_HANDOFF.md`; `Lambda_NX_RESEARCH_RULES_AND_CLAUDE_METHOD.md` |
| **X7** | **Phase 31** | — | Not started. BLOCKED (U3 §55). |
| **X8** | **Production / publication pause** | — | In force. Production still on `9c19303` after the PR #74 merge (LO 2026-10-04). The `publish` job is paused (R294). |

---

## 5. Implementation verification — summary

| Scope | IMPLEMENTATION-VERIFIED | IMPLEMENTATION-NOT-VERIFIED |
|---|---|---|
| Master / Blueprint specifications (all items in §1–§4) | **0** | **All.** 48 mapping rows: 32 precursor, 6 non-conformant, 9 absent, 1 mixed (`INVENTORY_AND_GAPS_2026-10-04.md` §C) |
| Existing-System maintenance fixes (batch 01, M-01 … M-07) | Verified against **their own defect reports** (REPO-TESTED; `MAINTENANCE_BATCH_01.md`). They are **not** Master implementations. | — |

---

## 6. What this list asks the owner to settle in the Canonical Reconciliation

1. **C2:** Phase 29 = Live Intelligence (R300, verbatim source) **or** Companies & Facilities (R303)? If the latter, what becomes of the verbatim Live Intelligence phase?
2. **C3:** Phase 30 = the contract/closure phase (30.25 – 30.27 – S, all sources) **or** Supply Chain (R303)? The verbatim Phase 28 text places Supply Chain at Phase 25.
3. **I1:** where "Capability & Conformance" sits, and its text.
4. **C4, X6:** the 30.25 text and the six named library files.
5. **X2:** Pi Network's place in the target architecture — a separate decision.
6. **X4:** the Verification Taxonomy Reconciliation, to be held in S.

---

## 7. Resolution — owner decision R304

| Item | Status |
|---|---|
| **C2** — Phase 29 | **RESOLVED.** Phase 29 = Live Intelligence. The verbatim specification is retained and authoritative. Companies & Facilities is a Domain Pack, not a replacement. |
| **C3** — Phase 30 | **RESOLVED.** Phase 30 = Contract Hardening / Closure (30.25 → 30.26 → 30.27 → S). Supply Chain is domain coverage, not Phase 30. |
| **X5** — CLAUDE.md timing | **RESOLVED.** The Reconciliation Record `RECORD_PHASE_SEQUENCE_R304.md` was written first; CLAUDE.md §7 was updated after it. |

All other items in this list are unchanged. Nothing was marked IMPLEMENTED.

---

## 8. Owner statement R308 — documentation gaps first (2026-10-04)

**Owner direction:** close the documentation and reconciliation gap first; the Master reconciliation is **owner-led**. Claude's role after it is SPECIFICATION → CODE → TEST → REPORT. Claude does not do research, architecture, or guessed requirements. Anything not clearly documented stays MISSING / RESEARCH REQUIRED / DECISION REQUIRED / BLOCKED. "We have it in the conversation" is **not** a substitute for project files.

**Instructions in force:** no Phase 31 · Production not opened · no missing text invented · no change to Pi, Netlify, Supabase, Next.js or the system structure on Claude's own initiative. **Code changed by this entry:** none.

### 8.1 New conflict

| ID | Conflict | Evidence | Status |
|---|---|---|---|
| **C2-R308** | R308 states **"Phase 29 — Companies & Facilities Intelligence: SPECIFIED"** and asks for Phase 29 to link directly to Technology Intelligence. | **Earlier explicit owner decisions on the same day:** R300 «اعتمد Phase 29 = Live Intelligence كما في النص الحرفي»; R304 "Phase 29 = Live Intelligence … Companies & Facilities ≠ replacement for Phase 29 … no retroactive conversion". **Source:** Build Package §58.3, verbatim `# PHASE 29 — Real-Time Intelligence Fabric …`. CLAUDE.md §7 records R304. | **OPEN — not applied.** R308 itself forbids replacing an earlier decision without recording it, so R304 stays in force in every record (CLAUDE.md unchanged) until the owner states which holds. The owner's *content* point — Companies & Facilities is an Intelligence Domain linked to entities, facilities, technology, events, evidence, sources and changes, not a company table — **agrees** with R301-1 and R304 and is recorded under the C&F Domain Pack. |

### 8.2 Status of each item named in R308

| Item | Owner statement (R308) | Recorded class | Implementation |
|---|---|---|---|
| **30.26 Data Contracts** | Documented in part. At least: canonical object / event contracts; canonical envelope; schema / versioning; provenance; temporal / spatial semantics; evidence relationships; compatibility; data / event boundaries; canonical storage vs derived indexes, search, vector and cache; Data Contract Registry / Contract Registry concepts. **The owner will rebuild and document the final version before implementation.** | Scope: AGREED (owner-stated). Full text: **MISSING SOURCE** in final form. Final executable version: **BLOCKED — owner to author.** | NOT IMPLEMENTED; **implementation BLOCKED** |
| **30.27.2** UIAction + Shared Analytical Context | Semantic UIAction (not a raw click); AI/Agent never mutates UI or canonical truth directly; Client View / Analytical Context / Workspace / Execution states separated; context versioning; risk classes; accessibility | Decisions: AGREED (owner-stated). Final executable text: **pending the owner's consolidated version** | BLOCKED |
| **30.27.3** Streaming / Incremental Sync | SNAPSHOT / INCREMENTAL SYNC / LIVE STREAM / JOB PROGRESS / WEBHOOK; PAGE_CURSOR / CHANGE_CURSOR / RESUME_POSITION / PIT_CONTEXT; checkpoint / resume / replay; at-least-once; idempotent consumers; resync on cursor expiry; degraded states | as above | BLOCKED |
| **30.27.4** Versioning / Compatibility | The 8 version kinds; compatibility classes; lifecycle DRAFT → … → RETIRED; Contract Change Ledger; schema-compatible ≠ semantic-compatible | as above | BLOCKED |
| **30.27.5** Idempotency / Concurrency / Pagination / PIT | Idempotency contract; request fingerprint; ETag / If-Match; 409 / 412; opaque cursor; page / change / resume / PIT separation; PIT Context; no future leakage; historical pagination bound to PIT | as above | BLOCKED |
| **Phase 28** Technology Intelligence | SPECIFIED; not IMPLEMENTED. No complete standalone copy in the owner's current context. | **SPECIFIED.** Claude holds the Build Package §58.2 extract, which the package labels a verbatim extract of v12. The **standalone v12 file is MISSING SOURCE**. The extract is not to be treated as the reconciled final text until the owner's Master update. | NOT IMPLEMENTED |
| **Phase 29** | See C2-R308 | **CONFLICT** | NOT IMPLEMENTED |
| **A–P** | Not available in full. Parts and decisions are spread across the work record. Recovery / reconciliation will follow, with per-stage status DISCOVERED → RESEARCHED → AGREED → SPECIFIED → REQUIRED → IMPLEMENTED → INTEGRATED → TESTED → EVALUATED → ACCEPTED, **never raised automatically**. | Full text **MISSING SOURCE**. Claude does not fill gaps by inference. | NOT IMPLEMENTED |
| **"Eight S decisions"** | Not in the owner's current context. | **MISSING SOURCE.** The file `S_DECISION_DOSSIER_2026-10-04.md` is Claude's *question list*, relabelled on 2026-10-04 as **not a source and not decisions — DEFERRED**. Per R308 these are not pending decisions now. | — |
| **Gmail / missing files** | Do not reconnect Gmail or rely on it. Record unavailable sources. | **MISSING SOURCE / DEPENDENCY.** Gmail is not reconnected and not used. | — |

### 8.3 NASA DONKI

| Field | Record |
|---|---|
| Classification | **DEPENDENCY / CREDENTIAL REQUIRED.** There is no NASA API key. |
| Production | **Not a working source in Production.** |
| Design | **Kept.** The catalogue record (`lib/engine/catalog/feeds/science.ts`) is unchanged. It is withheld only by a dated quarantine entry (2026-10-04, 429 on the shared `DEMO_KEY`), which the recheck can release. |
| What is not done | No placeholder or fake key; no mock data; no automatic substitution by another NASA endpoint. A keyless lawful alternative may be researched later and adopted only by a documented decision. |
| Failure isolation (evidence that one source cannot break the registry or core) | **LO 2026-10-04:** Production's `/api/diagnose` reported 3 failed feeds (incl. DONKI) while 135 contributed in the same sweep. **RT:** `lib/engine/no-laundered-refusals.test.ts` keeps refusals reported as failures rather than silently empty. Quarantine withholds a source without touching the record (`quarantine.test.ts`). |

### 8.4 The "30 requests/minute" figure

| Field | Record |
|---|---|
| What it is | An **Existing-System constant**: `GATEWAY_LIMIT = { limit: 30, windowMs: 60_000 }` in `lib/rate-limit.ts:43`, used at 8 call sites. It is **not** a documented contract or decision. |
| Status | **DECISION REQUIRED.** Nothing in the architecture is to be built on 30 as a global limit. |
| Gap | The owner requires the final figures as a documented **contract / configuration**, not a number buried in code. Today they are buried in code — recorded as a GAP. **Not changed now.** |
| Dimensions the owner requires kept apart, mapped to what exists today (RP) | **Provider rate limit** → per-source `minIntervalSec` (catalogue record field, `catalog/types.ts:173`) plus a per-host shared budget (`lib/engine/host-budget.ts`). **Lambda source-specific limit** → the same `minIntervalSec`; one source declares its own (`procurement.ts`, limit 5). **Tenant limit** → NONE (no tenant model). **User / caller limit** → `GATEWAY_LIMIT` 30/min, `WRITE_LIMIT` 10/min, `SIGN_IN_LIMIT` 10/min, `SIGN_IN_SUBJECT_LIMIT` 20/min, `CODE_LIMIT` 10/min. **Capability limit** → NONE as a limit (plans gate features, not rates). **Global concurrency** → partial: CKAN `MAX_CONCURRENCY = 6`; world-events concurrency notes; no global cap. **Retry budget** → NONE as a contract. **Burst limit** → NONE (fixed window only). |
| Side observation | The browser suites share the `GATEWAY_LIMIT` budget (batch 02 §3.2). This is part of the same DECISION REQUIRED. |

### 8.5 Production

**LOCKED** (R306). No new work raises it automatically. Not opened, deployed, credential-changed, or used for external side effects without explicit gates.

### 8.6 Pipeline (owner-led, R308)

```
Existing Repository + CLAUDE.md + Master Living Blueprint + Research Rules + Phase 28 + Phase 29
+ 30.26 + 30.27.2–5 + A–P + S Decisions
  → SOURCE INVENTORY → CONFLICT DETECTION → DECISION RECONCILIATION → MASTER UPDATE
  → IMPLEMENTATION-SAFE SPEC → Claude (SPECIFICATION → CODE → TEST → REPORT)
```

Claude's existing source inventory (`SPEC_SOURCE_INVENTORY_2026-10-04.md`) and this list are **inputs** to that pipeline, not substitutes for it.

### 8.7 Resolution of C2-R308 — owner, ledger R309

> «Phase 29 تبقى Live Intelligence كما في R304»

| Item | Status |
|---|---|
| **C2-R308** | **RESOLVED — Phase 29 = Live Intelligence, as in R304.** The R308 phrase "Phase 29 — Companies & Facilities Intelligence" is superseded as a phase label. Its content stays recorded under the Companies & Facilities **Domain Pack** (R301-1), linked to Technology Intelligence and the World Model. |
| CLAUDE.md | No change needed. §7 already records R304. |
| Implementation | Unchanged — NOT IMPLEMENTED |
