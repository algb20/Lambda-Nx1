# Source Population — "One Million and Rising" (CONF-G06)

| | |
|---|---|
| **Decision** | **KEEP the target** — owner, 2026-10-03, ledger R294: «اما مليون مصدر يجب ان نعمل عليه». CONF-G06 is RESOLVED as *keep*. |
| **Counting rule** | CLAUDE.md §2a, enforced in code since batch 01 (M-03). The target is **publishers**, counted by unit and never summed with records. Integrations and independent origins are reported beside it, never instead of it. |
| **Status** | Plan only. No code has been written for it. Under owner instruction (R294) programming waits for the Master Reconstruction & Claude Handoff package. |
| **Date** | 2026-10-03 · evidence at `2247164` + this commit |

## 1. Where we stand (REPO-TESTED, from `catalogSummary()`)

| Measure | Value | What it means |
|---|---|---|
| Integrations | 247 catalogue records (165 active) | Providers we call and parse |
| Independent origins | 180 | The only number allowed in a confidence score |
| **Publishers, live** | **2,721,500** | outlets 100,000 · registries 1,500 · legal entities 2,600,000 · organizations 20,000 |
| Publishers, live, excluding GLEIF | 121,500 | GLEIF is **one** integration and **one** origin; 2.6 M of the 2.72 M is that one file |
| Publishers, planned families included | 252,521,500 | adds Common Crawl domains, OpenCorporates companies, EDGAR filers, OSM contributors |
| Records, live (never added to publishers) | certificates 10,000,000,000 · scholarly works 250,000,000 · content items 150,000,000 · knowledge items 110,000,000 · citations 37,000,000 · digital assets 18,610 | Real reach, in its own units |

**Reading of the target:**
- By the letter of CLAUDE.md §2a ("one national registry covers every company in that country"), the live publisher figure already passes one million.
- That pass rests on a single integration, GLEIF.
- Without GLEIF, live publisher reach is 121,500.
- An honest "one million and rising" must therefore grow **breadth** — many integrations and many origins — not only one large file.

This plan treats the target as met **on paper and not yet in substance**.

## 2. Change plan (CLAUDE.md §8)

| Step | Content |
|---|---|
| **SCOPE** | Grow live publisher reach well past 1 M **without** relying on one integration. Raise integrations and independent origins with it. |
| **REQUIREMENTS** | Every addition passes the existing guardrail: passive, public, lawful, licence gate (commercial use, storage, redistribution), robots/ToS, rate limits. Every reach figure keeps a sourced `basis` and a declared `unit`. No figure is ever summed across units. |
| **DEPENDENCIES** | (a) The Master's Source Control Plane (§8) and Licensing (§9) contracts. The repository's licence model has 3 of the Master's 16 fields (MR-06). New sources added under the old model add to the migration debt. (b) The Master Reconstruction & Claude Handoff package (R294). (c) Per-source licence verification. |
| **CONTRACTS** | No API, schema or UI contract changes. Catalogue records and `SourceFamily` entries only — the existing L1 model. |
| **IMPACT** | Reach and coverage grow. Confidence is unaffected unless new independent origins corroborate. |
| **IMPLEMENTATION** | Three candidate tracks, §3. |
| **TESTS** | Existing catalogue, licence and families suites, plus a live keyless probe per new integration (CLAUDE.md §6). |
| **ACCEPTANCE** | Live publisher reach **excluding the single largest family** ≥ 1,000,000. Integrations and origins both higher than today. |
| **STATUS** | PLANNED. Awaiting the owner's choice in §4. |

## 3. Candidate tracks (from what the repository already names — nothing invented)

| Track | Family (already declared `planned`) | Unit / reach | Licence as recorded | Keyless | Issue to clear first |
|---|---|---|---|---|---|
| A | `commoncrawl_index` | domains / 40,000,000 | Public domain | yes | A domain is a publisher only if it publishes. The basis counts hosts in a crawl. Needs a stated rule. |
| A | `sec_edgar_full` | filers / 800,000 | Public domain | yes | SEC fair-access rate limit and declared User-Agent (already the engine's practice) |
| B | `openstreetmap` | contributors / 9,000,000 | ODbL (share-alike) | yes | Share-alike obligations on derived data (the families test already requires a note) |
| C | `opencorporates` | companies / 200,000,000 | CC BY-SA, **keyed** | **no** | Needs an API key and its terms. Share-alike. Commercial use under their terms must be verified. |

Option inside existing integrations (no new provider):
- **OpenAlex** documents "250,000+ sources" (journals and repositories — publishers by any reading). Today the family is counted only by works (records).
- **Crossref** has member publishers in the same way.
- Counting a second, publisher-unit figure for these would need `SourceFamily` to carry more than one unit — a model change, and so an owner decision.

## 4. Decisions required

1. **Lane:** treat catalogue growth as an authorised Existing-System batch now, or wait for the Master Source Control Plane / Licensing contracts in the reconstructed package. R294 says programming waits for the package; this plan follows that unless you say otherwise.
2. **Track order** — A, B and C above.
3. **Acceptance:** "≥ 1 M excluding the largest family" as the honest bar?
4. **Second unit per family** (OpenAlex sources, Crossref members): allow it?
