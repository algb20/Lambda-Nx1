# Lambda NX — Compatibility / Gap Ledger

| | |
|---|---|
| **Stage** | 30.27.8.RB — reconciliation (audit lane) |
| **Opened** | 2026-10-04, by owner direction (ledger R298, addendum rule 13) |
| **Purpose** | The single running ledger where every Blueprint ↔ Existing System difference and every specification conflict is recorded until it is decided. |
| **Detail lives in** | `INVENTORY_AND_GAPS_2026-10-04.md` (48-row mapping), `PACKAGE_INTAKE_2026-10-04.md`, `SUPPLEMENT_INTAKE_2026-10-04.md`, `RECONCILED_MASTER_BASELINE.md` (register) |
| **Code changed** | None |

---

## 1. Missing Specification Recovery Addendum — owner rules (R298, AGREED)

1. The Master Blueprint governs new architecture.
2. The existing repository is reality and is inspected separately.
3. Existing implementation is never claimed to satisfy Blueprint requirements without evidence.
4. SPECIFIED ≠ IMPLEMENTED.
5. Claude executes implementation; it does not own architecture or research.
6. Missing specification is not invented.
7. Existing implementation may be inspected and reported.
8. Architecture changes require a completed specification first.
9. World Pi requirements are not part of Lambda NX architecture.
10. Current repository technologies are **existing implementation constraints**, not automatically canonical architecture decisions.
11. Forecasting is part of Lambda NX intelligence architecture, kept separate from truth and canonical state.
12. All existing implementation is mapped against canonical contracts.
13. Conflicts are recorded in this ledger.
14. No destructive rewrite until an explicit migration or replacement decision exists.
15. Every implementation claim requires code and test evidence.

None of the fifteen conflicts with an earlier decision (R293–R297) or with CLAUDE.md.

---

## 2. Compatibility Matrix

The rows proposed by the owner come first, each with repository evidence and Claude's verification. Rows Claude adds follow, marked "+".

| Layer | Blueprint target | Existing System (evidence) | Owner's status | Verified status | Note |
|---|---|---|---|---|---|
| Pi / Authentication | Provider boundary (Build §2.4, §18) | Pi adapters isolated in `lib/auth/pi*`, `lib/payments/pi.ts`, two Pi routes, Pi client components. Standalone runs concurrently and bypasses the factory (RP, RT) | GAP | **GAP** (agreed) | Boundary *inventoried* (INVENTORY A.4), but no target auth-provider contract specified (E is IN PROGRESS). Factory registration = MR-13. |
| Next.js | Implementation technology | ^15.5.25 (RP) | EXISTING | **EXISTING** — constraint, not canonical decision (rule 10) | 15.5.27 available — D-01, awaiting a maintenance authorisation |
| Netlify / Vercel | Deployment | `netlify.toml` + scheduled function (RP). Production `lambdanx` (LO 2026-10-03). `vercel.json` present, but **no Vercel project** (LO 2026-08) | EXISTING | **EXISTING** (Netlify) / **CONFIG ONLY** (Vercel) | Production deploy lock = owner action |
| Supabase | Storage / backend | PostgreSQL 17.6; 24 tables, RLS 24/24 (LO 2026-10-03). Reached only through `lib/db` (postgres-js) | EXISTING | **EXISTING** | No Supabase SDK in app code (portability rule 4) |
| Drizzle | ORM | ^0.45.2; 24 migrations + journal (RP, RT) | EXISTING | **EXISTING** | — |
| API errors | RFC 9457 Problem Details (Build §10.6, §15) | `{ error }` in 56 of 84 routes; 0 `problem+json` (RP) | GAP | **GAP — NON-CONFORMANT** (G06) | Breaking change for clients; 30.27.6 is IN PROGRESS |
| Source connector | Canonical connector contract (Build §31: 14 capabilities) | `run(input, ctx)` only (RP) | GAP | **GAP** (G27) | Health taxonomy mapping is still open (CONF-S03) |
| Evidence | Evidence graph, L0–L7 gates, TruthStatus (Build §19, §32) | Admiralty A–F / 1–6; confidence by independent origins; 180 independence groups (RP, RT) | PARTIAL / MAPPING REQUIRED | **PARTIAL — MAPPING REQUIRED** (G16, G28) | Blocked on PI-01 (ladder A) |
| MCP | Current target protocol (Build §10.1, §56) | `2024-11-05`, 6 tools (RP) | GAP | **GAP** | The target version (2026-07-28) is beyond Claude's verification (CONF-A03) |
| Forecast | Governed intelligence capability (Build §41) | No forecasting engine. Calibration ledger of attributed forward-looking claims (RP, RT) | CONFLICT ("removed by old CLAUDE rule") | **Conflict RESOLVED; capability = GAP** | The CLAUDE.md rule was amended on 2026-10-03 (R293) and the Build Package §41 confirms it. What remains is the missing capability (G37) and a terminology question (D-03). |
| Phases 28–30 | Blueprint | Existing code | MUST AUDIT | **AUDITED at the precursor level** — 0 IMPLEMENTED | Phase 28 → G47; Phase 29 → G48 (per the verbatim source; see §3 SC-08); Companies & Facilities → G33; 30.26 → G01–G04; 30.27.x → G05–G14. Full rows in INVENTORY §C.2. |
| + Canonical objects | Build §9.1 / §30 | 24 application tables, 0 envelope fields | — | **NON-CONFORMANT** (G01) | Evolve the tables or add a canonical layer alongside — CONF-S01 |
| + Temporal / PIT | Build §9.5, §14.4 | Evidence publication time is dropped on persistence; world events are not persisted | — | **NON-CONFORMANT** (G03) | — |
| + AI Context Firewall | Build §43 | No licence or policy check before model context | — | **NON-CONFORMANT** (G39) | — |
| + Publication | Build §28 (R) | Autopublish AUTO-only — **paused** (R294) | — | **NON-CONFORMANT, paused** (G24) | — |

