# Maintenance Batch 27 — conditional GET for catalogue feeds (2026-10-09, owner decision C14, R335)

| | |
|---|---|
| **Authority** | Owner decision **C14** (R335, given directly on 2026-10-09): "a separate 'confirmed unchanged at' field; `retrievedAt` keeps its original value". |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `a2695ce` (PR #78 open) |
| **Status words** | REPO-PRESENT + REPO-TESTED |
| **Measured first** | `docs/RESEARCH/CONDITIONAL_GET_2026-10-09.md`: 48 of 118 active feeds answer 304, ≈ 70 % of bytes per pass. |

## What was built

| File | Change |
|---|---|
| `lib/engine/types.ts` | `Evidence.confirmedUnchangedAt?: string`: when the provider last confirmed the record unchanged with a 304. `retrievedAt` keeps meaning "when we received it". |
| `lib/engine/catalog/adapter.ts` | Conditional GET, described below. |
| `lib/engine/catalog/conditional-get.test.ts` | 4 tests, listed below. |

**How the adapter behaves:**
- After a full 200 that carries `ETag` or `Last-Modified`, the validators are kept with the exact URL and the records.
- The next request to the same URL sends `If-None-Match` / `If-Modified-Since`.
- On `304`, the previous records are returned with only `confirmedUnchangedAt` set. That counts as a healthy, current answer, never "empty" (S invariant 15).
- A `304` nobody asked for is a failure, not data.
- Validators live in module scope. A container that keeps nothing simply makes a full request, which is the previous behaviour.

**What the tests cover:**
- validators are sent and the records served on 304, with the same `retrievedAt`;
- a changed feed replaces both records and validators;
- no validator means no conditional headers;
- an unsolicited 304 throws.

## Live check (2026-10-09)

The same adapter path was run twice against real publishers:

| Source | Statuses | Records | `retrievedAt` kept |
|---|---|---|---|
| `cisa_kev` | 200 → **304** | 120 → 120 | yes |
| `nsidc_news` | 200 → **304** | 25 → 25 | yes |
| `gdacs_alerts` | 200 → **304** | 120 → 120 | yes |

## Decisions recorded with this batch (R335)

- **C12:** no retry within a run; `Retry-After` honoured (batch 24). Closed.
- **C11:** no preference, so no fallback source is adopted.
- **G1:** PR #77 had already been merged on `main` through batch 20, so Dependabot #15 is fixed there. PR #78 carries batches 21 onward and is merged only on request.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vitest` | 2877 passed, 10 skipped |
| `next build` | OK |
