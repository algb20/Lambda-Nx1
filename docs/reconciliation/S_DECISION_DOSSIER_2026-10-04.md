# 30.27.8.S — Open-Question List (Claude-prepared; NOT a source)

> **Status correction — owner R308, 2026-10-04.** This file is **not** a project source and holds **no decisions**.
> It was written by Claude on 2026-10-04 (R307) as a list of eight open questions, drawn from earlier conflict records (GAP-S1, SC-09, CONF-S01, R302 W2 and W1, R302 §5.1, R304 §3, CONF-S03).
> No original "S decisions" document has been supplied to Claude. **That source is MISSING SOURCE.**
> Per R308 these questions are **not** pending owner decisions now. They are **DEFERRED** until the Master reconciliation, which the owner leads.
> The "Proposed" lines below are Claude's suggestions only. They must not be cited as decisions, adopted, or treated as a source for the reconciliation.

| | |
|---|---|
| **Prepared** | 2026-10-04, ledger R307 ("اعمل المطلوب بنفسك") |
| **What this is** | Claude's list of the open questions S would need answered, with evidence and options. **Not a source, not a decision** (see the status correction above). |
| **What this is not** | Architecture by Claude. Every "Proposed" line is a recommendation awaiting approval. Nothing here is adopted, and no specification text is invented: where a source is missing, the entry says so. |
| **Why S needs it** | Build Package §29.4: "S is **BLOCKED** until all required source contracts are supplied/consolidated and all unresolved conflicts have explicit decisions." §55: no implementation package until S confirms closure. |
| **Code changed** | None by this document |

---

## D1 — Working contract text for 30.26 and 30.27.2–5 (GAP-S1)

| | |
|---|---|
| **Question** | Which text is the working contract for 30.26 and 30.27.2–5? |
| **Evidence** | **Build Package:** §9, §11–§14, labelled "SPECIFIED — RECONSTRUCTED/CONSOLIDATED … not a claim of byte-for-byte recovery". **Recovery Supplement:** §4–§9, a second reconstruction. **v9 contract-hardening source**, verbatim extract (Build §58.4): §213–§237 and §238–§273. **Owner statuses (R298):** 30.26 and 30.27.3/.5 SPECIFIED; 30.27.2/.4 IN PROGRESS. **The originals were not supplied to Claude.** |
| **Options** | (a) Adopt Build §9 and §11–§14 as the working text, folding in the Supplement's extensions (`SUPPLEMENT_INTAKE` §3). (b) Wait for the originals from the library. (c) Adopt (a) now, and reconcile against the originals if they are found. |
| **Proposed** | **(c).** It unblocks consolidation without claiming ORIGINAL status. The text class stays RECONSTRUCTED / CONSOLIDATED (R302). |
| **Consequence** | 30.27.2 and 30.27.4 stay SPECIFICATION IN PROGRESS until their open points are decided. For 30.27.4 that is version placement and sunset policy, which the Supplement §8 marks RESEARCH / DECISION REQUIRED. |

## D2 — The canonical object set for 30.26 (SC-09)

| | |
|---|---|
| **Question** | Which canonical object types exist, and which layer owns each? |
| **Evidence** | **Build §9 / §30:** 18 types — Entity, Observation, Event, Claim, Evidence, Source, Relationship, Change, Signal, Hypothesis, Finding, Forecast, Scenario, Opportunity, ResearchGap, Question, Decision, Outcome. **Owner R298** adds 13: SourceArtifact, Situation, Inference, Alert, Research, Job, Workflow, Agent, Tool, Artifact, Provenance, Coverage, Uncertainty. **S §69.13** (verbatim) already names owners for several: World Model, Evidence Layer, Provenance Layer, Event Registry, Orchestration, Job layer, Workflow Registry, Agent Registry, Tool Registry, Workspace, Context, Attention, Artifact, Decision. |
| **Options** | (a) The union of 31 types. (b) The Build list only. (c) The union, with a split between persistent canonical objects and execution / runtime objects. |
| **Proposed** | **(c).** Some of the owner's additions are runtime objects with their own registries in S §69.13 — Job, Workflow, Agent, Tool. Others are attributes in Build §9.3–§9.4 — Provenance, Uncertainty. The split keeps "one canonical owner per object" (S invariant 1). **The research owner assigns each type its class and owner.** |

