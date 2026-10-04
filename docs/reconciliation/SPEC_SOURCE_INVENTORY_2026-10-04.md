# Specification Source Inventory — 2026-10-04

| | |
|---|---|
| **Stage** | 30.27.8.RB — inventory only (owner instruction R299: **NO CODE CHANGES**, no redesign, no invented text) |
| **Question** | Where do the texts of Phase 28, Phase 29, 30.26, 30.27.2, 30.27.3, 30.27.4, 30.27.5 and 30.27.8 A–P actually exist? For each: file, path, section, complete or partial, status, conflicts. |
| **Hierarchy** | Not decided here. The owner will set the formal hierarchy after this inventory (R299). Nothing below treats CLAUDE.md as cancelling the Master Blueprint, or the reverse. |
| **Code changed** | None |

---

## 1. What was searched, and how

| # | Source | Method | Result |
|---|---|---|---|
| S1 | Repository working tree, branch `claude/bittorent-network-app-c8j9pv` @ `e0b645e` | `git grep` for `Phase 28`, `PHASE 28`, `Phase 29`, `PHASE 29`, `30.26`, `30.27.2–5`, `30.27.8`. Also distinctive specification terms: `UIAction`, `Analytical Context`, `idempotency_key`, `Real-Time Intelligence Fabric`, `TechnologyObject`, `Canonical Object Envelope`, `AgentDefinition`, `CapabilityBinding`, `HandoffContract`, `Contract Change Ledger`, `PIT_CONTEXT`, `CHANGE_CURSOR`, `Master Living`. | Matches **only** in files Claude wrote from 2026-10-03 on (`docs/reconciliation/*`, `docs/ledger/REQUESTS.md` R291+, `CLAUDE.md`), plus four code comments about pausing the `publish` job. One false positive: `lib/geo/places-data.ts:488` matches "30.269", Austin's latitude. **No specification text.** |
| S2 | Full git history, all 218 commits on all refs | `git log --all -G<pattern>`; `git log --all --diff-filter=D` | The first commit that ever contained any of these identifiers is `11ce7e0` (2026-10-03, Claude's baseline). The one older hit is `312afa3`, the same latitude. The only documents ever deleted are `components/ui/aspect-ratio.tsx` and `public/branding/README.md`. **No specification was ever committed and then removed.** |
| S3 | All six remote branches: `main`, `claude/bittorent-network-app-c8j9pv`, `claude/app-error-loading-speed-c9fdyd`, `claude/logo-upload-specs-mb3knj`, `claude/unclear-description-fxgwf7`, `vercel/install-vercel-web-analytics-dosh8u` | Fetched read-only, then grepped with the S1 terms | Matches only on `main` and this branch, and only in Claude's reconciliation files. **No specification text on any branch.** |
| S4 | Repository work record: `docs/ledger/REQUESTS.md` R1–R298 and `docs/ledger/requests-recovered.md` | grep | The first mention of any of these identifiers is R291 (2026-10-03). **R1–R290 never reference Master phase numbers.** The repository's own phase scheme is **P0–P8** in `docs/PLAN.md`, a separate numbering that does not collide with them. |
| S5 | Repository documentation: 27 files in `docs/`, `CLAUDE.md`, 4 agent definitions | Topic grep (technology intelligence, live/freshness, data contract, UIAction, cursor/replay, versioning, idempotency/ETag/PIT, agent/handoff/promotion) | Incidental mentions only. **None is a specification of the eight items.** `docs/TECH_RADAR.md` is an engineering technology-choice radar, not Phase 28. |
| S6 | Files uploaded by the owner to this session | Heading and full-text search, with line ranges | **All text for the eight items lives here.** See §2. |
| S7 | Session records on this machine | `/root/.claude/projects/…` | Only the current session's transcript exists here. Earlier sessions' records are not on this machine. The ledger (S4) is the durable cross-session record. |

**Conclusion of the search.**
- The repository does not contain — and has never contained — the text of Phase 28, Phase 29, 30.26, 30.27.2–5 or A–P.
- The Master research was carried out outside the repository.
- Its text reaches Claude only through the owner's uploads (S6).
- Material that exists only in the owner's earlier conversations cannot be seen from here. It is therefore **UNVERIFIED by Claude**, which is not the same as missing (owner, R299).

### 1.1 Uploaded files (S6)

| Code | File (as uploaded) | Path on this machine | Lines | sha256 (prefix) |
|---|---|---|---|---|
| **U1** | Master Living Implementation Blueprint (original, layers to 2026-10-03) | `/root/.claude/uploads/<session>/6ffcdeda-4589785768596756.md` | 5,516 | `979f9c1f` |
| **U2** | Research / Rules / Claude Operating Manual | `…/e30fcd7c-547574746.md` | 1,239 | `8cf99b49` |
| **U3** | `Lambda_NX_MASTER_RECONCILED_CLAUDE_BUILD_PACKAGE_2026-10-04.md` (also uploaded as `9edbd5fd-…`, and inside both zips) | `…/4a6e9ac7-…md` | 13,354 | `6a056334` |
| **U4** | `Lambda_NX_CLAUDE_EXECUTION_PACKAGE_2026-10-04.md` (also as `907bab57-…`, and inside both zips) | `…/6fc89afa-…md` | 865 | `4569844a` |
| **U5** | `Lambda_NX_Missing_Specification_Recovery_2026-10-04.md` | `…/18ec8ebc-…md` | 318 | `c0e540dd` |
| **U6** | Owner's message of 2026-10-04 (ledger R298) | the chat itself | — | — |

The repository is public, so U1–U5 are **not** committed; only their fingerprints are (CLAUDE.md §0).

---

## 2. Item-by-item

**Legend for "Text":**
- **COMPLETE** — a whole document or body with its own closing gate or outcome.
- **PARTIAL** — reconstructed, summarised or indexed.
- **EXTRACT?** — a verbatim extract whose completeness cannot be confirmed.

**Implementation** is always judged against code and tests (§3). It is never taken from a document's own status line.

### 2.1 Phase 28

| File | Section | Text | Status as stated | Conflicts |
|---|---|---|---|---|
| U3 | §58.2 "Phase 28 — exact source extract", lines 3183–4046. Heading `# PHASE 28 — Technology Intelligence + Innovation + Emerging Technology + Patent/Research → Company → Product → Adoption → Market`. 48 subsections, through 28.45 exit gate. Stated source: library file `Lambda_NX_Master_Living_Blueprint_v12_Phase_28_Technology_Intelligence.md`. | **COMPLETE** — has an exit gate and a closing statement | `SPECIFIED / AGREED — NOT IMPLEMENTED` (28.0) | — |
| U3 | §7 "Phase 28 — Technology Intelligence", lines 372–532 | PARTIAL — reconciled summary | SPECIFIED / historical approved input | — |
| U5 | §2 "Phase 28 — Geopolitical Intelligence", lines 19–33 | PARTIAL | SPECIFIED — NOT VERIFIED IMPLEMENTED | **CONFLICTING:** the text is U1 *section* §28 (lines 500–509), not Phase 28 — SC-01 |
| U6 | "Phase 28 — Technology Intelligence" | PARTIAL — description | SPECIFIED, not IMPLEMENTED | Agrees with U3. SC-01 resolved by owner statement (R298). |
| U1 | — (only "Phase 28/29 are specified", line 4894) | none | — | — |

### 2.2 Phase 29

| File | Section | Text | Status as stated | Conflicts |
|---|---|---|---|---|
| U3 | §58.3 "Phase 29 — exact source extract", lines 4047–6780. Heading `# PHASE 29 — Real-Time Intelligence Fabric + Live Coverage + Source Synchronization + Broadcast Intelligence`. 110 subsections (29.0–29.109), including contracts (29.99), events (29.100), evaluation (29.101), failure tests (29.102), security gate (29.103), performance gate (29.104), acceptance gate (29.105) and final outcome (29.109). Stated source: `…v13_Phase_29_Live_Intelligence.md`. | **COMPLETE** | `SPECIFIED / AGREED — NOT IMPLEMENTED` (29.0) | **CONFLICTING** — SC-08 |
| U3 | §8 "Phase 29 — Live Intelligence", lines 533–677 | PARTIAL — summary | SPECIFIED | SC-08 |
| U5 | §3 "Phase 29 — Technology Intelligence", lines 34–47 | PARTIAL | SPECIFIED | **CONFLICTING:** the text is U1 *section* §29 (lines 511–520) |
| U6 | "Phase 29 — Companies & Facilities Intelligence" | PARTIAL — description | SPECIFIED, not IMPLEMENTED | **CONFLICTING** with U3's verbatim document. Companies & Facilities appears in U3 as domain **section §37** (lines 2424–2467). |

### 2.3 Phase 30.26 — Data Contracts

| File | Section | Text | Status as stated | Conflicts |
|---|---|---|---|---|
| U3 | §9, lines 678–796 | PARTIAL — "SPECIFIED — RECONSTRUCTED/CONSOLIDATED … not a claim of byte-for-byte recovery" | SPECIFIED — RECONSTRUCTED | — |
| U3 | §58.4, v9 contract hardening Phase 1, §213–§237, lines 6781–7565 (source: `…v9_Schema_API_Event_Formalization.md`) | **EXTRACT?** — source material, not titled 30.26. The extract ends abruptly at line 8782. | — | — |
| U5 | §4, lines 48–93 | PARTIAL — second reconstruction | SPECIFIED | — |
| U6 | "30.26 — Data Contracts" (25 object types + rules) | PARTIAL — description | SPECIFIED | **CONFLICTING** object list vs U3 §9/§30 — SC-09 |
| U1 | Base text in §6 (canonical envelope, 17 fields) and §12 (time axes). "30.26 Data Contracts: specified" at line 4891. | PARTIAL — base Master text, not the 30.26 document | specified | — |
| **The original 30.26 document** | — | **MISSING from all supplied files.** U3 itself says the exact text was unavailable. | — | — |

### 2.4 Phase 30.27.2 — UIAction + Shared Analytical Context

| File | Section | Text | Status as stated | Conflicts |
|---|---|---|---|---|
| U3 | §11, lines 915–1025 | PARTIAL — reconstructed | SPECIFIED — RECONSTRUCTED | Status differs from U5 and U6 (SC-02) |
| U3 | §58.5, Q §69.4 (verbatim Q, which builds on 30.27.2 — "extends the contract already established in 30.27.2") | Related verbatim text, not 30.27.2 itself | — | — |
| U5 | §6, lines 104–122 | PARTIAL | SPECIFICATION IN PROGRESS | — |
| U6 | "30.27.2" | PARTIAL — description | SPECIFICATION IN PROGRESS | SC-02: owner's statement recorded |
| **The original 30.27.2 document** | — | **MISSING from all supplied files** | — | — |

### 2.5 Phase 30.27.3 — Streaming / Incremental Sync / Resume / Replay

| File | Section | Text | Status as stated | Conflicts |
|---|---|---|---|---|
| U3 | §12, lines 1026–1105 | PARTIAL — reconstructed | SPECIFIED — RECONSTRUCTED | SC-02 |
| U3 | §58.4 v9 §255 Ordering (line 8192), §256 Delivery/Retry/DLQ, §258 Replay (line 8296) | EXTRACT? — source material | — | — |
| U5 | §7, lines 123–143 | PARTIAL | SPECIFICATION IN PROGRESS | — |
| U6 | "30.27.3" | PARTIAL — description | SPECIFIED (implementation not proven) | SC-02 |
| **The original 30.27.3 document** | — | **MISSING from all supplied files** | — | — |

### 2.6 Phase 30.27.4 — Versioning / Compatibility

| File | Section | Text | Status as stated | Conflicts |
|---|---|---|---|---|
| U3 | §13, lines 1106–1171 | PARTIAL — reconstructed | SPECIFIED — RECONSTRUCTED | SC-02 |
| U3 | §58.4 v9 §241 Versioning (line 7682), §259 Schema Registry (8322), §260 Compatibility (8358); plus S §69.17–69.19 (verbatim) | EXTRACT? / related verbatim | — | — |
| U5 | §8, lines 144–159 | PARTIAL. Version placement and sunset policy are explicitly "RESEARCH REQUIRED / DECISION REQUIRED". | SPECIFICATION IN PROGRESS | — |
| U6 | "30.27.4" | PARTIAL — description | SPECIFICATION IN PROGRESS | SC-02 |
| **The original 30.27.4 document** | — | **MISSING from all supplied files** | — | — |

### 2.7 Phase 30.27.5 — Idempotency / Concurrency / Pagination / Point-in-Time

| File | Section | Text | Status as stated | Conflicts |
|---|---|---|---|---|
| U3 | §14, lines 1172–1235 | PARTIAL — reconstructed | SPECIFIED — RECONSTRUCTED | SC-02 |
| U3 | §58.4 v9 §228 Point-in-Time Integrity (line 7379), §246 Pagination (7848), §250 Idempotency (7982) | EXTRACT? — source material | — | — |
| U5 | §9, lines 160–183 (adds PIT Context fields) | PARTIAL | SPECIFICATION IN PROGRESS | — |
| U6 | "30.27.5" | PARTIAL — description | SPECIFIED | SC-02 |
| **The original 30.27.5 document** | — | **MISSING from all supplied files** | — | — |

### 2.8 30.27.8 A–P

Every letter has the same short §70.8 summary in **U1** (lines 4218–4515) and the same text copied into **U3 §58.5** (lines 11966–12250). Those summaries are verbatim from the 2026-09-26 consolidation.

| Letter | U1 / U3 §58.5 summary (verbatim) | U3 reconciled section | U5 recovery index (§10) | Detailed original | Conflicts |
|---|---|---|---|---|---|
| A — Agent Schema & Capability Binding | Yes, 20 lines | §16, lines 1309–1372 | Recovered list | **MISSING** | — |
| B — Agent Runtime / Execution Boundary | — | — | Concepts only: "exact historical B document is not independently recoverable" | **MISSING** | Absent from the U1/U3 sequence — SC-04 |
| C — Tool Contract / Invocation | — | — (gate partly in §18) | Concepts + invocation gate | **MISSING** | SC-04 |
| D — Agent Handoff / Context Transfer | Yes, 22 lines | §17, lines 1373–1425 | Recovered list | **MISSING** | — |
| E — Security / Credential / Sandbox | Yes, 55 lines | §18, lines 1426–1494 | Recovered chain | **MISSING** | — |
| F — Tool Result / Artifact Boundary | Merged as "F/G", 45 lines | §19 (merged F/G) | Separate stage | **MISSING** | F/G merged vs split — SC-04 |
| G — Evidence Verification / Truth Status | (in F/G) | §19 (in F/G) | Separate stage; ladder L0–L7 | **MISSING** | SC-04; ladder A vs L0–L7 — PI-01 |
| H — Canonical Promotion | Yes, 21 lines | §20, lines 1551–1578 | Recovered list | **MISSING** | — |
| I — Historical reconstruction / temporal evidence | — | — | "RECOVERY REQUIRED for exact historical text" | **MISSING** | SC-04 |
| J — Source independence / corroboration graph | — | — | "Recovered conceptually … not fully present" | **MISSING** | SC-04 |
| K — Canonical Event Semantics | Yes, 24 lines | §21, lines 1579–1630 | Recovered list | **MISSING** | — |
| L — Event → Signal → Situation → Inference | Yes, 48 lines | §22, lines 1631–1697 | Recovered pipeline | **MISSING** | — |
| M — Temporal + Causal Reasoning | Yes, 17 lines | §23, lines 1698–1781 | "Continuation target" | **MISSING** | Pointer conflict — SC-03 / CR-01 |
| N — Trigger Orchestration | Yes, 19 lines | §24, lines 1782–1846 | "RECOVERY REQUIRED" | **MISSING** | — |
| O — Monitoring / Watch / Alert | Yes, 15 lines | §25, lines 1847–1894 | "RECOVERY REQUIRED" | **MISSING** | — |
| P — Inbox / Attention / Decision | Yes, 12 lines | §26, lines 1895–1964 | "RECOVERY REQUIRED" | **MISSING** | — |

**Status as stated, every letter:** RESEARCHED → SPECIFICATION IN PROGRESS (U1 §70.8, U3, U5).

**For comparison** — Q, R and S are **COMPLETE** verbatim in U3 §58.5: Q §69.4, R §69.9, S §69.12–69.47, plus the S deep-closure continuation §70.18.

---

## 3. Implementation evidence — the same answer for every item

Searched against the repository code and tests at `e0b645e` (mapping rows in `INVENTORY_AND_GAPS_2026-10-04.md` §C.2):

| Item | Precursor code present (RP/RT) | IMPLEMENTED against the item's specification | TESTED against the item's specification |
|---|---|---|---|
| Phase 28 | `research` gateway (OpenAlex, Crossref, PubMed) — G47, weak | **No** | **No** |
| Phase 29 (Live) | Live edge, freshness, source health, SSE, quarantine — G48 | **No** | **No** |
| Companies & Facilities (U6) | companies, ownership, filings, procurement gateways — G33 | **No** | **No** |
| 30.26 | 24 application tables; 0 envelope fields — G01–G04, non-conformant | **No** | **No** |
| 30.27.2 | Preferences, URL view-state — G09 | **No** | **No** |
| 30.27.3 | `/api/world/stream` SSE — G10 | **No** | **No** |
| 30.27.4 | Migration journal only — G11 | **No** | **No** |
| 30.27.5 | Publisher dedup, radar fingerprints — G12–G14 | **No** | **No** |
| A–P | MCP server (6 tools), confidence by origins, cron, monitors — G15–G22 | **No** | **No** |

The repository's 2,770 passing tests prove **repository behaviour**. None of them is a test of any of these specifications.

---

## 4. Summary table

| Item | FOUND | PARTIAL | MISSING | CONFLICTING | IMPLEMENTED | NOT VERIFIED |
|---|---|---|---|---|---|---|
| **Phase 28** | ✔ U3 §58.2 (verbatim, complete) | U3 §7; U5 §2; U6 | — | ✔ U5 §2 = Master section §28 (SC-01 — resolved by owner R298) | ✘ | ✔ implementation |
| **Phase 29** | ✔ U3 §58.3 (verbatim, complete — "Real-Time Intelligence Fabric") | U3 §8; U5 §3; U6 | — | ✔ **three identities** — U3 Live / U5 Technology / U6 Companies & Facilities (**SC-08 OPEN**) | ✘ | ✔ |
| **30.26** | — | ✔ U3 §9 (reconstructed); U5 §4; U6; v9 source §213–237; U1 §6, §12 | ✔ original document | ✔ object list U3 vs U6 (SC-09) | ✘ | ✔ |
| **30.27.2** | — | ✔ U3 §11; U5 §6; U6 | ✔ original | ✔ status (SC-02 — owner's recorded) | ✘ | ✔ |
| **30.27.3** | — | ✔ U3 §12; U5 §7; U6; v9 §255–258 | ✔ original | ✔ status (SC-02) | ✘ | ✔ |
| **30.27.4** | — | ✔ U3 §13; U5 §8; U6; v9 §241, §259–260 | ✔ original | ✔ status (SC-02) | ✘ | ✔ |
| **30.27.5** | — | ✔ U3 §14; U5 §9; U6; v9 §228, §246, §250 | ✔ original | ✔ status (SC-02) | ✘ | ✔ |
| **A, D, E, H, K, L, N, O, P** | — | ✔ U1 / U3 §70.8 summaries (verbatim) + U3 §16–§26 | ✔ detailed originals | N, O, P: U5 "recovery required" vs U3 reconstructed (consistent — SC-05) | ✘ | ✔ |
| **F, G** | — | ✔ merged F/G summary + U3 §19; U5 separate | ✔ detailed originals | ✔ merged vs split (SC-04); ladder (PI-01) | ✘ | ✔ |
| **M** | — | ✔ U1 / U3 summary + U3 §23 | ✔ detailed original | ✔ pointer "continuation target" vs S (SC-03) | ✘ | ✔ |
| **B, C, I, J** | — | ✔ U5 §10 index only | ✔ all text; absent from U1 / U3 | ✔ absent from the Build sequence (SC-04) | ✘ | ✔ |

**Counts across the 8 requested items** (A–P counted once):

| | Count |
|---|---|
| FOUND complete | 2 (Phase 28, Phase 29) |
| PARTIAL only | 6 |
| Original text MISSING from all supplied files | 6 (30.26, 30.27.2–5, A–P detail) |
| CONFLICTING | 7 — all except Phase 28, whose conflict is resolved |
| IMPLEMENTED | **0** |
| Implementation NOT VERIFIED | 8 of 8 |

---

## 5. Live observation made during this inventory (read-only)

- `main` now contains this branch up to `fa5b2d1`, through PR #74 (merge `65e1cc6`, 2026-10-04 17:21 +0100, by algb20).
- Netlify project `lambdanx` still serves the Production deploy `6ac10a06…`, built from commit `9c19303` and published 2026-10-03 14:04Z. The deploy record was last updated 2026-10-04 16:34Z; the cause of that update was not determined.
- **No newer commit has been published to Production**, consistent with owner decision 4.
- The deploy record shows `locked: null`, so whether a site-level lock is set is **UNVERIFIED** (UV).
- Two later commits on this branch (`cf59e4b`, `e0b645e`) are not yet on `main`.

---

## 6. Owner instructions recorded with this inventory (R299)

- NO CODE CHANGES and no redesign until the Canonical Reconciliation exists and the resumption point is set.
- Do not assume missing texts are absent from the project's history. Do not invent them.
- Do not delete or replace any older specification before a documented reconciliation.
- The CLAUDE.md ↔ Master hierarchy will be set formally **after** this inventory. Until then, the existing text of CLAUDE.md (R293) stays as recorded, unchanged.
- Do not change Pi Network, Netlify, Supabase, Next.js or the current structure, nor the forecasting, Phase 28–30 or A–P stages, on conjecture.
- **Next, owner-led:** one Canonical Reconciliation against the Master Blueprint, then the correct resumption point.

---

## 7. Update — owner decision R300

- **Phase 29 = Live Intelligence**, as in the verbatim text (U3 §58.3).
- In the §4 summary table, the Phase 29 row moves from "CONFLICTING (SC-08 OPEN)" to **FOUND — conflict resolved**.
- Placing the Companies & Facilities description (U6) remains open: an extension of Build §37, or a separately numbered stage.

**Counts after R300:**
- CONFLICTING: 6 (was 7).
- FOUND complete: 2.
- IMPLEMENTED: 0.
