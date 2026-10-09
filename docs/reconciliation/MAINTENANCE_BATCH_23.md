# Maintenance Batch 23 — S-gate preparation: invariant matrix refreshed, confidence never a percentage (2026-10-09, R331)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R331; wave W7 of `WORK_PLAN_R328.md` |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `beec899` |
| **Status words** | REPO-PRESENT + REPO-TESTED. Nothing here is Master TESTED / ACCEPTED. **S remains NOT CLOSED; Phase 30 NOT COMPLETE; Phase 31 BLOCKED.** |
| **Not redone** | `S_DECISION_DOSSIER_2026-10-04.md` (D1–D8, deferred to the owner by R308) and `PHASE30_CLOSURE_AUDIT_2026-10-04.md` §A–§E remain as written. This batch updates only what the repository has changed since then. |

## 1. Defect fixed — invariant 14 (confidence is never probability or truth)

| | |
|---|---|
| **Reproduce** | `lib/analysis/confidence.ts` `explain()` rendered `Confidence 75% (probable)`. |
| **Root cause** | The number is a weighted *support* score: reliability 35 %, corroboration 35 %, freshness 20 %, completeness 10 %. A percent sign makes it read as a 75 % chance of being true. |
| **Impact** | Latent. `scoreConfidence` / `explain` are not yet wired to any screen; only tests call them. It would have surfaced the first time the "why?" button used it. |
| **Patch** | The text is now "Confidence score 75/100 (probable) — how well supported, not how likely." |
| **Test** | `confidence.test.ts`: the text contains `/100` and "not how likely", and never matches `\d%`. |
| **Scan** | Other confidence displays were checked: grades are words everywhere. The calibration scoreboard's percentages are accuracy of resolved forecasts, a measured rate, which is correct. |

## 2. Invariant matrix (BP §29.3) — changes since 2026-10-04 §F.1

| Inv. | Then | Now | Evidence |
|---|---|---|---|
| 3 UI never bypasses API / security | REPO-TESTED | unchanged | `s-invariants.test.ts` |
| 4 Agent / tool never bypasses licence | REPO-TESTED (+ NEW-03 gap) | **Strengthened** | Coded-source registry (79 records); terms unread for **10** coded sources (was 60). Tests added since: R318 and batch-21 withholdings; no VERIFIED record on absence wording; `recheck` holds licence-withheld sources (batch 20); **no withheld source named as a fallback** (batch 22). |
| 10 Monitoring degradation visible | precursor RT | unchanged | `no-laundered-refusals.test.ts` |
| 11 Publication cannot strengthen truth status | GAP (NEW-06) | **GAP, with one more requirement** | EU AI Act Art. 50(4) (batch 20): AI-written text must carry its disclosure wherever it is published. The interface labels it today (`lib/ai/disclosure.ts`). The publication contract (30.27.8.R) must carry it — owner C10. |
| 14 Confidence never probability / truth | NOT TESTED | **REPO-TESTED for `explain()`** | §1 above. The wider contract (TruthStatus vs grade) is still D4, open. |
| 15 Missing data never "no event" | RT | unchanged | as 10 |
| 1, 2, 5, 6, 7 | NOT APPLICABLE | unchanged | no canonical layer (D3) |
| 8, 9, 13 | GAP | unchanged | NEW-05 (`Retry-After`): the engine still does not honour it; DECISION REQUIRED |

## 3. NEW-xx issues — status now

| # | 2026-10-04 | 2026-10-09 |
|---|---|---|
| NEW-03 coded-source licence gate | FIXED structurally; 60 unread | 10 coded sources still TERMS_NOT_READ; 6 rest on absence of restriction (UNCLEAR, never VERIFIED) |
| NEW-05 Retry-After / retry budget | DECISION REQUIRED | **unchanged**. Batch 19 set the GDELT spacing to the 5 s its 429 body asks for; that is a per-source fix, not the contract. |
| NEW-06 publication truth status | GAP | GAP, plus the Art. 50 disclosure (C10) |
| NEW-09 TED v3 POST-only | DECISION REQUIRED | unchanged (`ted_europa` quarantined as moved) |

## 4. Cross-contract consistency found in the repository (recorded, not resolved)

| # | Between | Observation | Status |
|---|---|---|---|
| X-1 | Licence registry ↔ catalogue `Licence` | Two gates decide whether a source runs: the registry status → usage policy, and the catalogue `licenceProblem`. They agree today; `s-invariants` fails if a registered source is WITHHOLD. Batch 21 found one case where the catalogue said CC BY and the provider says CC BY-NC-SA (OONI). | Consistent, test-enforced. The duplication is a Source Control Plane question (GL-05, BC-2). |
| X-2 | Retention (charter §3 data minimisation) ↔ registry `retention` | Every record says "Lambda keeps findings per its own retention rules", but no per-source retention rule exists. | GAP (GL-07); needs a specification |
| X-3 | Credits (BC-8) ↔ publication (R) | Credits travel to every surface and export. Publication is paused, so social posts are untested. | Waits for 30.27.8.R |
| X-4 | AI analyst "sorts, never verifies" ↔ AI-use terms (GL-08) | The registry's `ai_ml_use` is NOT_STATED for most sources. | Owner C2 |

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vitest` | 2869 passed, 10 skipped |
