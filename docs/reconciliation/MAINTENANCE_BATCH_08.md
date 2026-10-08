# Maintenance Batch 08 — the remaining coded-source terms (2026-10-04, R315)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R315 «اكمل» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `8608856` |

## 1. Result — licence registry for coded sources (`lib/engine/sources/licences.ts`)

| State | Count | Meaning |
|---|---|---|
| **verified** | 48 | Provider terms read on 2026-10-04 and quoted; any condition is met in the product |
| **refused** | 9 | Terms refuse this product's use without a licence or permission we do not hold. **None is registered.** |
| **unverified — decision** | 4 | Read, but the answer is the owner's: `xposedornot`, `solana_rpc`, `hf_papers`, `official_statements` |
| **unverified — could not read** | 18 | Each with the specific reason: page 403 / 404, no published terms, multi-publisher feeds not yet read one by one, … |

**Before batch 06, no coded source had a licence recorded.** The conformance suite now fails if a registered coded source lacks an entry, or if a refused one is registered.

## 2. Corrections in this batch

| Provider | Terms (quoted) | Action |
|---|---|---|
| **FRED housing** | Case-Shiller (`CSUSHPINSA`): "Copyrighted: **Pre-Approval Required**"; the five others are citation-class (checked one by one) | Case-Shiller removed. Rows read `… — <origin> via FRED`. |
| **FRED IMF commodities** | All 18 series: "Copyrighted: Citation required" | Verified; the board names the IMF |
| **BIS** (coded `bis_speeches`; catalogue `bis_press`) | Redistribution "for **non-commercial purposes**"; commercial reproduction needs written permission | Both withheld. **This reverses the batch-04 release of `bis_press`,** which used a feed-syndication licence that BIS terms do not grant. The Officials board, which had only this source, now says why. |
| **GDELT** | Commercial use allowed; "must include a citation to the GDELT Project and a link" | Citation and link under news results |
| **Wikipedia** | CC BY-SA 4.0; attribution may be a hyperlink; User-Agent policy | Licence notice under news results; items link to their articles |
| **ECB / Frankfurter** | ECB cited; modifications "must be stated explicitly"; Frankfurter: "rates fall under each provider's terms" | Markets footer names the ECB and declares that percentage changes are computed |
| **Elexon BMRS** | Commercial use allowed with "Contains BMRS data © Elexon Limited copyright and database right [year]" | Exact statement on the power-grid board |
| **HM Land Registry (UK HPI)** | OGL v3.0, with "Contains HM Land Registry data © Crown copyright and database right [year]. This data is licensed under the Open Government Licence v3.0." | Exact statement on the property board |
| **Eurostat** | Reuse "authorised provided the source is acknowledged" (not for non-EU data) | Acknowledged on the property board |
| **PubMed / NCBI** | ≤ 3 requests / s; abstracts may be publishers'; the disclaimer must be evident to users | Metadata only (`esummary`); NCBI disclaimer linked under research results |
| **ISO 10383 MIC** | Free use, excluding republishing the whole list | Lookups only |
| Verified as-is | Crossref ("use it for any purpose"); GLEIF (CC0); arXiv metadata (CC0; no endorsement); Wikidata (CC0); World Bank (CC BY 4.0); GitHub API; Radio Browser ("free and non free software"); mempool.space (rate limits; no commercial bar); seven US federal sources (17 U.S.C. §105) | — |

## 3. Defects fixed along the way

| ID | Defect | Fix |
|---|---|---|
| M8-01 | **An empty board read as "nothing happened."** A board whose only source is withheld returned an empty report (S invariant 15). | `boardReport` refuses with a message naming the board when no permitted source exists |
| M8-02 | **`npm run test:ui` left `next-server` running.** It killed only the `npx` wrapper. The next run reused the old server and tested an **old build** (seen three times today, including an intermediate run in this batch, which is void). | The server is spawned in its own process group, and the group is stopped. Verified: after a run, no `next-server` remains and port 3111 is free. |

## 4. New gap

**CKAN federation.** Each portal's metadata licence is recorded (`lib/engine/registries/ckan/portals.ts`), but the federation does not gate on it. Recorded, not changed: it needs a per-portal review first.

## 5. Tests

| Check | Result |
|---|---|
| Full unit suite | **2811 passed, 0 failed** |
| `tsc` | 0 |
| Browser suites | **13 / 13 on a fresh build** (after stopping the stale server; the earlier 13 / 13 in this batch is void) |

## 6. User-visible changes (CHANGED)

| Surface | Change |
|---|---|
| Officials board | Withheld, with the reason |
| US housing | No Case-Shiller |
| Attribution lines | New lines on news, markets, grid, property and research |

## 7. Owner decisions

| ID | Decision |
|---|---|
| D-B8-1 | BIS: request written permission, or leave the Officials board withheld |
| D-B8-2 | United Nations news: credit is given; the UN asks to be **advised**. Notify the UN, or withhold its feeds. |
| D-B8-3 | Hugging Face Daily Papers: is the curated listing their proprietary material? |

Earlier decisions D-B6-4 (XposedOrNot) and D-B6-5 (Solana RPC) remain open.

**Status:** REPO-PRESENT + REPO-TESTED. Not deployed.
