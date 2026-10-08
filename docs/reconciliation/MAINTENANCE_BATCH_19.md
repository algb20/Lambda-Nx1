# Maintenance Batch 19 — live probe of the coded sources: GDELT spacing, OpenAlex key (2026-10-08, R327)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R327 |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `43bef20` |
| **Status words** | REPO-PRESENT + REPO-TESTED |

## F1 — Probe

Every gateway was registered the way the API routes register it, and each capability was run once through the engine's own orchestrator.
- **Inputs:** neutral, with no private person anywhere — `example.com`, `1.1.1.1`, organisation names, and the Bitcoin genesis address.
- **Result:** 199 source runs, 193 succeeded.
- **Six failures, then probed one by one with longer deadlines:**

| Source | Failure | Diagnosis |
|---|---|---|
| `crt.sh`, CelesTrak | timeout | Recovered at a 45 s deadline: 5 and 40 records. Slow provider, not a fault. |
| Wayback | 403 | Environment-specific: this network cannot reach `web.archive.org` at all (R319), while `archive.org` answers. Not a code fault. |
| Smithsonian | 403 | The known "temporarily unavailable" case (batch 18). |
| **GDELT** | 429 | "Please limit requests to one every 5 seconds". **Defect** — see F2. |
| **OpenAlex** | 429 | "This request has no API key, so it counts against the free daily budget shared by everyone on your network's IP address". **A provider change** — see F2. |

Sources that ran but returned nothing were checked; each was empty by design:
- Frankfurter takes a currency pair (`EUR/USD` gives the rate);
- Wikipedia "In the news" and USGS-in-news answer only the topic-less query; topic queries go to GDELT.

## F2 — Fixes

- **GDELT spacing:** 1500 ms → 5000 ms, as the provider asks. A row in `rate-terms.test.ts` pins it.
  - It was **not** added to the per-host budget. That table, by design and by test, holds no interval above `MAX_HOST_WAIT_MS` (3.5 s), and a 5 s host gap would turn every second caller into "host busy".
  - The catalogue's `afp_via_gdelt` reads the same host every 15 minutes. A rare collision shows as a visible 429 for that run, never as silent data.
- **OpenAlex key:** `OPENALEX_API_KEY` is read from the environment, if set, and sent as `api_key`. It is never written anywhere.
  - Without it, the source behaves as before until the shared budget runs out.
  - `openalex-key.test.ts` covers both the with-key and without-key cases.
  - Added to `PENDING_OWNER_ITEMS.md` §A.