## D3 — Evolve the 24 tables, or add a canonical layer alongside (CONF-S01)

| | |
|---|---|
| **Question** | How does the Existing System's data reach the canonical envelope (Build §9.1)? |
| **Evidence** | 24 application tables with **0** envelope fields (audit G01). Owner rules: no rewrite (R296), no destructive change without an explicit migration decision (R298-14), and Current → Target → Migration contracts (R301-2). Build §5: "a current precursor can be reused only after it is mapped to the canonical contract and tested". |
| **Options** | (a) **Additive canonical layer** beside the application tables. Application tables remain projections, filled through promotion (H). (b) **Evolve in place** — add envelope columns to existing tables by migration. (c) **Hybrid** — canonical layer for World Model objects; evolve-in-place for the application's own records (users, posts, preferences). |
| **Proposed** | **(c), with (a) for anything that is World Model truth.** It honours "no destructive rewrite". It keeps the application running. It respects "a projection never becomes the canonical owner" (S §69.13). It needs a migration contract per table (Build §53). |
| **Risk** | Two stores to keep consistent: projections must be derived from the canonical layer, never written beside it (S invariant 2). |

## D4 — Verification-Level Crosswalk (R302 W2)

| | |
|---|---|
| **Question** | What does the crosswalk contract record for each verification framework? |
| **Owner rule** | Preserve first, reconcile in S. No numeric conversion is invented. |
| **Evidence — field values taken only from sources** | See the table below. |

| Framework | Name / scale (source) | Purpose (as stated) | Scope of use (as stated) | Transition conditions | Relation to others | Conversion class |
|---|---|---|---|---|---|---|
| Ladder A | `0 UNVERIFIED … 6 STABLE_CONFIRMED` (v9 §226, Build line 7348) | "Verification level is not a truth probability" (v9 §226) | Claims / evidence diversity (v9 §226) | **SOURCE-MISSING** — v9 states levels, not transitions | Not stated | **TO BE DECIDED** |
| L0–L7 gates | `L0 Unprocessed … L7 Canonically Promoted` (Build §19; 10-03 addendum §7) | "gates, not truth probabilities" (Build §19) | Evidence pipeline, through to canonical promotion (Build §19–§20) | The pipeline order in Build §19 (structural → integrity → provenance → policy/licence → semantic/temporal/spatial → …) | Not stated | **TO BE DECIDED** |
| TruthStatus | OBSERVED … UNKNOWN, 11 values (Build §32; original Master ~2273) | Claim truth status; "TruthStatus is not a probability" (10-03 addendum §7) | Claims | **SOURCE-MISSING** | "Admiralty and the Master verification ladder remain separate systems" (Build §32) | **TO BE DECIDED** |
| Admiralty | A–F / 1–6 (repository, RT) | "source/info reliability convention used by existing intelligence outputs" (Build §32) | Existing-System evidence and catalogue | n/a (an assessment, not a ladder) | Separate from the ladder (Build §32) | **NOT ALLOWED** into the ladder — already decided (Build §32; R302) |
| Repository confidence grade | confirmed / probable / possible / unconfirmed (RT) | Existing-System grade | Existing evidence | Code rule: `gradeConfidence`, by independent origins | Preserved historically (baseline §7.3) | **TO BE DECIDED** (historical values are never rewritten) |

**Proposed:** none on conversion classes. They are research-owner decisions. The transitions marked SOURCE-MISSING must be supplied or specified.

## D5 — F / G separation and B, C, I, J (R302 W1)

