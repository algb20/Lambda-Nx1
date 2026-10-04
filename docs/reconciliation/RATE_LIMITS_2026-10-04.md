# Rate limits — current implementation vs documented provider limits (2026-10-04, R312)

| | |
|---|---|
| **Owner rule (R308, R312)** | No eight numbers are invented. Limits become a documented contract or configuration. Existing values are externalised **unchanged**. Browser tests must not stand in for production source limits. |
| **Status** | Caller limits: externalised (`config/rate-limits.json`), values unchanged, final figures **DECISION REQUIRED**. Provider limits: documented below from official sources where readable. Retry contract: **GAP**. |

## 1. The two kinds of limit (kept apart)

| Kind | What it limits | Where it lives now | Unit |
|---|---|---|---|
| **Caller limit** | How often one caller may hit **our** `/api` | `config/rate-limits.json` → `lib/limits.ts` → `middleware.ts` and `lib/auth/*` | requests / caller key / window, per running instance, fixed window |
| **Provider limit** | How often **we** may call a publisher | Each catalogue record's `minIntervalSec`, each coded source's `minIntervalMs`, and the shared per-host budget (`lib/engine/host-budget.ts`) | seconds between calls, per source and per host |

### 1.1 Caller limits (values unchanged; moved from code)

| Name | Limit | Window | Key | Applies to | Previously |
|---|---|---|---|---|---|
| `gateway` | 30 | 60 s | caller address | every `/api` route except the `UNLIMITED` prefixes | `lib/rate-limit.ts:43` |
| `write` | 10 | 60 s | caller address | write routes | `lib/rate-limit.ts` |
| `signIn` | 10 | 60 s | caller address | every sign-in surface | `lib/auth/sign-in-limit.ts` |
| `signInSubject` | 20 | 60 s | hash of the claimed identity | every sign-in surface | `lib/auth/sign-in-limit.ts` |
| `code` | 10 | 60 s | caller address | verification-code requests | `lib/auth/code-flow.ts` |

**Why the values are unchanged.** No official or project source sets a different figure. The 30 / min is an Existing-System choice, made to protect provider goodwill (comment in `middleware.ts`), not a provider's number. `lib/limits.test.ts` pins each value, so any change has to be a deliberate, cited decision.

**Burst:** fixed window, so up to 2 × limit is possible across a window boundary (stated in `lib/rate-limit.ts`). **Retry-After:** sent on every 429 (`rateLimitHeaders`).

**The eight dimensions (R308), mapped to what exists:**

| Dimension | Exists? |
|---|---|
| Provider | Yes: `minIntervalSec`, `minIntervalMs`, host budget |
| Source-specific | Yes: per record |
| Tenant | **None** (no tenant model) |
| User / caller | Yes: the table above |
| Capability | **None** as a rate (plans gate features) |
| Global concurrency | Partial (CKAN `MAX_CONCURRENCY = 6`) |
| Retry budget | **None** |
| Burst | **None** beyond the fixed window |

### 1.2 Browser suites and the caller limit

The four browser suites ran from one address and spent one visitor's 30 / min between them (batch 02 §3.2: 12 / 13, with the failing test moving between runs).

Now each browser context sends a distinct `x-forwarded-for` from **198.51.100.0/24** (TEST-NET-2, RFC 5737), the header the limiter already reads behind a CDN. Each context is one visitor, which is what a page load is. The production limiter is unchanged and still exercised by its own tests.

**Result, 2026-10-04: `npm run test:ui` 13 / 13** (4 files), on a fresh build that includes the configuration change. The suite asserts nothing about provider limits.

## 2. Provider limits — documented vs configured

**Evidence classes:**
- DOC — read today from the provider's official page.
- OBS — measured today, one request.
- UV — not readable today (JS-rendered page, or no page).