---

## 3. Specification conflicts

Each follows CONFLICT → EVIDENCE → IMPACT → PROPOSED RESOLUTION → APPROVAL.

### SC-08 — Phase 29 has three different identities — **major, OPEN**

| Source | Date | Phase 29 is |
|---|---|---|
| Build Package §8 + verbatim §58.3 (from library file `…v13_Phase_29_Live_Intelligence.md`) | 2026-10-04 | **Real-Time Intelligence Fabric + Live Coverage + Source Synchronization + Broadcast Intelligence** |
| Recovery Supplement §3 | 2026-10-04 | **Technology Intelligence** — shown in SC-01 to be the text of Master *section* §29 |
| Owner message (R298) | 2026-10-04 | **Companies & Facilities Intelligence** |

- **Evidence:**
  - The verbatim Phase 29 document opens with `# PHASE 29 — Real-Time Intelligence Fabric …`. It is followed by at least 68 subsections (29.0–29.68) on live data classes, freshness, watermarks, late data, backfill and broadcast. It carries `STATUS: SPECIFIED / AGREED — NOT IMPLEMENTED`.
  - None of those subsections is a Companies & Facilities phase.
  - Companies & Facilities appears in the Build Package as **section §37** ("Company & Facility Intelligence"). That section says "Phase 29/30 company coverage must ultimately model …", and Phase 28 text says "Technology Intelligence feeds Companies & Facilities Intelligence".
- **Impact:**
  - Adopting Companies & Facilities as Phase 29 would orphan a 68-section approved phase document: live intelligence, freshness and source synchronisation, which G48, G10 and G27 depend on.
  - Ignoring the owner's statement would silently override the owner.
- **Proposed resolution** (keeps everything, deletes nothing):
  - **Phase 29 = Real-Time / Live Intelligence**, as in the verbatim library document.
  - **Companies & Facilities Intelligence** = the domain specification in Build §37, with the owner's R298 description recorded there as an **extension**. That description adds:
    - Company / Organization / Subsidiary / Parent;
    - facility types (Factory / Plant / Lab / Data Center / Mine / Port / Warehouse);
    - ownership, control and partnerships;
    - capacity *only with evidence*;
    - suppliers, customers and partners;
    - permits and filings;
    - Entity Resolution and Identity Confidence;
    - "two similar names are not one entity without verification".
  - If the owner intends a numbered phase for Companies & Facilities, the research owner assigns it a number that does not collide with Phase 29.
- **Approval:** owner.
- **Status:** OPEN. Until it is decided, the records keep the verbatim source (rule 13: no change on a name difference until the project source proves it).

