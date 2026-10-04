# Maintenance Batch 07 — WHO, abuse.ch, OpenStreetMap; one slow test (2026-10-04, R315)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R315 «اكمل» — read the remaining coded-source terms |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `cb32e01` |

## 1. Terms read (provider pages, 2026-10-04)

| Provider | Quoted terms | Observed | Action |
|---|---|---|---|
| **WHO** (`who_don`, `who_emro`, `who_afro`, coded `who_outbreaks`, WHO news in the statements board, `who_gho` portal) | Extracts "may be reviewed, reproduced or translated for research or private study but **not for sale or for use in conjunction with commercial purposes**"; "any use other than for educational or other non-commercial purposes, require[s] **explicit, prior authorization in writing**" | — | `WHO_TERMS` (needs agreement) on every WHO record, so the licence gate withholds them. The coded source and the board feed are removed; the adapter is kept. `who_outbreaks` is out of first-light (a real gap, commented). **This reverses part of batch 04,** which had released `who_don` under a feed-syndication licence that WHO's terms do not grant. |
| **abuse.ch** (coded `feodo`, `urlhaus`, `threatfox`; catalogue `feodo_tracker`, `urlhaus_recent`) | "Access to the abuse.ch Platforms is provided **only to: Authenticated Users**"; commercial use "**may require a paid subscription**, which will be managed by Spamhaus" | ThreatFox and URLhaus APIs: **401 Unauthorized**. The Feodo download still answers. | Licence → not commercial / authenticated only. All three coded sources withheld. **The threat gateway now refuses with the reason** instead of reporting "not flagged": an unchecked indicator is not a clean one (S invariant 15). |
| **Nominatim / OpenStreetMap** | Max **1 request / s**; real User-Agent; "clearly display attribution"; no reselling, no auto-complete, no bulk grids | `minIntervalMs` 1100 (RP); the engine's User-Agent is added by the guard (RP) | **Verified, with conditions.** The ODbL attribution ("© OpenStreetMap contributors") was missing from Geo results and has been added. |
| **Gravatar** | "completely open and free to use" for "developers and organizations of all sizes" (Guidelines for Responsible Use) | — | Verified |
| PAHO | Terms page does not address commercial reuse of site content | — | Left unchanged; DECISION REQUIRED if the owner wants a stricter reading |

## 2. Test defect (not production)

`lib/modules/markets-board.test.ts › replays the last good reading…` failed intermittently with a 5 s timeout. It had measured **4.76 s before batch 06** and ~5.0 s after.

- **Cause:** two board calls back to back wait out each provider's minimum interval — the engine's politeness, which is what the test exercises.
- **Fix:** an explicit 15 s limit on that test, with the reason written down. The spacing was not faked.
- **Result:** two consecutive full runs, 2810 / 2810.

## 3. Registry after this batch

`lib/engine/sources/licences.ts`:

| State | Count |
|---|---|
| verified | 14 (+ Nominatim, Gravatar) |
| refused | 8 (+ feodo, urlhaus, threatfox, who_outbreaks) |
| unverified — ambiguous | 2 |
| unverified — not yet read | 54 |

## 4. User-visible changes (CHANGED)

| Surface | Change |
|---|---|
| Threat lookup | Refused with the reason, until abuse.ch access exists |
| World map | No WHO outbreak marks |
| Statements board | No WHO news |
| Geo results | Show the OpenStreetMap attribution |

## 5. Owner decisions

| ID | Decision |
|---|---|
| D-B7-1 | abuse.ch: create an authenticated account (`auth.abuse.ch`; the key goes in the deployment environment) and settle with Spamhaus whether commercial use needs a subscription — or leave threat lookup withheld |
| D-B7-2 | WHO: request written authorization, or rely on ECDC / CDC / Africa CDC / UKHSA for outbreak coverage |

**Status:** REPO-PRESENT + REPO-TESTED. Not deployed.
