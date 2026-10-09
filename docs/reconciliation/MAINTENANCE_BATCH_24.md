# Maintenance Batch 24 — honour the provider's Retry-After; W8 terms re-check (2026-10-09, R332)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R332 («اكمل حسب الأولوية») |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `48000cb` |
| **Status words** | REPO-PRESENT + REPO-TESTED |

## 1. Priority 1 — `Retry-After` honoured (charter §3; NEW-05, part)

| | |
|---|---|
| **Reproduce** | A provider answering 429 or 503 with `Retry-After` was recorded as a failure, and the next sweep called it again at once. Seen with GDELT and OpenAlex (batch 19) and NASA (≈5 h, batch 05). |
| **Root cause** | The engine never read the header. NEW-05, open since 2026-10-04. |
| **Why this is maintenance, not a new contract** | Charter §3: "Respect robots.txt, terms of service, and rate limits." A provider's explicit `Retry-After` is its rate limit, stated. The contested part of NEW-05 is the retry budget: whether, how often and with what backoff to retry. That is **not** built; it is owner decision C12. |
| **Patch** | `lib/engine/guardrail.ts`. |
| **Tests** | `lib/engine/retry-after.test.ts`, 4 tests. |

**What the patch does:**
- `retryAfterMs()` reads delay-seconds or an HTTP-date (RFC 9110 §10.2.3), capped at 24 h.
- After a 429 or 503 carrying the header, the **host** is cooled down until the time it named. The cooldown applies to every source on that host.
- A call inside the window throws `ProviderCooldownError` without touching the network. It is deliberately not `RateLimitedError`, which means "we chose to wait" and is reported as healthy. This one reaches the orchestrator's failure branch: `ok: false`, the provider's deadline in the message, and the last good answer still served from cache with its age.
- Nothing else changes. There is no wait without the header, none on other statuses, and no retry.

**What the tests cover:**
- header parsing (seconds, date, past date, junk, cap);
- the cooldown holds for every source on the host, with exactly one network call;
- the host is called again after the window;
- a 429 without the header, or a 403 with one, adds no wait.

## 2. W8 — terms-change re-check (`npm run check:terms`)

`TERMS_CHECK_2026-10-09.json` covers 242 pages and 367 records:

| | 2026-10-08 | 2026-10-09 |
|---|---|---|
| present | 162 | 167 |
| not checkable | 145 | 135 |
| unreachable | 57 | 61 |
| missing | 2 | 3 |
| partial | 1 | 1 |

The present count rose because of the verbatim quotes added in batch 21.

**Flags:**
- `mempool`, `mempool_network`, `dns.google`: the known JavaScript-rendered pages, all UNCLEAR. No change of status.
- `ooni_measurements` was flagged "missing", but the fault was ours. The licence file is Markdown, and its link brackets `[…]` were read as editorial brackets that split the quote. The quote is now the unbroken verbatim phrase "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License", re-checked against the live file: **present**. The record stays RESTRICTED.

**No provider changed its terms** since the previous run.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vitest` | 2873 passed, 10 skipped |
| `next build` | OK |
