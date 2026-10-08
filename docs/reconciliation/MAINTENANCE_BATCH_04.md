# Maintenance Batch 04 — moved-source repair, 2026-10-04

| | |
|---|---|
| **Stage** | 30.27.8.RB, maintenance lane |
| **Authority** | Owner, ledger R312 ("SOURCE REPAIR … may be repaired as a maintenance task"; standing authorisation in CLAUDE.md §9) |
| **Production** | **Not affected.** It stays locked on `9c19303` (R306). |
| **Master status effect** | None. Corrective maintenance of the Existing System's catalogue. |
| **Base** | `f85bf82` |

## 1. Change plan

| Step | Content |
|---|---|
| **SCOPE** | The 20 quarantine entries with reason `moved` |
| **REQUIREMENTS** | R312 steps 1–9: find the publisher's current official URL; verify it is the same feed; check access, format and licence (including robots.txt); update the registry, keeping the old URL; test; leave anything without an official replacement BLOCKED; never substitute an aggregator |
| **METHOD** | Each publisher's **own listing** of its feeds (feed index pages, `<link rel="alternate">`, documented API pages). Each candidate fetched with the engine's User-Agent, its items counted and the newest date read. robots.txt read for the path. |
| **CHANGED (code)** | `CatalogSource.formerUrls`, a historical field that is never fetched. `map.urlTemplate`, a citation link only, never fetched, http(s) only. A new quarantine reason, `credential`. Six records repaired; the quarantine list updated; the coded ReliefWeb source moved to v2. |
| **CONTRACTS** | No Master contract changes. The two new record fields are optional and additive, and existing records are unaffected. |
| **NEW DEPENDENCY** | None |

## 2. Per-source result

