# Lambda NX — Canonical Reconciliation (working document)

| | |
|---|---|
| **Stage** | 30.27.8.RB → **CANONICAL RECONCILIATION** — step 1 of the owner's resumption pipeline (R301) |
| **Opened** | 2026-10-04 |
| **Nature** | A reconciliation of documents. It does not select one document and discard another. Every **decision** below is the owner's (marked AGREED with a ledger reference). Everything else is a **PROPOSAL** awaiting approval. |
| **Code changed** | None. Owner instruction R299 — NO CODE CHANGES — is still in force. |

---

## 0. Owner decisions in force for this reconciliation

| Ref | Decision |
|---|---|
| R300 | Phase 28 = Technology Intelligence. Phase 29 = **Live Intelligence**, per the verbatim text. |
| R301-1 | **Companies & Facilities Intelligence** is a **Domain Pack / Intelligence Domain**: not a new numbered phase, and not folded into §37 in a way that loses its independence. Everything prepared earlier under the "Phase 29 — Companies & Facilities" label is **preserved** as that domain's content. |
| R301-2 | **Document governance:** CLAUDE.md governs the current repository and actual execution. The Master Living Blueprint governs the target architecture, research, specifications, contracts, phases and acceptance criteria. Between them sits an explicit layer: **Current-System Reality → Target Architecture → Migration/Implementation Contracts**. |
| R301-3 | No contradiction found by Claude is adopted as-is. Each is worked through individually in a workstream (§3). |
| R301-4 | **Resumption pipeline:** CANONICAL RECONCILIATION → CURRENT-SYSTEM AUDIT → MISSING-SPEC RECOVERY → CONTRACT CONSOLIDATION → RESUME. The next stage is fixed formally only after RESUME. **Phase 31 stays BLOCKED.** |
| R301-5 | **Text classes:** RECOVERED EXACT TEXT · RECOVERED DECISIONS / SPECIFICATION CONTENT · MISSING — MUST NOT INVENT. |

---

## 1. Document governance (R301-2)

```
CURRENT-SYSTEM REALITY  ──►  TARGET ARCHITECTURE  ──►  MIGRATION / IMPLEMENTATION CONTRACTS
  (governed by CLAUDE.md;      (governed by the Master    (where the two meet: one contract per
   evidence from code, tests,   Living Blueprint)           change, written against both)
   live systems)
```

| Layer | Governing document | What it decides | What it never does | Where it lives |
|---|---|---|---|---|
| **Current-System Reality** | CLAUDE.md | How the repository is built, tested, released and operated: branch, ledger, lanes, live-system rules, merge gate, evidence classes | Change the target architecture, research, contracts, phases or acceptance criteria | `CLAUDE.md`; facts in `RECONCILED_MASTER_BASELINE.md` §1–2 and `INVENTORY_AND_GAPS_2026-10-04.md` §A |
| **Target Architecture** | Master Living Blueprint (current form: Build Package `6a056334…`) | Target architecture, research, specifications, contracts, phases, acceptance criteria | Assume the target exists in code; dictate repository mechanics | Owner's library. The repository holds fingerprints only, because it is public. |
| **Migration / Implementation Contracts** | Both, for one bounded change at a time | Exactly what moves from current to target: files, schema, API, tests, rollback, acceptance (Build §53 task sheet) | Lower the Blueprint to match the code, or treat the existing system as absent | To be created per change. None exists yet. |

Two consequences, both from R301-2:
- **No rewrite.** The existing system is reality.
- **No downgrade.** The Blueprint is not reduced to fit the code.

> **Note for the formal hierarchy (R299 deferred it to after the inventory).** CLAUDE.md §0 currently states a single precedence chain (R293). R301-2 restates it as a **split by domain**, which is compatible with that chain. CLAUDE.md §0 is updated with this ledger entry. The R293 wording is kept as history in the ledger.

---

## 2. Resumption pipeline (R301-4)

