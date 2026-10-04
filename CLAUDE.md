# Lambda NX — Execution Charter & Working Rules

> This file is the durable **execution and execution-governance** contract for the
> repository. It is read at the start of every session. Follow it exactly. It
> governs *how* the repository is built and operated. It is **not** the
> architectural reference — that is the Master Living Implementation Blueprint —
> and it never competes with it.

## 0. Precedence and status (owner decisions, 2026-10-03 — ledger R293)

**Order of authority**, highest first:

```
MASTER LIVING BLUEPRINT
→ APPROVED PHASE SPECIFICATION
→ TASK HANDOFF
→ CLAUDE.md IMPLEMENTATION RULES (this file)
→ CODE
```

Nothing in this file cancels a Master requirement. Where this file and the Master
disagree, record a conflict (§7) — do not resolve it by choosing.

**SPECIFIED ≠ IMPLEMENTED.** Use the status words only with the evidence each
requires:

| Status | Requires |
|---|---|
| IMPLEMENTED | code exists for the specified contract |
| INTEGRATED | it is wired into the running system |
| TESTED | its tests exist and pass |
| EVALUATED | its evaluation has been run |
| ACCEPTED | it passed the Master acceptance gate |

Repository facts are reported with the evidence classes of
`docs/reconciliation/RECONCILED_MASTER_BASELINE.md` §0.2: REPO-PRESENT, REPO-TESTED,
LIVE-OBSERVED (dated), NOT PRESENT, UNVERIFIED. Repository tests prove repository
behaviour. They are not Master acceptance.

**Three layers, never mixed:**
- Existing System — what the repository and deployments contain.
- Master Specification — the target.
- Claude Execution Contract — this file.

The current reconciled state is in `docs/reconciliation/`.

**Owner handoff of 2026-10-04** (`docs/reconciliation/PACKAGE_INTAKE_2026-10-04.md`).
The owner holds both documents. The repository is public, so it stores their
fingerprints only:
- **Build Package** — `Lambda_NX_MASTER_RECONCILED_CLAUDE_BUILD_PACKAGE_2026-10-04.md`. The
  reconciled Master target, sha256 `6a056334…`.
- **Execution Package** — `Lambda_NX_CLAUDE_EXECUTION_PACKAGE_2026-10-04.md`, sha256
  `4569844a…`.

The Execution Package is the owner's execution contract. This file adds the repository
specifics: branch, ledger, lanes and live-system rules. Where the two differ, the
Execution Package governs. In particular, follow its:
- pre-coding checklist (§6);
- stop conditions (§32);
- implementation report format (§31).

A Master subsystem is coded only from a task sheet in the Build Package §53 format.

**Incremental development (owner rules R296, 2026-10-04):**
- Lambda NX exists and evolves incrementally. There is no rewrite.
- Existing code is mapped to the target. It is never assumed to conform:
  `docs/reconciliation/INVENTORY_AND_GAPS_2026-10-04.md`.
- A gap does not stop the project. It moves through
  `GAP → RESEARCH REQUIRED → SPECIFICATION → CONTRACT → IMPLEMENTATION → TEST → ACCEPTANCE`.
  Only implementation of the affected part waits.
- Conflicts move through `CONFLICT → EVIDENCE → IMPACT → PROPOSED RESOLUTION → APPROVAL`.
- Architecture is never changed because a name, version or implementation detail
  differs, until the official or project source proves it.
- Current repository technologies (Next.js, Netlify/Vercel, Supabase, Drizzle, Pi
  adapters) are **existing implementation constraints**, not canonical architecture
  decisions (R298).
- No destructive rewrite happens until an explicit migration or replacement decision
  exists (R298).
- Every Blueprint ↔ Existing System difference and every specification conflict goes in
  `docs/reconciliation/COMPATIBILITY_GAP_LEDGER.md` until it is decided.

## 1. What this project is

> This section describes the **current implementation surface** (the Existing
> System). The product's target identity and architecture are defined by the
> Master.

