# Maintenance Batch 28 — the "confirmed unchanged" date reaches every exported copy (2026-10-09, C14, R336)

| | |
|---|---|
| **Authority** | Owner decision C14 (R335); R336 «اكمل» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `afe51c7` (PR #78) |
| **Status words** | REPO-PRESENT + REPO-TESTED |

## Why

Batch 27 added `Evidence.confirmedUnchangedAt` in the engine. Without this batch it stopped there:
- the export sanitiser (`lib/export/payload.ts`) dropped it;
- the dossier had no place for it.

A dossier citing a source would show only "retrieved 2026-08-10", though the provider had confirmed the record unchanged that morning. The decision kept the two dates apart precisely so that a reader sees both.

## What changed

| File | Change |
|---|---|
| `lib/export/payload.ts` | Passes `confirmedUnchangedAt` through when it is a valid date. Unlike `retrievedAt`, it is never filled in: an unreadable confirmation is dropped. |
| `lib/export/dossier.ts` | Each reference keeps the **earliest** retrieval (unchanged) and the **latest** confirmation, separately. Each finding carries its own. Rendered as shown below. |

**How it appears in each format:**
- Citations: "Retrieved 2026-08-10. Confirmed unchanged 2026-08-11."
- Markdown and printable HTML: "retrieved …, confirmed unchanged …".
- CSV: a new last column, `confirmed_unchanged_at`.
- JSON: carries the field as is.

A record received in full prints nothing extra.

## Tests

`dossier.test.ts` (+3) and `payload.test.ts` (+1):
- both dates are kept apart, and the latest confirmation wins;
- every format renders them;
- a full-response record says nothing extra;
- an unreadable date is dropped, never invented.

The CSV header test was updated for the appended column.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vitest` | 2881 passed, 10 skipped |
| `next build` | OK |