| Step | What it produces | Status |
|---|---|---|
| **1. CANONICAL RECONCILIATION** | This document. Workstreams W1–W6 decided one by one. | **IN PROGRESS** |
| 2. CURRENT-SYSTEM AUDIT | Evidence-based implementation audit (W6): each of the 48 mapping rows re-checked against code and tests. | PENDING |
| 3. MISSING-SPEC RECOVERY | W5 register brought to RECOVERED EXACT TEXT wherever the owner's library allows. The rest is labelled MISSING — MUST NOT INVENT. | PENDING |
| 4. CONTRACT CONSOLIDATION | One canonical source per contract (S §69.13 ownership; Build §49 registry). | PENDING |
| 5. RESUME | The owner fixes the next stage formally. | PENDING |
| Phase 31 | — | **BLOCKED** |

Relation to the earlier pointer: **30.27.8.S** remains the latest *specification* stage recorded in the Master, and it is BLOCKED by Build §29.4. R301-4 sets the *working* point to this pipeline. Whether work resumes at S after step 5 is decided at RESUME, not assumed now.

---

## 3. Workstreams — the contradictions Claude found, one by one (R301-3)

Each workstream ends in an owner decision. Until then, each item's status is **OPEN — PROPOSAL**.

### W1 — Canonical Timeline (resumption points: 30.27 / M / S)

**Evidence: every continuation statement, by date.** Nothing is deleted; superseded entries are marked.

| Date | Source | Statement | Proposed standing |
|---|---|---|---|
| 2026-09-19 | Rules file §38 / §4 / §46 (U2 lines 533, 612, 1108) | "NEXT Phase 30.27" | Historical — superseded by 09-25 / 09-26 |
| 2026-09-25 | Master §69.3 | Order G → H → K → L → M → N → O → P → Q; an earlier N/O/P mislabel superseded | Historical — reconciliation record |
| 2026-09-25 | Master §69.8 | "Latest specified continuation M → … → R" | Historical (dating inconsistency, CONF-P03) |
| 2026-09-26 | Master §69.11, §69.53 | Authoritative G → S; "S is the current … stage" | Superseded only by later owner decisions |
| 2026-09-26 | Master §70.7, §70.16, §70.18 | A → S; latest S; S deep closure | As above |
| 2026-10-03 | Continuity addendum §3 (U1 5425; U2 1148) | "M — immediate continuation target" | Superseded as a pointer (CR-01, R293-2) |
| 2026-10-03 | Owner R293-2 | S is the operational resumption; M is history | In force for the *specification* pointer |
| 2026-10-04 | Build Package §0.0, §29.4 | S current; S BLOCKED | Consistent with R293-2 |
| 2026-10-04 | Supplement §10, §12 | "M continuation target" | Superseded (SC-03) |
| 2026-10-04 | **Owner R301-4** | Working point = reconciliation pipeline; formal next stage only after RESUME | **Governs now** |

**Proposal.**
- *Specification timeline:* 30.25 → 30.26 → 30.27 → 30.27.8 A … S; the latest specified stage is S (BLOCKED).
- *Working timeline:* the R301-4 pipeline.
- The letters B, C, I and J (SC-04) enter the specification timeline only once their text class is settled in W5.

**Decision needed:** approve the two-timeline form, and confirm the stage letter sequence including B, C, I, J and the F/G split.

### W2 — Unified Verification Model (ladder A, ladder L0–L7, TruthStatus, Admiralty)

**Constraint already agreed** (R293 direction; Build §32): Admiralty and the verification ladder are separate. They are **not merged into one score**. Every historical value is preserved.

So "unified" here means **one model that holds every dimension**. It does not mean one scale.