Lambda NX is a **real, legal, multi-gateway intelligence platform**. Its first and core
family is **OSINT & intelligence-analysis**; the *same engine* powers additional lawful
intelligence families ("gateways") — **threat (CTI)**, **financial / sanctions /
corporate**, **geospatial / transport** — plus an **AI-analyst layer** that triages and
summarizes results. It runs as a Pi Network app (Pi auth + Pi payments) **and** as a fully
independent standalone web app/site (standard auth + standard payments) from the same
codebase.

It is an *analysis* product, not a data dump: its value is in **pivoting, verification,
confidence grading and documentation** — applying real intelligence-analysis method,
not wrapping tools.

**Design preservation.** We build on the existing app's visual design and shell (Next.js +
shadcn/ui + its tab layout). We *realize* the fake features as real ones — we do not
redesign. New gateways reuse the same UI language.

**Continuity of intent.** We did not change the app's original goal (an intelligence /
monitoring / analysis platform). We merged and organized what the app aimed at, the OSINT
reference and our research into a *real* version. We removed only what was impossible or
unlawful:
- **unevaluated future predictions presented as fact** (the original app's fake
  "forecasts");
- "quantum/agentic swarm" claims;
- mass surveillance.

Governed forecasting stays in the Intelligence Core as the Master specifies (§19–§20). It
must be calibrated, evaluated, point-in-time and carry explicit uncertainty, with
**Forecast ≠ Scenario ≠ Truth ≠ Event**. No forecasting engine exists in the repository
today.

**Monetization (future).** Subscription tiers (free + paid), gated through the payments
layer: free gives core access with limits; paid unlocks all gateways, the AI-analyst,
monitoring and higher rate limits. Studied in `docs/GATEWAYS.md`.

Reference domain knowledge: `docs/OSINT_REFERENCE.md` (13-chapter, 20-discipline). New
families **extend, never replace** this method. Family roadmap: `docs/GATEWAYS.md`.

## 2. Governing rules (never violated)

1. **No temporary solutions.** Every point is built *finally*. A module is "done" only
   when it: works for real, is tested with real tests, handles errors and edge cases,
   is documented, and contains **no `TODO`/mock/`Math.random()` placeholders**. See §6.
2. **Research boundary.** Architecture research and adoption decisions belong to the
   research stage and the Master, not to Claude.
   - Claude verifies the facts needed to implement an *already specified* contract, for
     example a specified source's live response shape.
   - Claude reports anything else it observes as **DISCOVERED**, with evidence, and never
     adopts it on its own. The Radar (`docs/RADAR.md`) gathers such observations.
   - Specification text Claude does not have is never guessed. A dependent item is
     recorded as one of:
     - **NOT SUPPLIED TO CLAUDE** — the text exists in the owner's library, but no one
       has handed it over;
     - **BLOCKED — SOURCE SPEC MISSING** — the text is confirmed absent.
3. **Our own technology.** We build our own engine, algorithms, storage and analysis —
   not a thin wrapper over someone else's product. Inspire from the best, then build
   stronger in our own way.
4. **Safe portability (no lock-in).** Every external provider sits behind an interface
   we own, so we can swap **database (Supabase↔any Postgres), hosting (Netlify↔Vercel↔
   self-host), and Pi-vs-standalone auth/payments** with a provider switch only — never
   an app rewrite. See `docs/ARCHITECTURE.md`.
5. **Living task list.** The repository backlog is tracked in the task tool and mirrored
   in `docs/PLAN.md`. Update it on every step. Never skip a point or a test.
   - "Done" in `docs/PLAN.md` means at most REPO-PRESENT + REPO-TESTED.
   - Master statuses are set only through the Master's own gates (§0).
6. **One engine, many gateways.** Every new capability is a new source/family over the
   *same* engine (guardrail + registry + analysis core) — never a parallel stack. The
   passive-only and legal guardrails (§3) apply to every family, always.
7. **Preserve the design.** Keep the existing shell and visual language; realize fake as
   real without redesigning (see §1).
