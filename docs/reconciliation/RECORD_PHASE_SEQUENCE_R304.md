# Reconciliation Record — Phase sequence (R304)

| | |
|---|---|
| **Date** | 2026-10-04 |
| **Authority** | Owner decision, ledger R304 |
| **Purpose** | One record linking R300, R301-1, Phase 28, Phase 29 Live Intelligence (verbatim), Phase 30 Contract Closure, the Supply Chain specification and 30.25 → 30.26 → 30.27. It resolves GAP_CONFLICT_LIST items C2 and C3 and X5. Only after it is CLAUDE.md updated. |
| **Implementation effect** | **None.** Nothing becomes IMPLEMENTED because of this correction. Every item keeps its specification status until code and test evidence exist. |
| **Code changed** | None |

---

## 1. Final rule (owner, R304)

```
Phase 29 = Live Intelligence
Phase 30 = Contract Hardening / Closure
Supply Chain ≠ Phase 30
Companies & Facilities ≠ replacement for Phase 29
Live Intelligence specification = retained and authoritative historical/current specification,
                                  with later integration mapping where applicable
```

**The working point is unchanged.** Work continues from the Phase 30 contracts — 30.25 → 30.26 → 30.27, then closure and verification (30.27.8.S) before any move to Phase 31. The phases are not re-ordered.

**Cause of the C2/C3 question, recorded by the owner.** It arose from lost or mixed document versions. Nothing justifies converting Phase 29 to Companies & Facilities retroactively, and the Phase 28 and Phase 29 decisions are not to be reopened from scratch.

---

## 2. The linked items

| # | Item | Canonical position (R304) | Source evidence | Text class (R302) | Status |
|---|---|---|---|---|---|
| L1 | **R300** — "Phase 29 = Live Intelligence, per the verbatim text" | **Confirmed** by R304 | Ledger R300 | — | Owner decision in force |
| L2 | **R301-1** — Companies & Facilities is a Domain Pack, not a phase | **Confirmed** by R304. Placed in the Master as an Intelligence Domain linked to Technology Intelligence and the World Model. Prior work is **not deleted**. | Ledger R301; `CANONICAL_RECONCILIATION.md` §4 | CONSOLIDATED (Build §37 + owner R298 description + Build §50) | SPECIFIED (content) · NOT IMPLEMENTED |
| L3 | **Phase 28 — Technology Intelligence** | Phase 28 | Build §58.2 `# PHASE 28 — Technology Intelligence …` (lines 3183–4046); library `…v12_Phase_28_Technology_Intelligence.md` | **SOURCE-PRESERVED** | SPECIFIED / AGREED · NOT IMPLEMENTED |
| L4 | **Phase 29 — Live Intelligence** | Phase 29 — **retained and authoritative**, never deleted or replaced | Build §58.3 `# PHASE 29 — Real-Time Intelligence Fabric + Live Coverage + Source Synchronization + Broadcast Intelligence` (lines 4047–6780; 29.0–29.110); library `…v13_Phase_29_Live_Intelligence.md`; Build §8 summary | **SOURCE-PRESERVED** | SPECIFIED / AGREED · NOT IMPLEMENTED |
| L5 | **Phase 30 — Contract Hardening / Closure** | Phase 30 = 30.25 → 30.26 → 30.27 (→ 30.27.8 A … S) → closure / verification → only then Phase 31 | Build §0.0, §6, §55; original Master §69.3, §69.11, §70.14, §70.16; rules file line 533 | Sequence: SOURCE-PRESERVED | NOT COMPLETE · Phase 31 BLOCKED |
| L6 | **30.25 Gap Audit** | First step of Phase 30 | Referenced in rules file line 613 ("completed/specification state") and Supplement line 265 | Text: SOURCE-MISSING (not in supplied files) | Recorded / completed (as stated) |
| L7 | **30.26 Data Contracts** | Second step | Build §9; Supplement §4; owner R298; v9 §213–§237 | RECONSTRUCTED / CONSOLIDATED | SPECIFIED · NOT IMPLEMENTED |
| L8 | **30.27 Interface Contracts** (+ 30.27.2–6, 30.27.8 A … S) | Third step; S is the closure gate | Build §10–§29; §58.5 (Q, R, S verbatim) | Mixed — see `CANONICAL_RECONCILIATION.md` §5.3 | RESEARCHED / SPECIFICATION IN PROGRESS · S BLOCKED (Build §29.4) |
| L9 | **Supply Chain specification** | **Domain / Intelligence coverage** — not Phase 30. It is not moved above the contracts and does not change the resumption point. | Original Master section **§24 "Supply-chain intelligence"** (line 446); handoff §23 "ECONOMIC / COMPANY / SUPPLY CHAIN" (original Master line 5150; rules file line 873); Build **§38 "Supply Chain Intelligence"** (line 2470); the verbatim Phase 28 text names **"Phase 25 supply-chain intelligence"** (Build line 3393) | Sections: SOURCE-PRESERVED. A Phase 25 document: SOURCE-MISSING (not supplied). | SPECIFIED (as domain coverage) · NOT IMPLEMENTED (repository precursors: corridors and impact analysis, G34) |
| L10 | **Companies & Facilities** (link to L2) | Domain Pack after or alongside Phase 29 in the sector expansion. **Not** a redefinition of Phase 29. | as L2 | as L2 | as L2 |

### 2.1 Superseded labels (kept as history, not deleted)