| | |
|---|---|
| **Evidence** | Only a **merged** F/G text exists (Build §19; §70.8 F/G). The Supplement §10 gives separate *descriptions*: F = tool result / artifact boundary; G = verification / corroboration / truth status. B and C exist as concepts only (B: runtime / execution; C: tool contract / invocation gate). I is MISSING. J exists conceptually (source independence graph). |
| **Options** | (a) Split the merged F/G text along the Supplement's line: F = Tool Result → Structural / Integrity / Provenance / Policy; G = Observation → Evidence → Independence → Corroboration → TruthStatus. (b) Keep it merged until the originals are found. |
| **Proposed** | **(a) as a CONSOLIDATED text**, with the split point taken from the Supplement's own descriptions. B, C and J specified from their concept text as RECONSTRUCTED. **I stays MISSING — must not invent.** |
| **Note** | J's content overlaps the repository's independence groups (`lib/engine/catalog/origins.ts`, 180 groups, RT) — a precursor, not an implementation. |

## D6 — Forecast chain vs the L pipeline (R302 §5.1)

| | |
|---|---|
| **Evidence** | **L (Build §22):** EVENT → CHANGE → PATTERN → SIGNAL → SITUATION → HYPOTHESIS → RESEARCH → CORROBORATION → INFERENCE → ASSESSMENT → FORECAST / SCENARIO / ALERT. **Owner chain (R302):** EVENT → CHANGE → SIGNAL → SITUATION → HYPOTHESIS → RESEARCH → INFERENCE → ASSESSMENT → FORECAST → SCENARIO → DECISION. **S §69.52** (verbatim): … INFERENCE → MONITOR → ATTENTION → WORKSPACE → DECISION → ARTIFACT → PUBLICATION. |
| **Options** | (a) The owner chain is a *view* of L with PATTERN and CORROBORATION implied, and DECISION taken from S §69.52. (b) Merge them into one chain. |
| **Proposed** | **(a).** One canonical pipeline: L's full form, continued by S §69.52 after ASSESSMENT. FORECAST and SCENARIO are parallel outputs of ASSESSMENT, never inputs to canonical truth (R302 W4). ALERT belongs to O (monitoring), and DECISION to P/Q (§69.52). No step is dropped. |

## D7 — Phase 29 Live coverage mapping (R304 §3)

| | |
|---|---|
| **Evidence** | 19 candidate pairs, at heading level, in `RECORD_PHASE_SEQUENCE_R304.md` §3. |
| **Proposed** | Confirm the mapping as **coverage**: the later contract implements the shared concern, and Phase 29 remains the requirement source. No Phase 29 subsection is retired. |

## D8 — `cached` and `empty` in source health (CONF-S03)

| | |
|---|---|
| **Evidence** | The repository uses `ok / cached / empty / failed` (RT). The target health set is HEALTHY / DEGRADED / SLOW / STALE / FAILING / OFFLINE / UNKNOWN (Build §31). Rules: "Source health ≠ source quality" (Supplement §4); "Missing data is never treated as no event" (Build §29.3, invariant 15). Live today: 35 feeds answered empty and 0 were served from cache (`/api/diagnose`). |
| **Options** | `cached` → (a) a **freshness** attribute, not a health state; or (b) mapped to STALE when it is beyond the freshness class. `empty` → (a) HEALTHY with an explicit "no items" observation; or (b) UNKNOWN. |
| **Proposed** | `cached` → **(a) + (b)**: a freshness attribute, which becomes STALE only past its freshness class (Phase 29 §29.6–29.8). `empty` → **(a)**, recorded as an observation, *never* as "no event" (invariant 15). |

---

## Summary

| # | Decision | Proposed | Owner |
|---|---|---|---|
| D1 | Working contract text | (c) adopt the reconstructed text now; reconcile against the originals later | Owner |
| D2 | Object set | (c) union, split into canonical / runtime, with owners assigned | Research owner |
| D3 | Tables vs canonical layer | (c) hybrid, with an additive canonical layer for World Model truth | Owner |
| D4 | Verification crosswalk | Fields filled from sources; conversion classes left open | Research owner |
| D5 | F/G, B, C, I, J | Split F/G (CONSOLIDATED); B, C, J RECONSTRUCTED; I MISSING | Research owner |
| D6 | Forecast chain vs L | One pipeline: L + S §69.52; forecast and scenario as outputs | Owner |
| D7 | Live coverage mapping | Confirm as coverage | Owner |
| D8 | `cached` / `empty` | Freshness attribute / observation, never "no event" | Research owner |