8. **Beat the field, permanently.**
   - **Ownership:** continuous study of the field is a research-stage duty. Its findings
     reach the code only through the Master and an approved specification (§0, rule 2).
   - **Source target:** the "one million" figure is reported only as **labelled reach, by
     unit**, never summed across units (`lib/engine/catalog/families.ts`, `ReachUnit`).
     The owner decided to **keep** the target (2026-10-03, R294; CONF-G06). The plan and
     the proposed honest acceptance bar — at least 1 M live publishers *excluding the
     single largest family* — are in `docs/reconciliation/SOURCE_POPULATION_PLAN.md`.

   The original instruction, kept for the record:
   - **Source population is a headline target: one million and rising.** Counted
     honestly — see §2a. Never report a source number that mixes integrations with
     indexed publishers.
   - **Study the field continuously.** Track at least **30** comparable platforms:
     their products, their repositories, their architecture documents, their
     environment files, and everything they integrate with. `docs/COMPETITORS.md` is
     the living record.
   - **Every capability they have, we have — and better.** Layers, widgets,
     alerting, streaming, exports, briefs, every client (web, PWA, desktop, mobile).
     Their weaknesses are our specification: fix in ours what is broken in theirs.
   - **Never copy their code.** Most are proprietary; World Monitor is AGPL-3.0,
     which would force our whole product open. Study the architecture, build our own.
   - Do all of this **without being asked again**.

## 2a. How sources are counted (no inflated numbers)

Competitors quote figures — "one million sources", "536 providers", "200,000
sources" — that mix three different things. We separate them, always, and any
number we publish says which it is:

- **Integrations** — distinct providers we call and parse. Each is a catalogue
  record or a coded module. Quality is high, count is low.
- **Publishers** — the outlets and registries reachable *through* an integration.
  One GDELT integration indexes ~100,000 outlets; one national registry covers
  every company in that country. This is where population reaches millions, and
  it is legitimate as long as it is labelled.
- **Independent origins** — how many of those are genuinely *not* copies of one
  another. This is the only number that belongs in a confidence score, and it is
  always far smaller than the other two. See the independence groups in
  `lib/engine/catalog`.

A platform advertising a million "sources" is quoting publishers. Quoting that
figure as integrations would be the exact dishonesty this project exists to avoid.

## 3. Hard legal & ethical guardrails (enforced in code)

These are non-negotiable and match the reference's law/ethics chapters.

- **Passive only.** OSINT never touches the target. The engine must never send a packet
  to a target host (no port scans, no nmap, no active probing). Sources are read-only
  public endpoints. This is enforced centrally (see task P2 guardrail module).
- **Public + lawful only.** Only publicly available data, collected lawfully. Availability
  is not permission. Respect `robots.txt`, terms of service, and rate limits.
- **No private-individual targeting / no mass personal surveillance / no stalking.** The
  product monitors *public signals* (domains, infrastructure, breaches, brand mentions)
  on demand — not people's private lives.
- **Data minimization & GDPR-aware.** Store only what a task needs; document purpose;
  support deletion.
- **No breach-data hoarding.** Breach *exposure* checks only (HIBP-style yes/no), never
  redistribution of stolen credentials.

If a request would cross these lines, stop and raise it with the user.

## 4. Architecture (summary — full detail in docs/ARCHITECTURE.md)

- **Frontend:** Next.js 15 + React 19 + Tailwind + shadcn/ui (from the existing app).
- **Data:** Postgres via **Drizzle ORM**, schema as **versioned migrations in the repo**.
- **Isolation layers (mandatory):** `lib/db`, `lib/auth`, `lib/payments`, `lib/storage`,
  `lib/queue`, and the OSINT `lib/engine` source-adapter layer. App code calls these
  interfaces only — never a vendor SDK directly.
- **Engine:** our own source-adapter framework with multi-source redundancy/fallback,
  our own cache/archive, and the analysis core (entities, pivots, confidence, Admiralty
  code, evidence model).
- **Hosting default:** Netlify (keeps the already-verified Pi domain + existing Pi payment
  functions) + Supabase (Postgres/auth/storage/cron/queue). Swappable per rule #4.

## 5. Git & workflow

- Develop on branch `claude/bittorent-network-app-c8j9pv`. Create locally if missing.
- Commit in clear, self-contained units with descriptive messages. Push to that branch
  when a unit is complete. Never push to another branch without explicit permission.