| Label | Where it appeared | Standing now |
|---|---|---|
| "Phase 29 — Technology Intelligence" | Recovery Supplement §3 | Superseded as a phase label. The text is Master *section* §29 content (SC-01, SC-08). |
| "Phase 29 — Companies & Facilities Intelligence" | Owner R298; owner R303 continuity list | Superseded as a phase label (R300, R301-1, R304). The content lives in the C&F domain pack (L2). |
| "Phase 30 — Supply Chain Intelligence" | Owner R303 continuity list | Superseded (R304). Supply Chain is domain coverage (L9). |

---

## 3. Phase 29 Live — integration / coverage mapping (CANDIDATE)

R304 says: "If there are Live capabilities that were later distributed or merged into other layers, this is documented as integration/coverage mapping, not as deletion of the original specification."

The table below lists, **at heading level only**, where a Phase 29 subsection's concern is *also* addressed by a later contract. It is a **candidate** mapping for consolidation in S. It changes no text, and no Phase 29 subsection is retired by it.

| Phase 29 subsection (Build §58.3) | Also addressed in | Build section |
|---|---|---|
| 29.4 Live Connector Contract | Source Control Plane — connector capabilities | §31 |
| 29.5 Stream State Machine; 29.82 Client Synchronization | 30.27.3 sync lifecycle and degraded states | §12 |
| 29.6–29.8 Freshness Contract / Classes / Status | Phase 29 summary; source registry freshness | §8.2; §31 |
| 29.9 Stream Watermarks; 29.10 Event-Time Processing; 29.11 Late Data | 30.27.3; M temporal model | §12; §23.1 |
| 29.12 Retractions and Corrections | H promotion (retraction, supersession); F/G supersession | §20; §19 |
| 29.13 Transactional Streaming Boundary | 30.27.5 idempotency | §14.1 |
| 29.15 Live Event Envelope | K event semantics; Event API / CloudEvents | §21; §10.5 |
| 29.17 Event Cluster; 29.78 Real-Time Situation Object; 29.79 Situation Lifecycle | L Event → Signal → Situation | §22 |
| 29.36 Stream Failure Architecture; 29.37 Gap Accounting | 30.27.6 errors; invariant "missing data ≠ no event" | §15; §29.3 |
| 29.47–29.50 Live-to-Research / Forecast / Scenario / Publication triggers | N trigger orchestration; R publication | §24; §28 |
| 29.52 Coordinated Multi-View; 29.83 Visualization Delta Updates | Q workspace / multi-view sync | §27 |
| 29.59 Source Health Center | Source health taxonomy | §31 |
| 29.80 Live Alert Contract Integration | O monitoring / watch / alert | §25 |
| 29.81 Live Intelligence APIs | 30.27 REST / Job / Event APIs | §10 |
| 29.87 Broadcast/Source Licensing; 29.89 Live Security | Licence (source registry); legal boundary; E security boundary | §31; §46; §18 |
| 29.91 Live Data vs Historical Reconstruction; 29.92 Replay Engine; 29.93 Simulation vs Replay | 30.27.3 replay; 30.27.5 point-in-time | §12.5; §14.4 |
| 29.20–29.22 Resource World Model, Gold reference | Resources / materials domain | §35 |
| 29.70 Live Aviation; 29.71 Live Maritime Synchronization | Maritime / aviation / infrastructure domain | §34 |
| 29.73 EO Near-Real-Time Integration | Geospatial / EO | §33 |

Subsections with **no** counterpart in a later contract stay solely under Phase 29. Examples: 29.30–29.34 broadcast and breaking-event lifecycle; 29.35 and 29.95 SLOs; 29.62 premium-source abstraction; 29.74–29.77 feed discovery, certification, redundancy and evidence freeze; 29.84–29.86 rendering and accessibility; 29.96 blind spots.

Confirming the mapping is an **S consolidation item**.

---

## 4. Effect on other records

| Record | Change |
|---|---|
| `GAP_CONFLICT_LIST_2026-10-04.md` C2 | **RESOLVED** — Phase 29 = Live Intelligence (R304) |
| `GAP_CONFLICT_LIST_2026-10-04.md` C3 | **RESOLVED** — Phase 30 = Contract Hardening / Closure. Supply Chain = domain coverage (R304). |
| `GAP_CONFLICT_LIST_2026-10-04.md` X5 | **RESOLVED** — CLAUDE.md updated after this record (§5) |
| `COMPATIBILITY_GAP_LEDGER.md` SC-08 | Already resolved (R300); reaffirmed by R304 |
| Working point | Unchanged: the Phase 30 contracts; resumption at 30.27.8.S (R302) |
| Implementation status of every item | Unchanged — NOT IMPLEMENTED / NOT VERIFIED |

---

## 5. CLAUDE.md update made with this record

Only §7 "Phase state" changes. It now states:
- Phase 28 = Technology Intelligence;
- **Phase 29 = Live Intelligence** — the verbatim specification is retained and authoritative;
- **Phase 30 = Contract Hardening / Closure** (30.25 → 30.26 → 30.27 → S);
- **Supply Chain ≠ Phase 30**, and **Companies & Facilities ≠ a replacement for Phase 29** (both are domain coverage);
- the working point is unchanged.

No other CLAUDE.md section conflicts with the Master on these points. §1's forecasting text and §2 rule 8's source target were checked against Build §41 and §51 and agree with them.
