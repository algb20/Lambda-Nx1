# Maintenance Batch 01 — 2026-10-03

| | |
|---|---|
| **Stage** | 30.27.8.RB, maintenance lane |
| **Authority** | Owner decision 3 (2026-10-03): fix the six defects and the dependency vulnerability as conservative corrective maintenance only. No redesign, no undocumented solution. Mandatory path: REPRODUCE → ROOT CAUSE → PATCH → TEST → REGRESSION TEST → VERIFY → REPORT. |
| **Base** | `11ce7e0` (branch `claude/bittorent-network-app-c8j9pv`) |
| **Master status effect** | None. These are Existing System (L1) corrections. Nothing here is IMPLEMENTED, INTEGRATED, TESTED, EVALUATED or ACCEPTED against any Master contract. |

## 1. Change plan (owner rule 9)

| Step | Content |
|---|---|
| **SCOPE** | Seven items registered in the baseline: CONF-Q01, CONF-V04, CONF-Q02, CONF-F02, CONF-Q03, the stale message in CONF-X03, and the high `sharp` advisory. Nothing else. |
| **REQUIREMENTS** | Each fix must restore behaviour already required by an existing rule — CLAUDE.md §2a, §3, §6, or a security floor. No new behaviour or contract. |
| **DEPENDENCIES** | `originOf` (generated catalogue independence groups, already in the repository); `scoreboard()`; npm `overrides`. No new package. |
| **CONTRACTS** | No API, database schema, event or UI contract changes. `catalogSummary().reach` gains one field (`byUnit`), and its existing fields keep their names and types. `catalogSummary` has no runtime consumer (only tests). |
| **IMPACT** | (a) Confidence grades become stricter where several feeds share one publisher — future grades only; stored grades are not rewritten (baseline §7.3). (b) The live publisher-reach figure falls from 10,549,740,110 to 2,721,500, with records reported per unit. (c) Two user-facing strings become accurate. (d) `sharp` 0.35.3 → 0.35.5. |
| **IMPLEMENTATION** | Per item, §2. |
| **TESTS** | One reproducing test per item, shown failing before its patch (or failing when the patch is reverted), then passing. |
| **ACCEPTANCE** | Full suite green, `tsc` exit 0, `next build` succeeds, `npm audit` 0 vulnerabilities. |
| **STATUS** | Done for L1 (§3). Master status unchanged. |

## 2. Items

### M-01 — Literal NUL bytes in source (CONF-Q01)

| Step | Evidence |
|---|---|
| REPRODUCE | New `lib/source-text.test.ts` failed on **5 files, 7 bytes**: `lib/analysis/correlation.ts` (2), `lib/analysis/stories.ts` (1), `lib/engine/analysis.ts` (2), `lib/engine/source-cache.ts` (1), `lib/i18n/translate.ts` (1). The baseline had found only 1 of the 5 files. |
| ROOT CAUSE | Key separators were written as a raw U+0000 inside string and template literals instead of the escape `'\u0000'`. Git then classifies the file as binary: `git diff --numstat` showed `-/-` for 3 of them, and the commit that introduced the confidence rule (`04298c1`) showed only "Binary files differ". `grep` hides the lines. |
| PATCH | Each raw byte replaced by the six characters `\u0000`. The runtime string is identical. |
| TEST | `lib/source-text.test.ts` passes. It walks `app`, `components`, `contexts`, `hooks`, `lib`, `db`, `netlify`, `scripts`, `styles` and `tests`, and guards against a vacuous pass with more than 500 files. |
| REGRESSION | The engine, analysis and i18n suites — 60 files, 1076 tests — pass unchanged. |
| VERIFY | `file lib/engine/analysis.ts` now reports "UTF-8 text". |

### M-02 — Confidence counted source keys, not independent origins (CONF-V04)

| Step | Evidence |
|---|---|
| REPRODUCE | Two new tests in `lib/engine/engine.test.ts` failed: two reliable feeds from WHO (`who_afro`, `who_don`) were graded `confirmed`, and three unreliable WHO feeds were graded `probable`. |
| ROOT CAUSE | `gradeConfidence` built `new Set(evidence.map(e => e.sourceKey))`. CLAUDE.md §2a and Master §13 require independent origins. The catalogue already had the answer (`originOf`) and used it for ranking, but not for grading. |
| PATCH | Count `originOf(sourceKey)` for both the distinct and the reliable sets (`lib/engine/analysis.ts`). An unknown key remains its own origin, so engine adapters outside the catalogue grade exactly as before. |
| TEST | 8 of 8 grading tests pass, including "still confirms when the reliable feeds come from different publishers". The existing 5 tests are unchanged. |
| REGRESSION | Callers `buildGraph`, `ontology.ts`, `trust.ts` and `ownership.ts` are covered by the full suite, which is green. |
| VERIFY | Stored `evidence.confidence` values are untouched. The preservation rule (baseline §7.3) holds. |

### M-03 — Reach summed across different units (CONF-Q02)