| Key | Old URL (status) | Finding | Action | State now |
|---|---|---|---|---|
| `who_don` | `who.int/feeds/entity/csr/don/en/rss.xml` (404) | RSS retired. WHO's own content API on who.int (the endpoint its DON page reads) serves the notices: 50 rows, newest 2026-DON618 of 2026-09-25; the item page answers 200. robots.txt has no rule for us. **The API is first-party but not separately documented** — recorded as a risk; the daily recheck covers it. | URL → `/api/news/diseaseoutbreaknews…`, `kind: json`, `urlTemplate` to the notice page | **RELEASED** |
| `ecdc_threats` | `taxonomy/term/1416/feed` (404) | ECDC's RSS page lists "Communicable disease threats report" at **term 1505**. Weekly CDTR; week 40 is the newest. | URL → `term/1505/feed` | **RELEASED** |
| `bis_press` | `doclist/all_rss.xml` (404) | bis.org/rss lists "Media releases" at `all_pressrels.rss` (RDF; newest 2026-10-01) | URL updated | **RELEASED** |
| `annahar_lebanon` | `rss/latest-news.xml` (404) | The publisher's `/rss`: 50 items, newest 2026-10-04. robots.txt does not disallow it. | URL updated | **RELEASED** |
| `who_afro` | `rss/news.xml` (404) | afro.who.int/rss-feeds lists "Emergencies and outbreaks" at `/rss/emergencies.xml` — the same dataset. It answers with 2 items, the newest from **2025**. | URL updated; reason → `frozen` | QUARANTINED (frozen) |
| `eluniversal_mx` | `rss.xml` (404) | The current feed `/arc/outboundfeeds/rss/?outputType=xml` answers (100 items). But **robots.txt (edition of 2026-09-24): `User-agent: * Disallow: /`** — only named bots are allowed. | URL updated; reason → `bot-blocked` (robots) | QUARANTINED (refused) |
| `reliefweb_reports` | v1 (410) | v2 is the documented successor. Since **2025-11-01** it requires an appname that ReliefWeb has approved in advance (apidoc.reliefweb.int/parameters#appname). It answers 403 without one. | URL → v2; appname read from `RELIEFWEB_APPNAME`; `keyless: false`; reason → `credential` | QUARANTINED (credential) |
| `reliefweb_disasters` | v2 (403) | Same registration. **Defect found:** the appname was written into the URL as `lambda-nx`, so setting `RELIEFWEB_APPNAME` (as its own note instructs) would have changed nothing. | `urlFor` reads the env var; reason → `credential` | QUARANTINED (credential), still `enabled: false` |
| `reliefweb` (coded source, `lib/engine/sources/news.ts`) | v1 + hard-coded appname | Same defect | → v2, env appname. It stays out of `newsGatewaySources` (the existing test records how to reverse that). | Disabled (unchanged) |
| `paho_alerts` | 404 | No separate alerts feed is listed. PAHO's only feed is `/en/rss.xml`, which is already the `paho_news` record. | None | BLOCKED — no official replacement |
| `fao_giews` | 404 | The GIEWS page advertises no feed | None | BLOCKED |
| `finra_actions` | 404 | `finra.org/rss.xml` exists but carries FAQs and rule guidance, **not** disciplinary actions — a different dataset | None | BLOCKED |
| `treasury_press` | 404 | `home.treasury.gov/rss.xml` carries SSBCI FAQs, with the newest from 2026-07-22 — **not** press releases. The press-release pages advertise no feed. | None | BLOCKED |
| `pagasa_philippines` | 404 | PAGASA's public-alert CAP feed (`publicalert.pagasa.dost.gov.ph/feeds/`, Atom, 51 entries) is official, but it is an **alerts** dataset, not the weather-bulletin feed the record names | None | BLOCKED. The CAP feed is **DISCOVERED** (a candidate new record, which needs an adoption decision). |
| `jakartapost` | 404 | No feed advertised; `/rss`, `/rss.xml` and `/feed/rss` are all 404 | None | BLOCKED |
| `aps_algeria` | 404 | Site rebuilt; no feed found on any tried path | None | BLOCKED |
| `nhk_world` | 403 on recheck | No English feed advertised. `www3.nhk.or.jp/rss/news/cat0.xml` is NHK's **Japanese** domestic feed — a different dataset | None | BLOCKED |
| `reuters_world` | 404 / 403 | Reuters withdrew public RSS (existing note) | None | BLOCKED — no official replacement |
| `urlhaus_recent` | 404 | abuse.ch moved to an authenticated API. The coded `urlhaus` source is unaffected (existing note). | None | BLOCKED (duplicate of a coded source) |
| `ted_europa` | 404 | TED's v3 search API is **POST-only** (`api.ted.europa.eu/v3/notices/search`). The catalogue adapter issues GET only. | None | BLOCKED — **DECISION REQUIRED** (§3) |
| `saws_south_africa` | 200, SPA shell | No feed. Re-checked from this container: TLS chain error (UNVERIFIED — environment). | None | BLOCKED |

**Totals:** 4 released; 4 repaired but still withheld for a documented reason; 1 coded source corrected; 12 blocked, with no official same-dataset replacement found.

**Active sources** (enabled and not quarantined): **166 → 170**.

## 3. New issues and decisions

| ID | Item | Status |
|---|---|---|
| NI-04-1 | `reliefweb_disasters` and the coded `reliefweb` source ignored `RELIEFWEB_APPNAME` (the appname was hard-coded) | **Fixed** here |
| NI-04-2 | **ReliefWeb appname.** Owner action: request one at apidoc.reliefweb.int/parameters#appname. ReliefWeb replies by email, so the request must come from the owner. Then set `RELIEFWEB_APPNAME` in the deployment environment (not in Git). After that, release both records and flip `enabled` on the coded source. | **OWNER ACTION** |
| NI-04-3 | **TED v3 needs POST.** Supporting it means adding a request method and body to the catalogue record — an engine capability, flagged rather than invented. Alternatives: (a) add `request: { method: 'POST', body }` to `CatalogSource`, keeping the guardrail host check; (b) a coded source for TED only; (c) leave it blocked. **Recommended: (b).** It touches one source rather than the shared adapter contract. | **DECISION REQUIRED** |
| NI-04-4 | PAGASA public-alert CAP feed — a new official dataset | **DISCOVERED** (adoption is a research-stage decision) |
| NI-04-5 | `who_don` depends on an undocumented first-party API | Risk recorded; daily recheck covers it |

## 4. Tests

| Check | Result |
|---|---|
| New tests, before the patch | **15 failed**, 43 passed (`quarantine.test.ts`, `adapter.test.ts`) |
| After the patch | 58 / 58 |
| Full suite | **2795 passed, 0 failed, 10 skipped** |
| `tsc` | 0 |
| Live, via the engine's audit path (`scripts/audit-feeds.ts`) | `who_don` 50 readable · `ecdc_threats` 10 · `bis_press` 10 · `annahar_lebanon` 50 — 4 / 4 readable |

**Status:** REPO-PRESENT + REPO-TESTED. Not deployed (R306).
