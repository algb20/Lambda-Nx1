# Maintenance Batch 05 — limits, licences and a stale assumption (2026-10-04)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation for clear defects; the "30 requests/minute" and "NASA API" sections) |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Master status effect** | None |
| **Base** | `9e5d63d` |

| ID | Item | REPRODUCE → ROOT CAUSE | PATCH | TEST |
|---|---|---|---|---|
| M5-01 | **Caller limits buried in code** | Five literals sat in three modules. The owner requires documented configuration (R308, R312). | `config/rate-limits.json`; `lib/limits.ts` validates and serves the values; `lib/rate-limit.ts`, `lib/auth/sign-in-limit.ts` and `lib/auth/code-flow.ts` read from it. **No value changed.** | `lib/limits.test.ts`: values pinned to their code values at `39188d8`; the limiters use the configuration; subject limit > caller limit. `next build` OK (middleware bundles the JSON). |
| M5-02 | **Browser suites shared one caller budget** | 12 / 13 with the failing test moving between runs; 429s from our own limiter | Each browser context sends a distinct TEST-NET-2 `x-forwarded-for` (`tests/browser/harness.ts`). Production code unchanged. | **`npm run test:ui` 13 / 13** |
| M5-03 | **NASA `DEMO_KEY` comment was stale** | The code claimed "30 / h, 50 / day … room to spare". NASA's own headers today: `x-ratelimit-limit: 10`, `retry-after: 18589`. | Comment corrected to the measurement. The key path is documented: **`NASA_API_KEY` → deployment environment → `urlFor` → request.** No key is in Git, findings or logs; findings cite the declared URL, which carries `DEMO_KEY`. | Existing quarantine tests; the record stays quarantined (CREDENTIAL REQUIRED) |
| M5-04 | **Open-Meteo licence transcribed permissively** | Recorded as CC BY 4.0 (commercial allowed). Its terms: "You may only use the free API services for non-commercial purposes"; the product has paid tiers. Latent, because the record is disabled. | Licence → `needsAgreement(…)`. The licence gate now refuses it. | `quarantine.test.ts`: `licenceProblem` → `commercial` |
| M5-05 | **OpenSky called despite the licence gate** | The catalogue record, `RECONCILED_MASTER_BASELINE` §34 and inventory G30 all say "OpenSky excluded by the licence gate" (its terms require a prior agreement for commercial REST use). The coded `opensky` source was still in `geoGatewaySources`, so the Geo gateway called it. | Removed from `geoGatewaySources`; its catalogue row is `enabled: false`; the adapter is kept. A flight (ICAO24) query now gets a clear refusal (`FLIGHTS_WITHHELD`) instead of an empty result, and **no request is sent**. The UI placeholder, empty-state text and gateway description no longer offer flight lookup. | `lib/modules/geo.test.ts`: flight query refused, fetch never called, source absent, row disabled. It replaces the old "reads a live flight state via OpenSky" test, which asserted the defect. |

**CHANGED:** user-visible — the Geo gateway no longer offers live flight lookup.

**Remedy (owner action):** obtain a commercial agreement with OpenSky. After that the change reverses in three places: `geoGatewaySources`, `geoGatewayCatalog` and `FLIGHTS_WITHHELD`.

**Regression:**
- Full unit suite: **2799 passed, 0 failed, 10 skipped**.
- `tsc` 0.
- Browser suites: 13 / 13.

**Status:** REPO-PRESENT + REPO-TESTED. Not deployed.

Limits table and retry gap: `RATE_LIMITS_2026-10-04.md`.
