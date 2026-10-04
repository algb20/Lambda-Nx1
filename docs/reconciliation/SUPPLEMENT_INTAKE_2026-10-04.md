# Intake — Missing Specification Recovery Supplement, 2026-10-04

| | |
|---|---|
| **Stage** | 30.27.8.RB — reconciliation (audit lane) |
| **Received** | 2026-10-04 (ledger R297) |
| **Code changed** | None |

## 1. What was received

| File | sha256 | Note |
|---|---|---|
| `Lambda_NX_Missing_Specification_Recovery_2026-10-04.md` — the **Supplement** (318 lines) | `c0e540dd923713d70950e4794563f1aac804f6e82799ba8302d4bf6770f6dfa3` | New |
| `Lambda_NX_CLAUDE_FULL_HANDOFF_2026-10-04.zip` | `8e37cfdd7894f398f3be6b9f2e596182d228d95342798d4850850c4fd0f653e0` | **Identical** to the zip received earlier. It holds the Build Package (`6a056334…`) and the Execution Package (`4569844a…`); the Supplement is **not** in it. |

The Supplement calls itself "a supplement to the Master Living Implementation Blueprint, not a replacement". Its status is "RESEARCHED / SPECIFICATION RECONSTRUCTION — NOT IMPLEMENTED".

It is checked here against:
- the Build Package (the current reconciled target);
- the original Master;
- the owner's decisions R293–R296.

## 2. Conflicts

Each follows CONFLICT → EVIDENCE → IMPACT → PROPOSED RESOLUTION → APPROVAL.

### SC-01 — What Phase 28 and Phase 29 are — **major**

- **Conflict:**
  - Supplement §2 "Phase 28 — Geopolitical Intelligence" and §3 "Phase 29 — Technology Intelligence".
  - Build Package §7 "Phase 28 — Technology Intelligence" and §8 "Phase 29 — Live Intelligence".
- **Evidence:**
  1. Supplement §2 and §3 match **sections** `## 28. Geopolitical intelligence` and `## 29. Technology intelligence` of the original Master (lines 500–520) almost word for word, including "non-operational intelligence level" and the lifecycle "RESEARCH → EMERGING → … → OBSOLETE". Those are Master *section* numbers, not *phase* numbers.
  2. The Build Package reproduces the phase documents verbatim:
     - `# PHASE 28 — Technology Intelligence + Innovation + Emerging Technology + Patent/Research → Company → Product → Adoption → Market` (§58.2, line 3185);
     - `# PHASE 29 — Real-Time Intelligence Fabric + Live Coverage + Source Synchronization + Broadcast Intelligence` (§58.3).
  3. The library file names agree with the Build Package: `…v12_Phase_28_Technology_Intelligence.md` and `…v13_Phase_29_Live_Intelligence.md`.
- **Impact:** if the Supplement were applied as written, Phase 28 would point at the wrong specification, and Phase 29 (Live Intelligence: freshness classes, late data, source synchronisation) would disappear from the phase record.
- **Proposed resolution:**
  - Phase 28 = Technology Intelligence and Phase 29 = Real-Time/Live Intelligence, as in the Build Package and the verbatim extracts.
  - Keep Supplement §2 and §3 as the content of Master **sections** §28 (Geopolitical) and §29 (Technology) — that is, domain coverage — and re-label them so.
  - Nothing is deleted.
- **Approval:** owner / research owner.
- **Status:** OPEN — proposed.

### SC-02 — Status of 30.26 and 30.27.2–5

- **Conflict:**
  - Build Package: 30.26 and 30.27.2–5 are all "SPECIFIED — RECONSTRUCTED/CONSOLIDATED".
  - Supplement §12: 30.26 "SPECIFIED"; 30.27.2, .3, .4 and .5 "SPECIFICATION IN PROGRESS".
- **Evidence:** Build §9, §11–§14; Supplement §4–§9 and §12.
- **Impact:** two different statuses for the same four contracts, and the Contract stage of the pipeline depends on them.
- **Proposed resolution:**
  - Apply the **more conservative** status until the owner decides GAP-S1: 30.26 SPECIFIED (both agree; reconstructed), and 30.27.2–5 **SPECIFICATION IN PROGRESS**.
  - No status is upgraded without approval (owner rules 8 and 12).
- **Approval:** owner.
- **Status:** OPEN — the conservative reading is applied in the records.

### SC-03 — M as "continuation target"

- **Conflict:**
  - Supplement §10 M ("Continuation target") and §12 ("30.27.8.M: continuation target").
  - Owner decision 2 (R293: S is the operational resumption; M is history only); Build §0.0 and §6; CONTINUITY CR-01.
- **Evidence:** ledger R293; Build Package lines 15–39.
- **Impact:** the same pointer conflict that CR-01 already resolved would reopen.
- **Proposed resolution:** owner decision 2 stands. The Supplement's line is the historical pointer CR-01 records as superseded.
- **Approval:** owner — confirm.
- **Status:** OPEN — the earlier owner decision stays in force until changed.

### SC-04 — Stages B, C, I and J now named, and F and G split

- **Conflict:**
  - The Supplement names **B** Agent Runtime / Execution Boundary, **C** Tool Contract / Invocation, **I** Historical reconstruction / temporal evidence and **J** Source independence / corroboration graph. It also lists **F** and **G** as separate stages.
  - The Build sequence is A → D → E → F/G → H → K…, with no B, C, I or J.
