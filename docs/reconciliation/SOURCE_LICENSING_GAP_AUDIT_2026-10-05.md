# Source Licensing — Gap Audit, Architecture Impact, Required Blueprint Changes (2026-10-05, R317)

| | |
|---|---|
| **Scope** | Every source Lambda NX can reach: 247 catalogue records, 79 coded sources, 30 CKAN portals, 11 username-check sites — **367 records** |
| **Registry** | `lib/engine/licensing/source-licence-registry.json` (data) · `registry.ts` (types, validation, status → usage policy) · `SOURCE_LICENSE_REGISTRY_2026-10-05.md` (generated view) |
| **Method** | Each provider's own terms, read on 2026-10-04/05, quoted with URL and date. CKAN: portal terms **and** each portal's dataset-licence facet, measured live. No licence is inferred from the nature of the data. |
| **Status words** | Research ladder only — DISCOVERED → RESEARCHED → AGREED → SPECIFIED → REQUIRED. Nothing in the Master is IMPLEMENTED, INTEGRATED, TESTED, EVALUATED or ACCEPTED because of this work. Repository changes are REPO-PRESENT + REPO-TESTED. |
| **Production** | Not affected; locked (R306) |

## 1. Results

| Status | Count | Usage policy |
|---|---|---|
| VERIFIED_ALLOWED | 55 | ALLOW |
| VERIFIED_CONDITIONAL | 40 | ALLOW_WITH_CONDITIONS (conditions met in the product) |
| LEGAL_REVIEW_REQUIRED | 12 | ALLOW_UNDER_REVIEW |
| UNCLEAR | 231 — of which 188 are catalogue baselines with no evidence on file | ALLOW_UNDER_REVIEW |
| RESTRICTED | 25 | WITHHOLD |
| PROHIBITED | 3 | WITHHOLD |
| EXPIRED_OR_CHANGED | 1 (OpenSky — terms page now 403) | WITHHOLD until re-read |

The conformance suite fails if:
- any WITHHOLD record is registered, active in the catalogue, or an active portal;
- any source lacks a record;
- any VERIFIED record rests on anything but an express grant or a statute.

### 1.1 PublicNode (Ethereum RPC) — the item the owner singled out

| Dimension | Terms (quoted, publicnode.com/terms, 2026-10-05) | Reading |
|---|---|---|
| RPC access | "a non-exclusive, limited, non-transferable, freely revocable license to access and use the Service" | Allowed, revocable |
| Raw blockchain data | Not addressed. "Service Content" is used but never defined. | UNCLEAR |
| Derived data | "you agree not to … create derivative works based on the Service or the Service Content commercially and non-commercially" | UNCLEAR (scope of "Service Content") |
| Caching / storage | Not addressed | NOT_STATED |
| Display / redistribution | "… re-use, display, distribute, transmit, publish, re-publish …" — same clause | UNCLEAR |
| Commercial use | Only "commercial solicitation" is prohibited | NOT_STATED beyond solicitation |
| Attribution | None | NOT_STATED |
| Rate limits | Not in the terms | NOT_STATED |
| Automated access | "you will not engage in or use any data mining, robots, scraping, or similar data gathering or extraction methods" — in tension with a programmatic RPC service | UNCLEAR |

**Classification: UNCLEAR — LEGAL_REVIEW_REQUIRED.** Kept running, per R317. We read two facts only (`eth_blockNumber`, `eth_gasPrice`).

**Independent alternatives researched:**

| Provider | Finding |
|---|---|
| Ankr | Its terms carry a similar proprietary-content clause |
| Blockscout | Documents limits (300 requests / min per IP); its terms page was not found |
| Etherscan | Answered 403 |
| LlamaRPC | Answered 526 |

None is verified yet. Running our own node removes the question.

### 1.2 Sources researched earlier — full chain re-stated

Each row's full chain (official source → terms → allowed use → restrictions → data type → commercial → attribution → redistribution → limits → retention → risk → fallback) is in the registry JSON.