### SC-01 — Phase 28 (update)

- **Positions:** the owner (R298) states **Phase 28 = Technology Intelligence**, which matches the Build Package and its verbatim source. The Supplement's "Phase 28 = Geopolitical" is the text of Master section §28.
- **Status:** **RESOLVED** — Phase 28 = Technology Intelligence (owner statement + verbatim source). The Supplement's §2 is kept as Master section §28 (Geopolitical intelligence) content.
- **The owner's description adds (EXTENSION, for the research owner to fold into Build §7):**
  - named domains: AI, Robotics, Quantum, Space, Semiconductors, Energy, Materials;
  - the chain Technology → Company → Facility → Supply Chain → Market → Regulation → Research;
  - the lifecycle ظهور → بحث → تطوير → اختبار → تبنّي → إنتاج → توسع → تراجع/استبدال (emergence → research → development → testing → adoption → production → expansion → decline/replacement);
  - Patent ≠ Adoption, and Research ≠ Commercial Deployment.

### SC-02 — Status of 30.26 and 30.27.2–5 (update: three positions)

| Contract | Build Package | Supplement | **Owner (R298, latest)** |
|---|---|---|---|
| 30.26 | SPECIFIED — RECONSTRUCTED | SPECIFIED | **SPECIFIED** |
| 30.27.2 | SPECIFIED — RECONSTRUCTED | SPECIFICATION IN PROGRESS | **SPECIFICATION IN PROGRESS** |
| 30.27.3 | SPECIFIED — RECONSTRUCTED | SPECIFICATION IN PROGRESS | **SPECIFIED** (implementation not proven) |
| 30.27.4 | SPECIFIED — RECONSTRUCTED | SPECIFICATION IN PROGRESS | **SPECIFICATION IN PROGRESS** |
| 30.27.5 | SPECIFIED — RECONSTRUCTED | SPECIFICATION IN PROGRESS | **SPECIFIED** |

- **Proposed resolution:** the owner's statement is the latest, so the records adopt it. None of it is an IMPLEMENTED claim.
- **GAP-S1** (original wording) is unchanged. The SPECIFIED contracts rest on the reconstructed text.
- **Status:** **APPLIED** — owner's statuses recorded; confirmation welcome.

### SC-09 — The 30.26 canonical object list (two lists)

- **Lists:**
  - Build §9 / §30, and Supplement §4: Entity, Observation, Event, Claim, Evidence, Source, Relationship, Change, Signal, Hypothesis, Finding, Forecast, Scenario, Opportunity, ResearchGap, Question, Decision, Outcome.
  - Owner (R298): Entity, Observation, Source, **SourceArtifact**, Evidence, Claim, Relationship, Event, Change, Signal, **Situation**, Hypothesis, **Inference**, Forecast, Scenario, **Alert**, **Research**, **Job**, **Workflow**, **Agent**, **Tool**, **Artifact**, **Provenance**, **Coverage**, **Uncertainty**.
- **Differences:**
  - **Only in the owner's list:** SourceArtifact, Situation, Inference, Alert, Research, Job, Workflow, Agent, Tool, Artifact, Provenance, Coverage, Uncertainty. Most of them already exist as concepts elsewhere in the Build Package (§10.4 jobs, §16 agents, §22 situation and inference, §25 alert, §28 artifact, §9.3–9.4 uncertainty and provenance).
  - **Only in the Build list:** Finding, Opportunity, ResearchGap, Question, Decision, Outcome.
  - The owner's rules — one canonical schema per concept, `schema_version` mandatory, and Evidence ≠ Claim ≠ Canonical Truth — agree with Build §9 and add explicit wording.
- **Proposed resolution:** treat the canonical set as the **union** (31 types). Nothing is removed. The research owner confirms that the union is intended and states each type's canonical owner (S §69.13).
- **Approval:** research owner.
- **Status:** OPEN.

### A–P (owner, R298)

- The owner confirms that the verbatim text of A–P is not available in the current context, and that it will not be invented.
- The recovered scope agrees with Build §16–§26 and the Supplement §10: agent schema, capability, tool, model and instruction binding; trust; descriptor; context firewall; execution; invocation; handoff; security; evidence; provenance; verification; promotion; event → inference; temporal/causal.
- **GAP-S2:** confirmed **RECOVERY REQUIRED**. The required action is the owner's: put the final approved A–P into the Build Package.