| Dimension | Answers | Scale | Source |
|---|---|---|---|
| D1 Processing / promotion gate | How far has this item been processed? | L0 Unprocessed … L7 Canonically Promoted | Build §19; Supplement G |
| D2 Claim truth status | What is the claim's evidential state? | TruthStatus: OBSERVED, REPORTED, SUPPORTED, CORROBORATED, CONTESTED, CONTRADICTED, UNVERIFIED, INSUFFICIENT_EVIDENCE, SUPERSEDED, INVALIDATED, UNKNOWN | Build §32; original Master ~line 2273 |
| D3 Source reliability | How reliable is the source? | Admiralty A–F | Repository (RT); Build §32 |
| D4 Information credibility | How credible is this item? | Admiralty 1–6 | Repository (RT) |
| D5 Legacy confidence grade | The repository's grade | confirmed / probable / possible / unconfirmed — by independent origins since M-02 | Repository (RT) |
| D6 Independence | How many independent origins? | Count of independence groups (180) | Repository (RT); Build §19 |
| *(historical)* Ladder A | Corroboration / stability | 0 UNVERIFIED … 6 STABLE_CONFIRMED | v9 §226 (Build §58.4, line 7348) |

**Proposal (PI-01).** Ladder A is recorded as **superseded by D1 + D2 + D6 together**, and none of its information is lost:

| Ladder A level | Now expressed by |
|---|---|
| 1 SINGLE_SOURCE | D6 = 1 |
| 2 SOURCE_VALIDATED | D1 ≥ L4 |
| 3 INDEPENDENT_CORROBORATION | D6 ≥ 2 **and** D2 = CORROBORATED |
| 4 PRIMARY/AUTHORITATIVE | A source attribute beside D3 |
| 5 MULTI_MODAL_CONVERGENCE | Recorded as an evidence-modality attribute. Kept distinct from L6 Cross-Domain. |
| 6 STABLE_CONFIRMED | A temporal-stability attribute over D2 history |

Stored D3, D4 and D5 values are never rewritten (baseline §7.3).

**Decision needed:** approve, or the research owner supplies a different mapping.

### W3 — Current System Baseline (Pi / Netlify / Supabase / Next.js / Drizzle)

**Agreed:** these are Existing System facts and implementation constraints, not canonical decisions (R298 rule 10). Nothing changes before the comparison is finished (R299).

**Evidence:**
- `RECONCILED_MASTER_BASELINE.md` §1–2, §5;
- `INVENTORY_AND_GAPS_2026-10-04.md` §A, including the Pi / World Pi separation (A.4);
- `COMPATIBILITY_GAP_LEDGER.md` §2.

**Remaining work, in step 2:** refresh the live observations, which are dated, and keep Pi-specific adapters separate from the core.

**Decision needed:** none now.

### W4 — Placing Forecast in the Master

**Agreed:** Forecast stays. It is a governed intelligence capability, separate from Truth and the Canonical World State, with evidence, uncertainty, PIT controls and evaluation (owner rule 9; Build §41). The old CLAUDE.md removal is superseded (R293).

**Where the Master already places it:**
- Build §1 core loop: … RESEARCH → **FORECAST** → SCENARIO → MONITOR …;
- §22 (L): … INFERENCE → ASSESSMENT → **FORECAST / SCENARIO / ALERT**;
- §30 canonical types: Forecast and Scenario;
- §41 the Forecast record;
- §69.14 dependency graph: "Inference / Forecast / Scenario" before "Monitoring / Attention".

**Proposal:**
- Forecast is a layer of the Intelligence Core, **downstream of Inference** and **upstream of Monitoring / Attention**.
- It writes only Forecast objects — never canonical World State (Build §41: Forecast ≠ Scenario ≠ Truth ≠ Event; §29.3 invariant 2: derived projections never become canonical truth; §23.4: counterfactuals must not rewrite canonical truth).
- It is evaluated by calibration (Build §44).
- The repository's calibration ledger maps to the **evaluation side** of this layer as a precursor (G37). Whether its attributed forward-looking claims are Forecast objects remains D-03.

**Decision needed:** approve the placement, and decide D-03.

### W5 — Text recovery register (R301-5 classes)