| Source | Status | Restriction (quoted in registry) | Fallback |
|---|---|---|---|
| abuse.ch (Feodo, URLhaus, ThreatFox; 2 catalogue records) | RESTRICTED | Authenticated users only; commercial use "may require a paid subscription" (Spamhaus) | CISA KEV (public domain). **No verified independent IP/URL/hash reputation feed** — GAP |
| WHO (4 records + coded) | RESTRICTED | "not for sale or for use in conjunction with commercial purposes"; written authorization otherwise | ECDC CDTR (**CC BY 4.0, verified**), US CDC (public domain) |
| BIS (speeches, press) | RESTRICTED | Non-commercial; written permission for commercial | Federal Reserve speeches and press (public domain) |
| United Nations (in the statements board) | LEGAL_REVIEW_REQUIRED | News usable "as long as the appropriate credit is given and the United Nations is advised" | The other feeds in the same board |
| XposedOrNot | LEGAL_REVIEW_REQUIRED | "The free API is for personal and low-volume use" | None verified (HIBP is paid; terms unread) — GAP |
| Solana public RPC | LEGAL_REVIEW_REQUIRED | Docs: "not intended for production applications"; Foundation terms bar "commercial endeavors" for its Service | None verified — dedicated provider or own node |
| Solana news (catalogue) | RESTRICTED | "personal … license … solely for your own use" | Ethereum Foundation blog (CC BY, under review), CoinDesk (UNCLEAR) |
| Hugging Face Daily Papers | LEGAL_REVIEW_REQUIRED | Its proprietary materials may not be republished without permission | arXiv watch (**CC0, verified**) |
| Stock indices (S&P, Dow, Nasdaq, Case-Shiller via FRED) | RESTRICTED (series removed) | FRED: "Copyrighted: Pre-approval required" | VIX (citation class). **No verified free index provider** — GAP |
| OpenSanctions | RESTRICTED | CC BY-NC; commercial use needs a paid licence; API 401 without a key | OFAC SDN (public domain). PEP coverage — GAP. |
| Shodan InternetDB | RESTRICTED | "free for non-commercial use … enterprise license" | None — GAP |
| urlscan.io | RESTRICTED | "Commercial use … requires express written permission" | None — GAP |
| Global Fishing Watch | PROHIBITED | "only available for non-commercial purposes" | None — GAP (maritime) |

### 1.3 Multi-publisher sources — per publisher

**Fact-checkers:**

| Publisher | Status | Basis |
|---|---|---|
| Snopes | RESTRICTED | Personal, non-commercial; bots need written permission |
| PolitiFact | RESTRICTED | Personal, non-commercial |
| FactCheck.org | **VERIFIED_CONDITIONAL** | Free reprint with credit |
| Full Fact | LEGAL_REVIEW | Copyright reserved, licensing on request |
| Lead Stories | UNCLEAR | Terms page missing |

**Crypto news:**

| Publisher | Status | Basis |
|---|---|---|
| Cointelegraph | RESTRICTED | Personal use only |
| Bitcoin Magazine | RESTRICTED | Prior written consent |
| Solana | RESTRICTED | Personal licence; no commercial endeavours |
| Ethereum Foundation | LEGAL_REVIEW | Content CC BY 4.0, but "personal use" warranty |
| CoinDesk, Bitcoin Optech, Pi blog | UNCLEAR | Terms unreadable or absent |

**Username check:**

| Site | Status | Basis |
|---|---|---|
| GitHub | RESTRICTED | Research or archive use only |
| Dev.to | RESTRICTED | Personal transitory viewing |
| Reddit | RESTRICTED | Commercial use needs an agreement |
| Replit | PROHIBITED | Scraping for any purpose |
| GitLab, npm, PyPI, Docker Hub, Chess.com, Keybase, Hacker News | UNCLEAR | Terms silent or unreadable |

All RESTRICTED and PROHIBITED publishers are withheld.

### 1.4 CKAN — portal ≠ dataset

