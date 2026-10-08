# Maintenance Batch 15 — credits beside every finding; terms-change detection (2026-10-08, R323)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R323 «اكمل البناء» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `88dc94e` |
| **Status words** | REPO-PRESENT + REPO-TESTED. Making the check a scheduled runtime job is Blueprint change BC-5 and awaits the owner (C8). |

## B1 — Credits beside every finding (GL-04)

**Before:** finding rows showed the raw source key (`emsc_quakes`). Credits owed under CC BY, OGL and provider terms appeared only on `/terms`.

**The credits index:**
- `scripts/build-credit-index.ts` (also `npm run build:credits`) generates `lib/engine/catalog/credits.ts`: 158 sources, each with the credit its licence asks for.
- The credit comes from the licence registry when the record is verified, otherwise from the catalogue.
- The licence (e.g. "CC BY 4.0") is named **only** where the registry verified it, so an unverified catalogue entry is never displayed as a licence.
- Withheld sources get no entry.
- `credits.test.ts` fails if the index drifts from the catalogue and registry.

**The display:**
- `components/source-credit.tsx` shows the credit linked to the finding's source, plus the licence name linked to `/terms#sources`.
- It is marked `data-no-translate`, so machine translation never rewrites a licensor's words.
- It is used in the live columns, the category panels, the markets provenance line and the lead finding.

## B2 — Terms-change detection (GL-06)

**How it works:**
- `lib/engine/licensing/terms-check.ts` checks whether each verbatim clause the registry relies on is still on its page, word for word.
- It does not hash whole pages: navigation and news make page hashes change every day.
- `scripts/check-terms.ts` (`npm run check:terms`) fetches each of the 241 pages once, read-only, and writes `docs/reconciliation/TERMS_CHECK_<date>.json`.
- It changes nothing. A `missing` clause is a candidate for EXPIRED_OR_CHANGED, and a person decides (R317).

**Evidence now has a kind:**
- Each registry evidence entry carries `kind`: `quote` (verbatim), `paraphrase` (only the parts in double quotes are verbatim) or `observation` (our note: a status code, a measurement, a citation).
- The validator requires it.
- A conformance test forbids full dates inside a `quote`, because full dates appear only in our notes.

**Defects the first live runs exposed, fixed in the extractor and each pinned by a test:**
- spaces before punctuation left by tag stripping;
- hyphens at line breaks;
- undecoded `&copy;`;
- Arabic diacritics in a different order (NFKC);
- a trailing full stop where the page has a comma;
- PDF pages, which are now skipped as unreadable.

**Evidence corrected to match the pages exactly:**
- Full Fact: "All rights reserved." had been dropped.
- Ethereum: "collectively," had been dropped.
- arXiv: a footnote marker, now an elision.
- BIS, OpenSanctions: our own words removed from inside the quote.
- Radio Browser: link text, now an elision.
- UK HPI: the quote was attributed to the wrong page; now the GOV.UK page it comes from.

**Baseline (2026-10-08):**

| State | Records |
|---|---|
| Clause present | 162 |
| Not checkable (observations only) | 145 |
| Page unreachable | 57 |
| Missing or partial | 3 |

**No verified, withheld or under-review record has changed terms.** The 3 flags are UNCLEAR records whose pages render only with JavaScript (mempool.space) or match only partly (`dns.google`).

## Pending (see PENDING_OWNER_ITEMS.md)

C8 / BC-5: run the check on a schedule and feed EXPIRED_OR_CHANGED automatically. Today it is a manual audit tool.