| Step | Evidence |
|---|---|
| REPRODUCE | Three new tests in `lib/engine/catalog/catalog.test.ts` failed: no family declared a unit, CT certificates were inside the publisher sum, and no per-unit report existed. |
| ROOT CAUSE | One field, `publishers`, held outlets, registries and companies, but also 10 billion certificates, 250 million papers and 37 million citations. `livePublisherReach()` summed them: 10,549,740,110. |
| PATCH | `lib/engine/catalog/families.ts`: the field is renamed `reach` and each family gets a required `unit: ReachUnit`. Publisher units follow CLAUDE.md §2a's own definition ("the outlets and registries … every company in that country"): outlets, domains, registries, legal-entities, companies, filers, organizations, contributors. Record units: certificates, scholarly-works, content-items, citations, knowledge-items, digital-assets. `livePublisherReach` and `plannedPublisherReach` sum publisher units only. New `reachByUnit()` reports every unit and loses nothing. `catalogSummary().reach.byUnit` added. |
| TEST | 100 of 100 catalogue tests pass. The standing ">1M publishers once planned land" test still passes (planned 252,521,500). |
| REGRESSION | Full suite green. No runtime consumer exists outside tests. |
| VERIFY | Live reach is now 2,721,500 publishers. Records: certificates 10,000,000,000 · scholarly works 250,000,000 · content items 150,000,000 · knowledge items 110,000,000 · citations 37,000,000 · digital assets 18,610 — each in its own unit. |
| NOTE | The publisher/record classification follows the existing charter text. It does **not** decide CONF-G06 (keep, relabel or retire the 1M target), which stays OPEN. |

### M-04 — Calibration text claimed metrics not computed (CONF-F02)

| Step | Evidence |
|---|---|
| REPRODUCE | Three new tests in `lib/plans/capabilities.test.ts` failed: the description said "Brier and log scores and a domain breakdown", and the pricing label said "our forecasts". |
| ROOT CAUSE | Descriptive text written ahead of the code. `scoreboard()` computes weighted accuracy overall, by author and by confidence band. Brier and log scores need probabilities, and the ledger stores categorical confidence, so they were unreachable, not merely missing. There is no forecasting engine (baseline §6). |
| PATCH | Description: "…a weighted accuracy, overall, by author and by confidence band." Pricing (`app/pricing/page.tsx`): "our assessments scored against outcomes". The competitor `fieldNote` that mentions Brier is about the competitor and is kept. |
| TEST | 25 of 25 plan and capability tests pass. |
| VERIFY | `grep "our forecasts"` returns nothing. "Brier" appears only in the competitor note. |

### M-05 — "Monitors & alerting" description mismatch (CONF-Q03)

| Step | Evidence |
|---|---|
| REPRODUCE | **Not reproduced.** The entry at `lib/plans/capabilities.ts:190` reads "Standing rules over live signals, delivered by signed webhook…", which is correct. The text "Shared investigations, SSO/MFA…" (line 268) belongs, correctly, to "Team workspaces with SSO and roles". |
| ROOT CAUSE | Audit error in the baseline: two neighbouring entries were misread together. |
| PATCH | None to code. CONF-Q03 is **WITHDRAWN — false finding**, recorded rather than deleted. |

### M-06 — Stale auth factory message (CONF-X03, message only)

| Step | Evidence |
|---|---|
| REPRODUCE | New `lib/auth/index.test.ts`: with `AUTH_PROVIDER=standalone` the error said "standalone arrives in P12". 2 tests failed. |
| ROOT CAUSE | The message was written before standalone sign-in shipped. Standalone shipped as routes running **alongside** Pi, not as a factory case, and the message was never updated. |
| PATCH | Message and header comment state the actual model: Pi is selected here; standalone email/password runs concurrently through `/api/auth/login` and `/api/auth/register`. **The factory is not changed** — registering standalone in it would be an architecture change outside this batch (MR-13 stays OPEN). |
| TEST | 166 of 166 auth tests pass. |

### M-07 — `sharp` high-severity advisory (Dependabot #10)

| Step | Evidence |
|---|---|
| REPRODUCE | `npm audit --audit-level=high` exit 1: `sharp <0.35.4`, GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545 (libheif). The Dependabot API itself was not readable from this session (HTTP 403); the advisory was identified through `npm audit`. |
| ROOT CAUSE | `sharp` comes through Next.js. `package.json` `overrides` pinned `^0.35.3`, so the lockfile kept 0.35.3 after 0.35.4 shipped the fix (2026-08-26). |
| PATCH | Override `^0.35.5` (latest patch in the same minor, released 2026-09-27). The lockfile changes **only** `sharp` and its 17 platform packages (0.35.3 → 0.35.5), `@img/sharp-libvips-*` 1.3.2 → 1.3.4, and one hoisted `@emnapi/runtime` (same version). |
| TEST | New `lib/dependency-floors.test.ts`: passes now. With the old `package.json` and lockfile restored, 2 tests fail. |
| VERIFY | `npm audit` reports 0 vulnerabilities. `sharp` 0.35.5 / libvips 8.18.7 renders a PNG. `next build` succeeds. |
| NOTE | Dependabot's alert is raised against the default branch (`main`). It clears there only when this branch is merged — this session does not push to `main`. |

## 3. Acceptance evidence (2026-10-03)

| Check | Result |
|---|---|
| `npx vitest run` | 200 files passed, 1 skipped · 2767 tests passed, 10 skipped. Was 2750 / 10 at `11ce7e0`; +17 new tests. |
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | success |
| `npm audit` | 0 vulnerabilities |
| Browser suites (`tests/browser`) | Not run in this batch (UV) |
