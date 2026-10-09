# Maintenance Batch 25 — W8 round: live audit, quarantine re-check, terms-tool fix (2026-10-09, R333)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R333 («اكمل ولا تتوقف») |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `bd032f7` |
| **Status words** | REPO-PRESENT + REPO-TESTED |

## 1. Live audit of the active sources (`scripts/audit-feeds.ts`)

The tool audited 207 enabled feeds. Of the **120 active** (licence-allowed, not quarantined):

| Verdict | Count | Notes |
|---|---|---|
| readable | 103 | — |
| quiet | 16 | 14 MeteoAlarm countries, `metoffice_warnings`, `kma_korea`. Checked, not assumed: MeteoAlarm Romania's feed was rebuilt the same morning (`<updated>2026-10-09T05:35Z`) with zero entries, while Germany carried 413. A country with no warnings in force is a real quiet hour, and recorded as such, never as "no event". |
| unreachable | 1 | `si_volcano_weekly` (403), the known Smithsonian case kept by the 2026-10-04 decision |
| unreadable (mapping bugs) | **0** | — |

No active source has moved or broken since batch 18. Nothing to repair.

## 2. Quarantine re-check (`recheckQuarantine`, live)

| | |
|---|---|
| Checked | 50 of 50 |
| Recovered | **none** |
| Still refused | 43 |
| Answers but empty | 5: `nist_cyber`, `africa_cdc`, `rferl`, `pm25_lass`, `map_morocco` |
| Answers but stale | 1: `who_afro`, newest 389 days |
| Answers but withheld | 1: `eluniversal_mx` |

`eluniversal_mx` carried 100 items that day, but its licence status is PROHIBITED. The batch-20 fix is confirmed live: the run said "still withheld" and did not advise a release.

## 3. Defect fixed — the terms check counted a PDF as an outage

| | |
|---|---|
| **Reproduce** | `TERMS_CHECK_2026-10-09.json` listed `ietf_rfc` as unreachable. Its evidence is the IETF Trust's PDF, which answered 200. |
| **Root cause** | `scripts/check-terms.ts` returned `status: 'error'` for any non-text content type, and every non-200 status is counted as unreachable. |
| **Patch** | A non-text body that answered is marked `binary` and counted as **not checkable**, which is the truth: readable, but not comparable as page text. |
| **Effect on the 2026-10-09 counts** | Unreachable 61 includes this one record. The other three new entries are real refusals (BleepingComputer, ESA, The Daily Star), all already withheld or quarantined. |

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vitest` | 2873 passed, 10 skipped |