### Carried forward, unchanged

| ID | Item | Status |
|---|---|---|
| PI-01 / CONF-V01 | Ladder A | OPEN |
| SC-03 | M pointer vs S | OPEN — owner decision 2 stands |
| SC-04 | Letters B, C, I, J | OPEN |
| GAP-S3 | §70.18 not in §29 | OPEN |
| CONF-S01 | Tables vs canonical layer | OPEN |
| CONF-S03 | `cached` / `empty` | OPEN |
| D-03 | Calibration "forecast" terminology | OPEN |

---

## 4. Running counts

| | Count |
|---|---|
| Matrix rows (§2) | 15 — EXISTING 4 (+ Vercel config only) · GAP 4 · PARTIAL 1 · NON-CONFORMANT 5 · audited 1 |
| Conflicts open | SC-08, SC-09, SC-03, SC-04, PI-01, GAP-S1–S4, CONF-S01, CONF-S03, D-03 |
| Conflicts resolved this round | SC-01 (Phase 28); SC-02 (statuses recorded); the Forecast row |
| IMPLEMENTED against the Blueprint | **0** |

---

## 5. Decision record — 2026-10-04 (ledger R300)

### SC-08 — Phase 29 → **RESOLVED (owner decision)**

> «اعتمد Phase 29 = Live Intelligence كما في النص الحرفي»

| Item | Decision / effect |
|---|---|
| **Phase 29** | **Live Intelligence** — the verbatim document: `# PHASE 29 — Real-Time Intelligence Fabric + Live Coverage + Source Synchronization + Broadcast Intelligence`. Build Package §58.3, lines 4047–6780, 29.0–29.109, `SPECIFIED / AGREED — NOT IMPLEMENTED`; library source `…v13_Phase_29_Live_Intelligence.md`. |
| Supplement §3, "Phase 29 — Technology Intelligence" | **Superseded as a phase label.** Its text is kept as the content of Master **section** §29 (Technology intelligence), as SC-01 already did for §28. Nothing is deleted. |
| Owner's R298 "Phase 29 — Companies & Facilities Intelligence" | **Superseded as a phase label.** The description is **kept in full**. In the Build Package, Companies & Facilities is domain section §37. **Still OPEN:** whether the description becomes an extension of §37 or a separately numbered stage. That question was not part of this decision and is not assumed. |
| Implementation | Unchanged: **NOT IMPLEMENTED**. Precursor code only (G48). |
| Code | None changed |

**Phase identities now settled:**
- Phase 28 = Technology Intelligence (SC-01, R298).
- Phase 29 = Live Intelligence (SC-08, R300).

## 6. Source licensing (R317, 2026-10-05)

Full audit: `SOURCE_LICENSING_GAP_AUDIT_2026-10-05.md`. Registry: `lib/engine/licensing/source-licence-registry.json`.

| ID | Existing System | Target (Master) | Status | Decision path |
|---|---|---|---|---|
| GL-01 | 188 catalogue licences without stored evidence → **all read in R318** (batch 11); 73 terms pages unreadable, reason dated | Every source licence evidenced (§31) | GAP narrowed (REPO-TESTED: no unevidenced record) | Research the 73 |
| GL-05 | Registry enforced by conformance test | Runtime policy (§31, §46, E) | GAP | BC-2, BC-3 |
| GL-06 | No terms-change detection | Recheck incl. terms (§31) | GAP | BC-5 |
| GL-08 | AI/ML use NOT_STATED for all sources | Context Firewall (E) | GAP — DECISION REQUIRED | BC-4 |
| GL-09 | Several capabilities without verified fallback | Resilience (§45), independence (J) | GAP | BC-7 |
| GL-10 | Username-presence check (HIGH personal-data risk) | Charter §3 | DECISION REQUIRED | Owner |
| GL-13 | OGL-licensed sources carrying personal data (Gazette, Companies House) | Charter §3; data minimisation | GAP | Personal-data filter or owner decision |
| GL-14 | A catalogue feed hosted by an unofficial re-publisher (withheld) | Provenance (§31) | GAP | Catalogue rule: host belongs to publisher |
