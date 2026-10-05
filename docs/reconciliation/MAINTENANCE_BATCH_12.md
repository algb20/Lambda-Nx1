# Maintenance Batch 12 — other routes to unreadable terms; replacement candidates; a correction (2026-10-05, R319)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R317 (licence rules); R319 «اكمل» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `5de4210` |
| **Status words** | Research and record only. No source added, none removed. |

## 1. The 74 unreadable terms pages — other routes tried

| Route | Result on 2026-10-05 |
|---|---|
| **Wayback Machine.** `archive.org/wayback/available` confirms snapshots exist (e.g. OECD terms, 2026-09-01). | **Unreachable from this environment.** `web.archive.org` closes the tunnel after 11 s, every time. The fetch tool reports it cannot fetch from that host. |
| **Headless Chromium** (`/opt/pw-browsers`), for pages that render only with JavaScript. | **Refused by TLS:** `ERR_CERT_AUTHORITY_INVALID` behind the session's TLS-terminating proxy. Turning certificate verification off is forbidden (session rules), so it was not done. |
| **Fetch tool** for 403 pages (IMF, OECD, CBC, DW, France 24, ABC). | 403, 404, empty page, or "unable to fetch". |

**Result:** the 74 records stay UNCLEAR, each with the reason it gives, and keep running (R317). Anti-bot challenges were not solved or bypassed; a refusal is the operator's terms (charter §3).

**What would read them:**
- a machine whose browser trusts its own network path; or
- a person opening each page.

The list is the UNCLEAR section of `SOURCE_LICENSE_REGISTRY_2026-10-05.md`.

## 2. Replacement candidates for withheld coverage

| Candidate | Licence (quoted, 2026-10-05) | Usable? |
|---|---|---|
| **Voice of America** feeds | "All text, audio and video material produced exclusively by the Voice of America is in the public domain." Agency copy (Reuters, AP) is "licensed for use in VOA programming only". Those items name the agency in `<author>`, so they could be filtered. | **No — frozen.** In every feed checked (International, Africa, Middle East, East Asia, South & Central Asia, Europe, USA) the newest item is from 12–15 March 2025. An implementation (catalogue entries plus an author filter) was written, tested, measured live and **reverted before commit**: a source that stopped in 2025 would add stale items as if current. |
| **ECHO Daily Flash** (EU ERCC) | Commission reuse policy (Decision 2011/833/EU; CC BY 4.0). The portal links the Commission legal notice, at an address that now answers 404. | **No — stale.** `GetPagedItems` returns 26,343 items; the newest is dated 2026-05-18. |
| **RouteViews** (University of Oregon) | "Use of the data created and owned by RouteViews … is licensed under a Creative Commons Attribution 4.0 International License". When selling derived products: attribution, logo and a boilerplate description. Guest API: 1 call per second. | **Yes, verified.** `/guest/asn/3333` returns the AS's prefixes, the same answer RIPEstat's announced-prefixes gives. Recorded as the fallback for `ripe_stat_announced`. That source was already `enabled: false` (query-driven), so nothing is switched on. |
| **M-Lab** | "All data collected by M-Lab tests are available to the public without restriction under a No Rights Reserved Creative Commons Zero Waiver". Note: the site's own text is CC BY-NC-SA. | **Licence yes; access no.** The data is served through BigQuery, not a keyless HTTP API. Recorded as a fallback for RIPE Atlas, with that caveat. |
| **CAIDA** datasets | Licence "solely for the purpose of non-profit research, non-profit education, commercial internal testing … or for government purposes". | **No** for this product. |
| **VicEmergency, NSW RFS** (Australian hazards) | Terms not readable (403, or JavaScript-only). | Unknown. |

## 3. Correction to batch 11

Batch 11 §6 listed Australian weather warnings, ReliefWeb and RIPE (Atlas, RIPEstat) as coverage newly lost. They were not:
- `bom_warnings`, `ripe_atlas_anchors`, `ripe_stat_announced` and `reliefweb_disasters` were already `enabled: false`;
- `reliefweb_reports` was already quarantined.

The section and gap row GL-09 are corrected in place, with a note saying so. The 164 → 139 count of active sources was right, because it counts active sources only.

## 4. Registry changes

`fallback_sources` updated:
- `ripe_stat_announced` → RouteViews;
- `ripe_atlas_anchors` → M-Lab (BigQuery caveat) and OONI;
- `reliefweb_disasters` and `reliefweb_reports` → GDACS (verified).

No status changed.