- Never commit secrets. All keys (`PI_API_KEY`, DB URLs, etc.) are environment variables.

## 6. Repository merge gate (per module) — not Master COMPLETE

Passing this gate yields at most **REPO-PRESENT + REPO-TESTED**. Master completion runs
through the Master's chain:

```
SPECIFICATION → SCHEMA → API → IMPLEMENTATION → INTEGRATION → TEST → EVALUATION
→ FAILURE TEST → ACCEPTANCE → COMPLETE
```

Nothing is reported Fixed or Implemented without repository and test evidence.

- [ ] Real implementation — no mock data, no `Math.random()`, no stubbed returns.
- [ ] Behind the correct isolation layer (no direct vendor calls in app code).
- [ ] Passive-only + legal guardrails respected.
- [ ] Error handling + rate limiting + multi-source fallback.
- [ ] Real tests (unit + integration against live keyless endpoints) pass.
- [ ] Findings carry source link, timestamp, Admiralty rating, confidence grade.
- [ ] Documented (what it does, sources used, limits).
- [ ] Task marked complete in the living list.

The Admiralty rating and confidence grade stay as they are: separate dimensions, preserved
historically and never converted into a Master verification ladder (baseline §7).

## 7. Conflicts and continuity

When two files or two decisions conflict:

1. Do not choose at random, and do not delete the older one.
2. Create a **Conflict/Continuity Record** stating source, date, scope, the exact conflict
   and its impact.
3. Apply only the **latest approved** decision, and only after verifying it.
4. Mark the older statement superseded, keeping it as history.

Records live in `docs/reconciliation/`: the Contradiction Register in the baseline, and
`CONTINUITY_M_S.md`.

**Phase state (2026-10-03):**
- Operational resumption point: **30.27.8.S** — BLOCKED by the Build Package's own terms
  (§29.4) until its source contracts are consolidated and its open conflicts decided.
- 30.27.8.M is history only.
- Phase 30 is NOT COMPLETE. Phase 31 is BLOCKED until Phase 30 closes.
- This reconciliation stage is **30.27.8.RB**. R remains Artifact / Export /
  Publication / Share.

## 8. Before any significant change

Show the change plan before writing code:

```
SCOPE → REQUIREMENTS → DEPENDENCIES → CONTRACTS → IMPACT → IMPLEMENTATION → TESTS
→ ACCEPTANCE → STATUS
```

## 9. Work lanes

| Lane | What it covers | Precondition |
|---|---|---|
| Audit | Read, test and inspect, including read-only inspection of live systems. | Always allowed. |
| Maintenance | Defects and security in the Existing System. No new architecture, schema or contract. Path: REPRODUCE → ROOT CAUSE → PATCH → TEST → REGRESSION TEST → VERIFY → REPORT. | Explicit owner authorisation per batch. Batch 01: `docs/reconciliation/MAINTENANCE_BATCH_01.md`. |
| Implementation | A Master subsystem. | A closed implementation package (Master §70.6). Otherwise stop and report the exact gap. |

**Live systems** — database, hosting, environment, DNS:
- every write needs explicit owner authorisation **per action**;
- record it in the ledger with before/after evidence;
- keep it reversible where possible (e.g. `db/ops/orphan-L-quarantine.sql` with its
  `orphan-L-restore.sql`).

**Production deployment is paused** (owner decision 4, 2026-10-03) until the
Publication / Export / Share contract (30.27.8.R) is closed and has passed test, failure
test and acceptance. CI, builds, previews/staging and automated tests continue. Do not
publish to Production.

Scheduled **content** publication (`publish` job) is paused for the same reason (R294):
it sits in `UNSCHEDULED` in `lib/ops/schedule.ts`, and a test fails if it is scheduled
again before the owner lifts the pause.

## 10. Project boundary

- Lambda NX and World Pi are separate projects. Lambda NX work never touches the World Pi
  repository.
- Pi Network is part of Lambda NX's Existing System, as its identity provider, payment
  provider and Pi Browser distribution channel. It does not imply World Pi.