Measured live (licence facet), so no portal is treated as one licence:

| Portal | Datasets | Licence mix |
|---|---|---|
| Chile | 3,235 | 1,310 `cc-nc` (non-commercial) |
| Australia | 141,312 | 92,826 `notspecified` |
| UK | 59,451 | Mostly OGL, plus `other-nc` and `other-closed` |
| Ireland | 22,762 | Mostly CC BY, plus three NC variants |
| energydata | 1,191 | Mostly CC BY, plus `CC-BY-NC-4.0` and `other-closed` |

- **What we show:** catalogue metadata (title, publisher, link) and **each dataset's own licence, or "licence not stated"**. Dataset content is never fetched or redistributed. The portal licence is never applied to a dataset.
- **Portal terms read:**
  - UK OGL v3, Canada OGL-C, Australia CC BY 4.0, energydata (CC BY with labelled exceptions): **VERIFIED_CONDITIONAL**.
  - Switzerland (four usage terms, one requiring the owner's permission for commercial use), Ireland, HDX: **LEGAL_REVIEW**.
  - The rest: unreadable or not found (UNCLEAR).
- **Operational:** ten portals refused or moved and are now off, each with a dated note:
  - Bot walls: New Zealand (Imperva), Africa Open Data (Cloudflare), Mexico (Akamai), Finland and Italy (403).
  - Authentication: Brazil (401).
  - Path changed: United States, Austria, Portugal, Romania.

## 2. Gap Audit

| ID | Gap | Evidence | Ladder status | Next step |
|---|---|---|---|---|
| GL-01 | **188 catalogue licences have no evidence on file** | Registry baselines | DISCOVERED | RESEARCH: read each provider's terms (largest open task) |
| GL-02 | Coded sources had no licence gate | Batches 05–06 | **Closed in repository** (registry + conformance test) | — |
| GL-03 | Gateway readers bypassed the catalogue licence gate and quarantine (fact-check, crypto) | Batch 10 | **Closed in repository** | — |
| GL-04 | Required attributions were never displayed (`catalogAttributions()` unused) | Batch 10 | **Partly closed:** central list on `/terms`, plus per-surface lines for CoinGecko, GDELT, ECB, Elexon, Land Registry, Eurostat, NCBI, OSM, FRED | REQUIRED: per-finding attribution where CC BY requires it near the data (e.g. ECDC items on the map) |
| GL-05 | The registry is enforced by a **test**, not by a runtime policy check | `registry.ts` header | RESEARCHED | REQUIRED: Source Control Plane / Policy Engine (§3) |
| GL-06 | No detection of **terms changes** (EXPIRED_OR_CHANGED is manual) | — | DISCOVERED | REQUIRED: terms fingerprint + scheduled re-read, beside the availability recheck |
| GL-07 | Retention / caching / derived-data rules are mostly NOT_STATED; Lambda has no per-source retention policy | Registry fields | DISCOVERED | REQUIRED: per-source retention and derivation policy |
| GL-08 | **AI/ML and training use are NOT_STATED for every source**, yet the AI analyst summarises source content | Registry fields | DISCOVERED | DECISION REQUIRED: default for NOT_STATED under the Context Firewall (E) |
| GL-09 | Capabilities with **no verified independent fallback** | §1.2 | RESEARCHED | RESEARCH: threat reputation, stock indices, IP exposure, scan history, PEP screening, maritime vessels, live flights, Ethereum/Solana chain state, Global-South open data |
| GL-10 | Username-presence checks carry HIGH personal-data risk (charter §3) | Registry | RESEARCHED | DECISION REQUIRED (owner) on the capability itself |
| GL-11 | Ten CKAN portals off; four need path repair (US, AT, PT, RO) | Batch 10 | RESEARCHED | Maintenance (repair) / owner (Brazil token; Mexico and Africa allow-listing) |
| GL-12 | Owner actions pending | Earlier batches | AGREED to be owner actions | abuse.ch account; ReliefWeb appname; NASA key; written permissions (WHO, BIS, UN notice); OpenSky / OpenSanctions / Shodan / urlscan licences |

## 3. Architecture Impact

**Principle (R317):**

```
Source → Restriction → Policy → Alternative/Fallback → Architecture impact
```

Nothing is removed from the architecture. Every effect below is **additive**.

```
Source (catalogue / coded / portal)
  → Licence & Usage Record (registry; one per source_id)
  → Allowed-Usage Policy (status → ALLOW | ALLOW_WITH_CONDITIONS | ALLOW_UNDER_REVIEW | WITHHOLD;
                          per-use fields: display, redistribution, derived, caching, AI/ML)
  → Data Access     — today: registration lists, catalogue licence gate, portal gate (REPO-TESTED)
  → Transformation  — derived_data field (not yet evaluated at runtime)
  → Storage / Retention — caching / retention fields (not yet evaluated)
  → User Display    — attribution field (central list + per-surface lines)
  → Redistribution / Export — redistribution field (export / share / publish not yet gated; publish is paused, R294)
```

| Master component | Existing System today | Impact |
|---|---|---|
| §31 Source Control Plane | Catalogue, quarantine, recheck, licence gate | Consumes the registry as its licence input; per-source policy becomes runtime state, not only a test |
| §46 Security / legal; E (Context Firewall) | Licence gate (catalogue), guardrail | Per-use evaluation along the chain above. The AI/ML-use field gates what reaches the AI layer. |
| R Artifact / Export / Publication / Share | `/api/export`, `/api/export/share`, paused publish | The redistribution field and attribution propagation become preconditions of R's closure. That closure is already Production's gate (CLAUDE.md §9). |
| G Evidence / provenance | Findings carry source URL and source key | `source_id` → record lets each finding render its owed credit |
| 30.26 Data Contracts | No canonical layer | A Licence & Usage Record is a candidate canonical object (proposal BC-1) |
| Independence (J) | 180 independence groups | Fallbacks must come from a *different* independence group, or the "fallback" is the same origin |

## 4. Required Blueprint Changes

Proposals for the owner-led Master unification session. **Status: RESEARCHED → proposed for SPECIFIED.** Not adopted by Claude.

| ID | Proposed change | Affected Master text | Why |
|---|---|---|---|
| BC-1 | Add **Source Licence & Usage Record** with the 29 owner-defined fields and the 7 statuses (R317 §5) as a governed object | 30.26 (objects); §31 | The owner defined the fields; no Master text holds them |
| BC-2 | A source may not run without a record; status → usage policy as in §3 | §31; S invariant 4 | Today it is enforced by test only (GL-05) |
| BC-3 | Per-use permission evaluation at access, transformation, storage, display and export | §46; E; R | The owner's chain (R317 §6) |
| BC-4 | Context Firewall rule for **AI/ML use** when terms are NOT_STATED | E | GL-08 |
| BC-5 | **Terms-change detection** feeding EXPIRED_OR_CHANGED | §31; 30.27.6 | GL-06 |
| BC-6 | **CKAN:** the dataset's own licence is authoritative; the portal licence covers catalogue metadata only | §31; Domain packs | Measured variance (§1.4) |
| BC-7 | Each critical capability declares ≥ 1 verified fallback from a different independence group, or a named GAP | §31; J; §45 failure / resilience | GL-09 |
| BC-8 | Attribution propagation from record to every surface and export that shows the data | G; R | GL-04 |

## 5. Owner's note — the Master unification session

Recurring questions should be settled once, in one Master unification session, from the files that exist:
- rewrite or evolve;
- Pi's place;
- which verification ladder;
- 30.26 / 30.27.2–5 / 28 / 29 / A–P text.

**Recorded as the agenda; not re-asked here.** The registry and this audit are inputs to that session. Missing original texts stay **MISSING HISTORICAL SOURCE** (R313); the final version is built from the files present, and any section later found in an original file is merged after a conflict check.
