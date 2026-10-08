# Maintenance Batch 13 — The Gazette stops naming private individuals (2026-10-08, R321)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); charter §3; R321 «اكمل» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `ddfc518` |
| **Status words** | REPO-PRESENT + REPO-TESTED |

## Defect (REPRODUCE → ROOT CAUSE)

`uk_gazette` read the Gazette's all-notices feed, whose items include the following (live, 2026-10-08):

| Code | Notice | Example headline |
|---|---|---|
| 2503 | Bankruptcy Orders | "DEREK THOMAS THOMPSON" |
| 2509 | Notice of Intended Dividends (personal) | "Stephen Rogers" |
| 2903 | Deceased Estates | "Jean Mickleburgh" |

Every item became a finding with its title as the headline. Lambda was therefore publishing private individuals' names as intelligence findings. This breaks two rules:
- **Charter §3:** no private-individual targeting, data minimisation.
- **The source's own licence:** the Gazette's content is OGL v3.0, and "this licence does not cover the re-use of personal data".

## Fix (PATCH)

- **New catalogue field `keepItem`:** a per-record test on each feed item's own XML. Items that fail are dropped *before* parsing, so nothing about them is stored or shown.
- **The Gazette** keeps notice codes **24xx** (corporate insolvency) and **26xx** (disclaimers) only. Anything else is dropped, and so is an item with no code. This is an allowlist, not a denylist: a new notice type that names people stays out until someone looks at it.
- **Page size:** `results-page-size=100`, so a run still fills with company notices after filtering. The Gazette accepts only one `noticetypes` value per request, so server-side filtering was not possible.

## Tests (TEST → REGRESSION → VERIFY)

| Test | What it checks |
|---|---|
| `adapter.test.ts` | Filtered items never become findings, with an unfiltered negative control. |
| `gazette.test.ts` | The live notice shapes are kept (2406, 2441, 2443, 2452, 2603) or dropped (2503, 2509, 2903, 1601, 1101, and an item with no code). |
| Live run, 2026-10-08 | 100 items fetched, **87 kept, all companies**. |

## Registry

- `uk_gazette`: LEGAL_REVIEW_REQUIRED → **VERIFIED_CONDITIONAL**, because the licence's condition is now met in code.
- `uk_companies_house`: stays under review. It is inert (no key); its officer data needs the same treatment before it is ever switched on.

## Open — owner action

Gazette findings stored *before* this fix may still hold personal-insolvency or deceased-estate headlines. Deleting them is a write to a live database. That needs explicit owner authorisation per action (CLAUDE.md §9), so it was not done.