| Item | RECOVERED EXACT TEXT | RECOVERED DECISIONS / SPECIFICATION CONTENT | MISSING — MUST NOT INVENT |
|---|---|---|---|
| Phase 28 Technology | ✔ Build §58.2 (complete, 28.0–28.45) | Build §7; owner R298 description | — |
| Phase 29 Live | ✔ Build §58.3 (complete, 29.0–29.109) | Build §8 | — |
| Companies & Facilities **domain** (R301-1) | — | Build §37; owner R298 description; Build §50 (Tier 1 "Companies"); Phase 28 linkage (Build §7.7) | Any separate earlier C&F document, if one existed — **owner to confirm** |
| 30.26 | Partial: v9 §213–§237 source (Build §58.4) | Build §9; Supplement §4; owner R298 (object list, SC-09) | The original 30.26 document |
| 30.27.2 | — (Q §69.4 builds on it) | Build §11; Supplement §6; owner R298 | The original 30.27.2 |
| 30.27.3 | Partial: v9 §255, §256, §258 | Build §12; Supplement §7; owner R298 | The original 30.27.3 |
| 30.27.4 | Partial: v9 §241, §259, §260; S §69.17–69.19 | Build §13; Supplement §8; owner R298 | The original 30.27.4 |
| 30.27.5 | Partial: v9 §228, §246, §250 | Build §14; Supplement §9; owner R298 | The original 30.27.5 |
| A, D, E, F/G, H, K, L, M, N, O, P | ✔ the §70.8 **summaries** (original Master 4218–4515; Build §58.5) | Build §16–§26; Supplement §10 | The **detailed** stage documents |
| B, C, I, J | — | Supplement §10 index (concepts; C's invocation gate) | All text |
| Q, R, S (+ §70.18) | ✔ complete (Build §58.5) | Build §27–§29 | — |

**Decision needed:**
- whether the owner's library holds any item in the third column;
- for each MISSING item, whether its RECOVERED DECISIONS / SPECIFICATION CONTENT is accepted as the working contract text.

### W6 — Evidence-based implementation audit (step 2)

**Method:**
1. For each of the 48 rows in `INVENTORY_AND_GAPS_2026-10-04.md` §C.2, cite the files, then the tests that exercise them, then — where applicable — a live observation.
2. Classify each row: RP / RT / LO / NP / UV, and PRECURSOR / NON-CONFORMANT / NONE.
3. Nothing becomes IMPLEMENTED without a test of the *target* contract.

**Current result:** 0 IMPLEMENTED · 32 PRECURSOR · 6 NON-CONFORMANT · 9 NONE · 1 mixed.

**Decision needed:** none. This runs as step 2 once step 1 closes.

---

## 4. Companies & Facilities Intelligence — Domain Pack record (R301-1)

| Field | Content |
|---|---|
| Kind | **Domain Pack / Intelligence Domain.** Not a numbered phase. Independent: it has its own ontology, sources and evaluation under Build §50. |
| Content preserved | Owner R298 description in full: Company / Organization / Subsidiary / Parent; Facility / Factory / Plant / Lab / Data Center / Mine / Port / Warehouse; ownership, control and partnerships; locations; products, capabilities and capacity **only with evidence**; suppliers, customers and partners; assets; filings, regulatory records, permits, announcements, research and EO; events and changes; entity resolution and identity confidence; "two similar names are not one entity without verification". Also Build §37 (legal identity, facilities fields, status timeline). |
| Linked domains (R301-1) | Technology Intelligence (Phase 28) · Supply Chain · Financial / Market · Geospatial / EO · Infrastructure · Resources / Materials · Events / Evidence · Web / News / Filings · Geopolitical Intelligence (Master section §28) |
| Status | SPECIFIED (content), **NOT IMPLEMENTED**. Repository precursors: companies, ownership, filings and procurement gateways (G33). There is no facility object. |
| Open | Its Build §50 domain-pack fields (`identity()`, `ontology()`, …, `version()`) are not yet written — RESEARCH / SPECIFICATION. |