- **Evidence:** Supplement §10; Build §0.0 and §6.
- **Impact:**
  - It partly answers GAP-S4 (CONF-P04): the four letters existed as stages.
  - It contradicts the Build Package's "complete sequence".
  - The Supplement itself says the exact B, I and J texts are not recoverable from current files.
- **Proposed resolution:**
  - Record B, C, I and J as **named stages**, with the Supplement's own statuses:
    - B, C: RESEARCHED / SPECIFICATION IN PROGRESS, exact text not recoverable;
    - I: RECOVERY REQUIRED;
    - J: recovered conceptually.
  - The research owner amends the Build sequence explicitly. Until then, neither list is treated as complete.
- **Approval:** research owner.
- **Status:** OPEN.

### SC-05 — Text available for N, O and P

- **Positions:**
  - Supplement: "RECOVERY REQUIRED for exact historical text".
  - Build Package: reconciled §24–§26, plus the original §70.8 summaries (preserved in §58.5).
- **Assessment:** this is **not a contradiction** — both say the detailed originals are absent. N, O and P have summary text (verbatim §70.8) and reconciled text (Build §24–§26). The detailed originals are RECOVERY REQUIRED, consistent with GAP-S2.
- **Status:** RECORDED — no decision needed.

### SC-06 — Verification ladders

- **Position:** the Supplement lists only L0–L7, and treats Admiralty "if used" as source-quality information, separate from the ladder.
- **Assessment:** this agrees with Build §32 on Admiralty. Ladder A (`0 UNVERIFIED … 6 STABLE_CONFIRMED`) is again neither superseded nor mapped.
- **Status:** PI-01 / CONF-V01 remain OPEN.

### SC-07 — Scope of the numbering rule

- **Position:** Supplement §11 rule 2 gives the numbering authority as 30.25 → 30.26 → 30.27 → Phase 31 blocked. It does not mention Q, R, S or the S deep-closure material (§70.18).
- **Assessment:** this is incomplete rather than contradictory. The Build Package governs Q, R and S.
- **Status:** RECORDED.

## 3. Extensions — material the Build Package lacks

These are classified as EXTENSION under Build §54; they do not conflict with anything. The research owner folds them into the Build Package. **Claude does not adopt them on its own.**

| Area | Supplement adds | Build section to extend |
|---|---|---|
| 30.26 | "Source health ≠ source quality" | §31 |
| 30.27 | A2A and MCP named as external adapters; scope list (UI↔Backend, Agent↔Runtime, Data↔Event Fabric, …) | §10.1 |
| 30.27.2 | Accessibility requirement: semantic actions need accessible equivalents | §11 |
| 30.27.3 | Candidate transports (SSE, WebSocket, HTTP streaming, broker; WebTransport deferred); "expired cursor = CURSOR_EXPIRED / RESYNC_REQUIRED, never 'no changes'" | §12 |
| 30.27.4 | Per-version fields: compatibility_policy, migration_path, deprecation_date, sunset_date, replacement_contract. Version placement and sunset policy explicitly **RESEARCH REQUIRED / DECISION REQUIRED**. | §13 |
| 30.27.5 | Cursors are deterministic, integrity-protected and expirable. PIT Context fields: valid_time_boundary, knowledge_time_boundary, observation_boundary, temporal_mode, world_model_version, schema_versions, query_definition, source_scope, policy_context, created_at, expires_at. Historical pagination is bound to the PIT context. | §14 |
| K | Named event kinds: Observation Event, Evidence Event, Verification Event, Canonical Change Event | §21 |

## 4. Effect on the open specification gaps (`INVENTORY_AND_GAPS_2026-10-04.md` §C.3)

| Gap | Before | After the Supplement |
|---|---|---|
| GAP-S1 — original 30.26 / 30.27.2–5 wording | Open | **Still open.** The Supplement is a second reconstruction ("deliberately not a fabricated replacement"). It does not supply the originals, and it disagrees with the Build Package on status (SC-02). |
| GAP-S2 — detailed A–P originals | Open | **Narrowed.** The Supplement confirms that exact B, I, J, N, O and P texts are not recoverable from current files: RECOVERY REQUIRED from archives or an owner-held copy. |
| GAP-S3 — §70.18 not in reconciled §29 | Open | Unchanged. The Supplement does not cover S. |
| GAP-S4 — letters B, C, I, J | Open | **Partly answered** (SC-04). The stages existed; the sequence needs amending. |

## 5. What this means for work now

- The Supplement's procedure (§13) begins with: read the Master, read this supplement, inspect the repository, and produce a CURRENT/TARGET/GAP mapping.
  - Steps 1–4 are done: `INVENTORY_AND_GAPS_2026-10-04.md`, 48 rows.
  - Step 5, "Resolve contract conflicts before coding", belongs to the owner and the research owner: SC-01 to SC-04, PI-01, and GAP-S1 to GAP-S4.
- Its own acceptance criterion (§15) needs the owner's acceptance. Claude does not accept specification documents.
- Implementation stays where the owner placed it: no Master subsystem is coded until its contract is decided and a §53 task sheet exists.
