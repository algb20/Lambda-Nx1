# Maintenance Batch 03 — 2026-10-04

| | |
|---|---|
| **Stage** | 30.27.8.RB, maintenance lane |
| **Authority** | Owner, ledger R311: «نعم، فكّ حجز scmp_news», given in reply to the DECISION REQUIRED in `AUDIT_PASS_2026-10-04_R310.md` §4.1. Limited to that one item. |
| **Production** | **Not affected.** Production stays locked on `9c19303` (R306). Nothing here is deployed. |
| **Master status effect** | None |
| **Base** | `728e1ff` |

## 1. Change plan (CLAUDE.md §8)

| Step | Content |
|---|---|
| **SCOPE** | M3-01: release `scmp_news` from the quarantine list |
| **REQUIREMENTS** | Release bar of 2026-08-22 (`quarantine.ts` header): the document parses, has items, and carries a recent one; not a status code. Charter §3: respect robots.txt and rate limits. |
| **DEPENDENCIES** | None |
| **CONTRACTS** | None changed. The catalogue record is untouched; only the observation list changes. |
| **IMPACT** | One more active source. By count of enabled records not in quarantine: **165 → 166**. That count would read 167 → 165 for batch 02, whose "165 → 163" counted differently. |
| **TESTS** | One reproducing test, failing before the patch |
| **ACCEPTANCE** | Unit suite green, `tsc` 0, the feed read through the engine's own audit path |

## 2. M3-01 — Release `scmp_news`

| Step | Evidence |
|---|---|
| **REPRODUCE** | New test "releases SCMP once it answers with readable, current items" in `lib/engine/catalog/quarantine.test.ts`. **Failed** before the patch (1 failed, 4 passed). |
| **ROOT CAUSE** | The entry recorded an observation that is no longer true. History: 403 on 2026-08-14; 405 on 2026-08-22. 2026-10-04 recheck (R310 §4): **200, 50 items, newest 2026-10-04 18:17 UTC, headlines readable.** |
| **GUARDRAIL CHECK** | `https://www.scmp.com/robots.txt`, `User-agent: *`: `/rss/` is not disallowed (the only feed rules cover `/facebook-instant-articles/feed/*`). `Crawl-delay: 10`; the record's `minIntervalSec` is 1800. The licence record (`publicFeed('SCMP', …terms-conditions)`) is unchanged. |
| **PATCH** | `lib/engine/catalog/quarantine.ts`: the `scmp_news` entry is removed. The header paragraph on releases now names it, with date, evidence and ledger reference. |
| **TEST** | 5 / 5 in `quarantine.test.ts` |
| **REGRESSION** | Full suite **2778 passed, 0 failed, 10 skipped** (one more than before: the new test). `tsc` 0. |
| **VERIFY** | `npx tsx scripts/audit-feeds.ts scmp_news` → 1 audited, **1 readable**. Active-set check: `scmp_news` enabled and not quarantined → `true`. |

### 2.1 History of the removed entry (kept, not deleted)

```ts
{ key: 'scmp_news', reason: 'bot-blocked', status: 405, observedOn: REPROBED /* 2026-08-22 */,
  note: 'Now 405 Method Not Allowed rather than 403 — a different refusal, still a refusal.' },
```

### 2.2 Limits

- **Network path:** the recheck ran from Claude's container. Production's serverless addresses may still be refused. If so, the daily recheck (`/api/cron/sources`) and `/api/diagnose` would show it, and re-quarantining is the same one-line decision.
- **Production:** none of this reaches Production while it is locked (R306).

**Batch status:** M3-01 is done and verified (REPO-TESTED). Not deployed.
