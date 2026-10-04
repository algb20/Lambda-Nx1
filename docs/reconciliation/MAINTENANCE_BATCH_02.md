# Maintenance Batch 02 — 2026-10-04

| | |
|---|---|
| **Stage** | 30.27.8.RB, maintenance lane |
| **Authority** | Owner, ledger R307: «اعمل المطلوب بنفسك», given in reply to Claude's list in which this batch was item 3. The batch is limited to the three items below: Existing-System corrections only, no new architecture, schema or contract. |
| **Production** | **Not affected.** Production stays locked on `9c19303` (R306). Nothing here is deployed. |
| **Master status effect** | None. Nothing here is IMPLEMENTED against the Master. |
| **Base** | `cdcb1b7` |

## 1. Change plan (CLAUDE.md §8)

| Step | Content |
|---|---|
| **SCOPE** | M2-01 Next.js 15.5.25 → 15.5.27 · M2-02 calibration wording per owner decision D-03 · M2-03 the three feeds Production reported as failing |
| **REQUIREMENTS** | Security floor; the owner's D-03 definition; the existing quarantine policy (`lib/engine/catalog/quarantine.ts`) |
| **DEPENDENCIES** | `next` and its `@next/*` platform packages only; no new package |
| **CONTRACTS** | None changed. Two user-facing strings changed (M2-02), and two quarantine entries added (M2-03). |
| **IMPACT** | Three medium advisories closed (M2-01). The pricing and capability text matches D-03 (M2-02). Two sources are withheld from the sweep until a recheck releases them (M2-03): 165 → 163 active. |
| **TESTS** | One reproducing test per item, failing before its patch |
| **ACCEPTANCE** | Unit suite green, `tsc` 0, `next build` OK, `npm audit` 0, browser suites run (§3) |
| **STATUS** | §3 |

## 2. Items

### M2-01 — Next.js 15.5.25 → 15.5.27

| Step | Evidence |
|---|---|
| **REPRODUCE** | `lib/dependency-floors.test.ts` was extended with a `next ≥ 15.5.27` floor held in `dependencies`. On 15.5.25, 2 tests failed. `npm audit` reported **0** advisories — the advisory database had not caught up — so the floor is the only guard. |
| **ROOT CAUSE** | The declared range was `^15.5.25`, and the lockfile held 15.5.25. Upstream release notes, read from github.com/vercel/next.js: 15.5.26 (2026-09-22) — "additional security hardening for `next/og`"; **15.5.27 (2026-09-30)** — fixes GHSA-f87g-xv8r-7p7x (information disclosure in App Router metadata image routes via a dynamicParams bypass), GHSA-4jqv-mc3x-m676 (cache poisoning of SSG/ISR pages, self-hosted) and GHSA-mcj8-r9mp-w47p (SSG/ISR cache poisoning → cross-user content substitution / persistent DoS). |
| **COMPATIBILITY REVIEW** | A patch release within 15.5.x; the release notes list no breaking change. `next` is the only declared Next package (no `eslint-config-next`); `@vercel/analytics` dedupes onto it. The Execution Package §5 asks for a dedicated unit with scope, compatibility, changelog, security, test, build, regression and acceptance — this entry is that unit. |
| **PATCH** | `package.json` `^15.5.27`. The lockfile changes **only** `next`, `@next/env` and the `@next/swc-*` binaries (10 entries, 15.5.25 → 15.5.27). |
| **TEST** | Floor tests pass. |
| **REGRESSION** | 2777 unit tests pass (0 failed, 10 skipped); `tsc` 0; `next build` OK; `npm audit` 0. Browser suites: §3. |

### M2-02 — Calibration wording per D-03

| Step | Evidence |
|---|---|
| **REPRODUCE** | New test "describes an evaluation of forecasts and claims, per D-03" failed on the batch-01 wording ("our assessments scored against outcomes"). |
| **ROOT CAUSE** | Batch 01 (M-04) predated D-03. It removed "forecasts" entirely, which hid what the ledger actually scores. D-03 (R302): the ledger is a calibration / evaluation record of earlier forecasts and claims; it may reference a forecast, and does not issue one. |
| **PATCH** | `app/pricing/page.tsx`: "Calibration ledger — **forecasts and claims scored against outcomes**". `lib/plans/capabilities.ts`: "Forecasts and claims — ours and others' — scored against what actually happened: a weighted accuracy, overall, by author and by confidence band." |
| **TEST** | 4 tests: no uncomputed metric (no Brier, log score or domain breakdown); names accuracy, author and confidence; describes an evaluation of forecasts and claims; never presents the ledger as issuing forecasts ("our forecasts", "we forecast", "predict"). All pass. The batch-01 assertion "no 'forecast' in the pricing line" is **superseded by D-03** and replaced; it stays in this record as history. |
| **UI strings** | `components/calibration-scoreboard.tsx:111` and `components/x-like-feed.tsx:112` ("published forecasts … scored") already match D-03. Unchanged. |

### M2-03 — Three failing feeds (audit AF-3)

| Step | Evidence |
|---|---|
| **REPRODUCE** | Re-requested from a second network on 2026-10-04, using the engine's User-Agent. `bse_india` → **403** Akamai "Access Denied". `nasa_donki` → **429** `OVER_RATE_LIMIT` on `DEMO_KEY` (Production had received HTML). `si_volcano_weekly` → **403**, on a page titled "Smithsonian site temporarily unavailable". |
| **ROOT CAUSE** | All three are upstream refusals. The engine already reports them honestly as `failed`, so there is no code defect. The existing policy is to record an observed refusal in the quarantine list, with date and status, without editing the source record; the daily `/api/cron/sources` recheck reports when to release it. |
| **PATCH** | `lib/engine/catalog/quarantine.ts`: `bse_india` → `bot-blocked` 403, the same refusal as the BLS entry. `nasa_donki` → `unreachable` 429, following the `afp_via_gdelt` 429 precedent; the note says the lasting fix is a registered api.nasa.gov key (**owner decision**, not a workaround). **`si_volcano_weekly` is not quarantined**: its page says the outage is temporary, and it belongs to the first-light pass (`lib/modules/first-light.ts`), so it is recorded as an observation only. |
| **TEST** | New `lib/engine/catalog/quarantine.test.ts`, 4 tests. The two entries' reason, status and date are checked; `si_volcano_weekly` is checked as *not* withheld; keys are unique and exist. 2 tests failed before the patch, all pass after. |
| **REGRESSION** | Engine, modules and analysis suites: 1344 passed. First-light tests unaffected. |

## 3. Acceptance evidence

| Check | Result |
|---|---|
| `npx vitest run` | **2777 passed, 0 failed, 10 skipped** (2787) |
| `npx tsc --noEmit` | 0 |
| `npx next build` (15.5.27) | OK |
| `npm audit` | 0 vulnerabilities |
| Browser suites (`tests/browser`, 4 files, 13 tests) | See §3.1 |

### 3.1 Browser suites

The first run, on 15.5.25 at the start of R307, gave **12 passed, 1 failed**. The failure was `places.browser.ts › draws place labels by default`. The page recorded `429 /api/posture`, `429 /api/world` ×2 and `429 /api/preferences`, and the test counts any failed request as "the page threw". These 429s are the application's **own rate limiter** (30 requests/min per caller), which the four suites exceed when run back to back from one address. They are not a fault in the place-names layer. The limit itself is an open owner decision from the earlier session.

Re-run results after the upgrade: appended below.
