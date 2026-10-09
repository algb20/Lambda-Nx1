# Maintenance Batch 26 — coded sources whose terms were unread (2026-10-09, R333)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R333 |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `782e24c` |
| **Status words** | REPO-PRESENT + REPO-TESTED |

## Scope

Ten coded sources were still TERMS_NOT_READ (batch 23 §3): `wayback`, `courtlistener`, `crtsh`, `celestrak`, `ckan_federation`, `crypto_news`, `factcheck`, `hackernews`, `pi_network` and `username.web`.

## Result

| Source | What was read on 2026-10-09 | Record |
|---|---|---|
| **`courtlistener`** | The terms page, which refused us on 2026-10-04/05, now answers. Our source calls `/api/rest/v4/search/?type=o` with no key. Three clauses are quoted below. | **UNCLEAR → LEGAL_REVIEW_REQUIRED** (still runs, under review). Three prohibited uses recorded. Owner decision **C13**. |
| `hackernews` | Our source reads **HN Search (Algolia)**, not the official Firebase API. The official README ("There is currently no rate limit", no licence) does not cover it, so it was not recorded against it. `hn.algolia.com/api` renders no readable terms. | unchanged (UNCLEAR) |
| `wayback` | The Wayback help page covers takedowns, not reuse. `archive.org/about/terms.php` renders no text here. | unchanged |
| `crtsh`, `celestrak` | No terms on either site. CelesTrak's webmaster page did not answer. | unchanged |
| `ckan_federation`, `crypto_news`, `factcheck`, `username.web` | Multi-publisher records: each publisher is covered by its own record. | unchanged (by design) |
| `pi_network` | Lambda's own identity and payment platform (CLAUDE.md §10). | unchanged |

**The three CourtListener clauses:**
- "judicial opinions, motions, and other filings are generally in the public domain".
- **FCRA:** "you agree that you will not use Courtlistener.com and any information derived therefrom: (1) as a factor in establishing an individual's eligibility for credit, insurance, employment, government benefits, housing, or any other FCRA purpose …".
- **AI attribution:** "do not present it in a way that suggests Free Law Project produced, endorsed, or verified an AI-generated analysis of it."

**Why CourtListener is not VERIFIED:**
- The content is public domain only "generally".
- The FCRA clause binds what anyone does with data derived from it. Lambda's users could use court results for exactly those decisions, so whether Lambda's own terms must pass the restriction on is a legal question for the owner (C13).
- The AI-attribution line is already kept: model text is labelled "AI-generated" (batch 20), and every finding names its source.

## Verification

| Check | Result |
|---|---|
| licensing + conformance tests | pass |
| `vitest` | 2873 passed, 10 skipped |
