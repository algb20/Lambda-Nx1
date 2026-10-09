# F-2 measured — conditional GET on the active catalogue (2026-10-09, R334)

| | |
|---|---|
| **Status** | **DISCOVERED**, measured. No code changed. Building it changes what a "fresh" observation means (Phase 29 freshness classes), so it waits for a specification: owner item **C14**. |
| **Source of the idea** | World Monitor v2.5.23 added ETag / If-Modified-Since to its RSS relay (`docs/RESEARCH/FIELD_2026-10-08.md`, F-2). |
| **Method** | Each of the 120 active sources was fetched once with Lambda's User-Agent. Where the answer carried `ETag` or `Last-Modified`, it was fetched once more, one second later, with `If-None-Match` / `If-Modified-Since`. Requests were spaced 0.5–1 s apart. |

## Result

| | Count |
|---|---|
| Answered 200 | 118 of 120 (`si_volcano_weekly` 403, known; `cisa_advisories` 403, see below) |
| Sent a validator | 58 (`ETag` 37, `Last-Modified` 45) |
| **Answered 304 to the conditional request** | **48** |
| Sent a validator but answered 200 again | 10: `emsc_quakes`, `nws_alerts`, `noaa_swpc_alerts`, `mempool_blocks`, `sec_press`, `worldbank_procurement`, `thehackernews`, `abc_au`, `paho_news`, `ndtv_india` |

**Bytes per full pass:** 24.2 MB in total, of which **17.0 MB (≈ 70 %)** came from the 48 feeds that answer 304 when nothing changed.

**Largest single cost:** `project_zero`, **11.3 MB per fetch**, for 10 items. Its feed embeds full articles. At its 6-hour interval that is about 45 MB a day from one source. It answers 304 when unchanged. Its licence is UNCLEAR (batch 21).

Next largest that answer 304, in bytes per fetch: `cisa_kev` 1.78 MB, `nsidc_news` 1.26 MB, `gdacs_alerts` 0.58 MB, `dawn_pakistan` 0.40 MB, `nasa_breaking` 0.26 MB, `jma_quakes` 0.25 MB, `uk_gazette` 0.22 MB.

## What a build would have to decide (why this is C14, not maintenance)

1. **Meaning of a 304.** The provider confirms that nothing changed at time T. Is the cached evidence then "retrieved at T" (revalidated), or does it keep its original `retrievedAt` with a separate "confirmed unchanged at" field? Today `retrievedAt` is never rewritten (orchestrator rule: nothing makes stale data look live). A new field is a data-contract change (30.26).
2. **Where validators live.** In memory with the source cache, which does not survive between serverless invocations (see `host-budget.ts`), or durably. Durable storage is a schema change.
3. **Health semantics.** A 304 is a success that delivered no body. It must count as healthy and current, never as "empty" (invariant 15).

## Side observation

`cisa_advisories` was readable in the batch-25 audit an hour earlier (30 items), then answered 403 twice in this run. That is one observation, and possibly a temporary block. It is recorded for the next W8 round, not quarantined on one reading.