| Source / host | Endpoint | Documented limit | Observed | Configured | Burst | Retry / Retry-After | Fallback | Test |
|---|---|---|---|---|---|---|---|---|
| `nasa_donki` / api.nasa.gov | `/DONKI/notifications` | UV (api.nasa.gov renders its limits with JS) | **OBS:** 429, `x-ratelimit-limit: 10`, `retry-after: 18589` on `DEMO_KEY`. The code comment's "30 / h, 50 / day" was stale and has been corrected. | 3600 s | — | No retry; quarantined | NOAA SWPC (a different instrument network, kept as its own origin — not a substitute) | `quarantine.test.ts` |
| SEC / www.sec.gov | EDGAR feeds | **DOC:** 10 requests / s; a declared User-Agent with contact is required | — | 900–3600 s; contact User-Agent set | — | No retry | — | existing SEC tests |
| NWS / api.weather.gov | `/alerts/active` | **DOC:** "generous"; when exceeded, retry "typically within 5 seconds"; a User-Agent is required | — | 300 s (catalogue), 2 s (coded) | — | No retry | MeteoAlarm and national services | existing |
| CoinGecko / api.coingecko.com | public API | **DOC:** keyless = IP-based, shared by everyone on the address; Demo key = 100 / min; errors count toward the limit | Throttle seen earlier (`boards.ts`: "Expected available in 5040 seconds") | 900 s and 2–3 s; one host budget for 5 sources | — | No retry | — | `host-budget` tests |
| OpenSky / opensky-network.org | `/api/states/all` | **DOC:** anonymous = 400 credits / day, 10 s resolution; 429 with `X-Rate-Limit-Retry-After-Seconds` | — | 60 s (catalogue, licence-blocked); 1 s (coded) | — | No retry | — | **Withheld (batch 05):** terms require an agreement for commercial use |
| arXiv / export.arxiv.org | API | **DOC:** ≤ 1 request / 3 s, single connection | — | 3600 s and 3 s | — | No retry | OpenAlex, Crossref | existing |
| OpenAQ / api.openaq.org | v3 | **DOC:** 60 / min, 2,000 / h, per API key; 429 with `x-ratelimit-*` | — | 3600 s; `OPENAQ_API_KEY` | — | No retry | — | existing |
| Open-Meteo / api.open-meteo.com | `/v1/forecast` | **DOC:** free tier < 600 / min, 5,000 / h, 10,000 / day, 300,000 / month, **non-commercial only** | — | 900 s; disabled | — | — | — | **Licence corrected (batch 05)** |
| GDELT / api.gdeltproject.org | DOC API | **DOC:** rate-limited, with **no number published** | **OBS:** 429 (2026-10-04) | 900 s and 2 s | — | No retry | — | `afp_via_gdelt` quarantined |
| ReliefWeb / api.reliefweb.int | v2 | **DOC:** appname pre-approval required since 2025-11-01; request limit UV | **OBS:** 403 without an approved appname | 1800 s | — | — | — | batch 04 tests |
| NVD / services.nvd.nist.gov | CVE API 2.0 | UV (page did not render) | — | 3600 s | — | No retry | — | — |
| Wikimedia / en.wikipedia.org | REST | UV (moved to a "Rate limits" sub-page, not read) | — | 3600 s and 1 s | — | No retry | — | — |

**Compliance reading:** every configured interval with a documented number is at or under that provider's published limit. The exceptions are **NASA on `DEMO_KEY`** (credential required) and **OpenSky** (licence, now withheld). Several limits remain UV; they are listed rather than guessed.

## 3. Retry behaviour — a contract gap, not changed now

**Repository (RP):**
- The engine has **no retry and no backoff** (no `retry` or `backoff` anywhere under `lib/engine`).
- A 429 or 5xx fails that source for the run, honestly reported as `failed` (`fetch-guard.ts`).
- The next attempt waits for the source's interval.
- Provider `Retry-After` headers are **not read**.

**Build Package §15 (30.27.6, status "RESEARCHED → SPECIFICATION IN PROGRESS")** requires:
- retryability classes: NEVER, SAFE, CONDITIONAL, AFTER_BACKOFF, …;
- exponential backoff with jitter;
- `Retry-After` where applicable;
- absolute deadlines and retry budgets.

The specification is not closed, so no retry layer is built here. That would be implementing a contract still in progress.

| Field | Record |
|---|---|
| Problem | Provider `Retry-After` is ignored; no retry budget exists |
| Evidence | §3 above; Build §15 |
| Alternatives | (a) Honour `Retry-After` as a **minimum next-attempt time** per host, inside `host-budget`: no retry within a run, only a later earliest-next-call. (b) A full retry layer per §15. (c) Leave as is. |
| Recommended | **(a) now, (b) after §15 closes.** (a) only makes us call *less*. It is consistent with charter §3 and pre-empts nothing in §15. |
| Status | **DECISION REQUIRED** — not implemented |
