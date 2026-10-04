# Maintenance Batch 06 — licence boundary for coded sources (2026-10-04, R314)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation for clear defects); R314 «اكمل» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Master status effect** | None. Closes **NEW-03** structurally (PHASE30_CLOSURE_AUDIT §B). |
| **Base** | `408353d` |

## 1. What was measured

The S invariant 4 check (batch S-INV-EX-01) compared coded sources only against hosts the *catalogue* refuses. This batch asked the wider question: of the **74 coded sources** registered across all gateways, how many have their licence written down anywhere?

**None did** — coded sources had no licence field. 55 of them use a host with no catalogue record at all. The highest-risk providers were checked against their own terms, read on 2026-10-04.

## 2. Items

| ID | Provider | Terms (quoted from the provider) | Observed | Action |
|---|---|---|---|---|
| M6-01 | **OpenSanctions** (`opensanctions`; catalogue `opensanctions_updates`) | "Creative Commons 4.0 Attribution NonCommercial"; commercial use requires a paid licence | API: **401 "No API key provided"** — the source was failing on every call | Coded source removed from `financeGatewaySources`; row disabled. Catalogue licence corrected from CC BY to **non-commercial**, so the gate now withholds it. Sanctions coverage continues through the official lists in the catalogue. |
| M6-02 | **FRED** S&P 500, Dow Jones, Nasdaq Composite | FRED labels each "Copyrighted: **Pre-approval required**" (data owned by S&P Dow Jones Indices / Nasdaq) | — | Removed from the board (`FRED_PRE_APPROVAL_REQUIRED`). |
| M6-03 | **FRED** Wilshire 5000 (`WILL5000PRFC`) | FRED removed the Wilshire indexes on **2024-06-03** | Series page redirects to that notice; CSV **404** | Removed (dead request on every refresh). |
| M6-04 | FRED remaining series | "Public Domain: Citation requested" (EIA energy series); "Copyrighted: Citation required" (VIX) — commercial use allowed "provided that appropriate attribution is given to FRED as well as the original source" | — | Every row now reads `… · <origin> via FRED · <date>`. The board's footer was also stale: it named **Stooq** (replaced 2026-08-15) and said "intraday vs. session open", wrong for FRED's dated daily closes. Rewritten. |
| M6-05 | **Shodan InternetDB** | "free for non-commercial use … If you're using the InternetDB API to make money then you need an enterprise license" | — | Removed from the domain gateway; row disabled. |
| M6-06 | **urlscan.io** | "Commercial use of any part of our service requires express written permission" | — | Removed from the domain gateway; row disabled. The domain report hides the two empty sections; the gateway description says why. |
| M6-07 | **CoinGecko** (6 coded sources) | Commercial products that incorporate the API are allowed, **provided "Powered by CoinGecko" is displayed prominently** (font ≥ 10) | The attribution was **absent everywhere** | `components/powered-by-coingecko.tsx`, placed on every surface showing CoinGecko data: markets panel, markets board, correlation constellation, blockchain radar, globe liquidity layer. |
| M6-08 | **Structural fix (NEW-03)** | — | — | `lib/engine/sources/licences.ts`: one entry per coded source, in three states — verified (terms read, quoted), refused, unverified (not read yet; recorded, not guessed). `lib/conformance/s-invariants.test.ts` now fails if a registered coded source has no entry, or if a refused one is registered. |

### 2.1 Licence registry state

| State | Count | Sources |
|---|---|---|
| verified | 12 | CoinGecko ×6 (with attribution), FRED commodities and indices (citation series only), SEC ×4 (US federal, fair-access 10 req/s) |
| refused | 4 | OpenSky, OpenSanctions, urlscan, Shodan InternetDB — none registered |
| unverified — read, ambiguous | 2 | **XposedOrNot:** "free API is for personal and low-volume use". **Solana public RPC:** "not intended for production applications". Both DECISION REQUIRED. |
| unverified — not yet read | 60 | Listed in the file. Each is a research task, not a pass. |

## 3. Tests

| Check | Result |
|---|---|
| New tests | Board: never requests a pre-approval series; names FRED and the original source. Finance: entity screen never calls OpenSanctions. Domain: never calls InternetDB or urlscan. Conformance: registry completeness, no refused source registered, verified entries carry evidence and a commercial-use licence. |
| Full unit suite | **2811 passed, 0 failed, 10 skipped**. One earlier full run had a single 5 s timeout in `markets-board.test.ts` under load; the same test passed alone and in two further full runs. Recorded, not hidden. |
| `tsc` | 0 |
| Browser suites (fresh build) | **13 / 13** |

## 4. User-visible changes (CHANGED)

| Surface | Change |
|---|---|
| Stock-indices section | Now shows **VIX only**. S&P 500, Dow and Nasdaq need their owners' permission; Wilshire no longer exists on FRED. |
| Domain report | No longer shows open-port exposure (Shodan) or scan history (urlscan) |
| Finance / sanctions screen | No longer calls OpenSanctions. It was already failing with 401. |
| Market surfaces | Show "Powered by CoinGecko" |

## 5. Owner decisions opened by this batch

| ID | Decision | Options |
|---|---|---|
| D-B6-1 | Stock indices | (a) a licensed index-data provider; (b) leave VIX only |
| D-B6-2 | OpenSanctions | (a) a commercial licence and API key, then flip the gateway back; (b) official lists only |
| D-B6-3 | Shodan InternetDB / urlscan | (a) enterprise licence or written permission; (b) leave withheld |
| D-B6-4 | XposedOrNot | Does a paid product's per-query check count as "personal and low-volume use"? Otherwise use its paid plan, or withhold. |
| D-B6-5 | Solana RPC | A dedicated RPC provider for production, or keep the public endpoint with its stated limits |

**Status:** REPO-PRESENT + REPO-TESTED. Not deployed (R306).
